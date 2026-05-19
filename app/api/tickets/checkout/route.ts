import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { stripe, platformFeeAmount } from '@/lib/stripe'

/**
 * POST /api/tickets/checkout
 *
 * Creates a Stripe Checkout Session for purchasing a ticket.
 * Now supports BOTH logged-in buyers and guest checkout.
 *
 * Body: {
 *   tierId: string,
 *   eventId: string,
 *   quantity?: number,
 *   guest?: { name: string, email: string, phone: string | null }  // present when not signed in
 * }
 *
 * Flow:
 *   - If signed in → use user's profile email + Stripe customer (as before)
 *   - If guest → require the guest payload; create a session-scoped Stripe
 *     customer for receipt purposes; pass guest details through metadata
 *     so the webhook can write them onto the ticket row.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const body = await request.json()
    const { tierId, eventId, quantity = 1, guest } = body

    if (!tierId || !eventId) {
      return NextResponse.json(
        { error: 'tierId and eventId are required' },
        { status: 400 }
      )
    }

    // If no session, require a guest payload
    if (!user && !guest) {
      return NextResponse.json(
        { error: 'Buyer information is required for guest checkout' },
        { status: 400 }
      )
    }

    // Validate guest payload shape
    if (!user && guest) {
      if (!guest.name?.trim() || !guest.email?.trim()) {
        return NextResponse.json(
          { error: 'Guest name and email are required' },
          { status: 400 }
        )
      }
    }

    const admin = createAdminClient()
    const origin = request.nextUrl.origin

    // Load tier + event + creator stripe info
    const { data: tier, error: tierError } = await admin
      .from('ticket_tiers')
      .select(
        `
        id, name, description, price, quantity, quantity_sold, is_active,
        sale_starts_at, sale_ends_at,
        events (
          id, title, event_date, event_start_time, image_url, slug,
          auth_user_id,
          profiles!events_auth_user_id_profile_fkey (
            stripe_account_id,
            stripe_account_status
          )
        )
      `
      )
      .eq('id', tierId)
      .eq('event_id', eventId)
      .single()

    if (tierError || !tier) {
      return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 })
    }

    const event = Array.isArray(tier.events) ? tier.events[0] : (tier.events as any)
    const creatorProfile = Array.isArray(event?.profiles)
      ? event.profiles[0]
      : (event?.profiles as any)

    // Validations
    if (!tier.is_active) {
      return NextResponse.json({ error: 'Ticket sales are not active' }, { status: 400 })
    }

    const now = new Date()
    if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) {
      return NextResponse.json(
        { error: 'Ticket sales have not started yet' },
        { status: 400 }
      )
    }
    if (tier.sale_ends_at && new Date(tier.sale_ends_at) < now) {
      return NextResponse.json({ error: 'Ticket sales have ended' }, { status: 400 })
    }

    if (tier.quantity !== null) {
      const remaining = tier.quantity - tier.quantity_sold
      if (remaining < quantity) {
        return NextResponse.json(
          { error: `Only ${remaining} ticket(s) remaining` },
          { status: 400 }
        )
      }
    }

    const stripeAccountId = creatorProfile?.stripe_account_id
    if (!stripeAccountId || creatorProfile?.stripe_account_status !== 'enabled') {
      return NextResponse.json(
        { error: 'Event creator has not completed payment setup' },
        { status: 400 }
      )
    }

    // ── Build customer + buyer info ──────────────────────────────────────
    // Two paths: logged-in (reuse Stripe customer) vs guest (one-off customer).
    let customerId: string
    let buyerEmail: string
    let buyerName: string | null
    let buyerPhone: string | null
    let buyerUserId: string | null

    if (user) {
      const { data: buyerProfile } = await admin
        .from('profiles')
        .select('email, full_name, phone_number, stripe_customer_id')
        .eq('id', user.id)
        .single()

      buyerEmail = buyerProfile?.email || user.email || ''
      buyerName = buyerProfile?.full_name || null
      buyerPhone = buyerProfile?.phone_number || null
      buyerUserId = user.id

      // Reuse or create their Stripe customer
      let cid = buyerProfile?.stripe_customer_id
      if (!cid) {
        const customer = await stripe.customers.create({
          email: buyerEmail,
          name: buyerName || undefined,
          phone: buyerPhone || undefined,
          metadata: { supabase_user_id: user.id },
        })
        cid = customer.id
        await admin
          .from('profiles')
          .update({ stripe_customer_id: cid })
          .eq('id', user.id)
      }
      customerId = cid
    } else {
      // Guest path — create a one-off Stripe customer for receipt routing.
      // We intentionally don't try to dedupe against existing customers by
      // email; Stripe is happy with duplicates and we keep things simple.
      buyerEmail = guest.email.trim().toLowerCase()
      buyerName = guest.name.trim()
      buyerPhone = guest.phone || null
      buyerUserId = null

      const customer = await stripe.customers.create({
        email: buyerEmail,
        name: buyerName || undefined,
        phone: buyerPhone || undefined,
        metadata: { guest_checkout: 'true' },
      })
      customerId = customer.id
    }

    // ── Amounts ──────────────────────────────────────────────────────────
    const unitAmount = Math.round(Number(tier.price) * 100)
    const applicationFeeAmount = platformFeeAmount(unitAmount) * quantity

    // ── Build session metadata ───────────────────────────────────────────
    // We pack everything the webhook needs into metadata so it can mint a
    // ticket whether the buyer was signed in or not. Stripe limits metadata
    // values to 500 chars and keys to 40 — names + emails fit fine.
    const sessionMetadata: Record<string, string> = {
      tier_id: tierId,
      event_id: eventId,
      quantity: String(quantity),
      buyer_email: buyerEmail,
      buyer_name: buyerName || '',
      buyer_phone: buyerPhone || '',
    }
    if (buyerUserId) sessionMetadata.buyer_user_id = buyerUserId

    // ── Create Stripe Checkout Session ───────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: unitAmount,
            product_data: {
              name: `${tier.name} — ${event.title}`,
              description: tier.description || undefined,
              metadata: { tier_id: tier.id, event_id: eventId },
            },
          },
          quantity,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: { destination: stripeAccountId },
        metadata: sessionMetadata,
      },
      metadata: sessionMetadata,
      success_url: `${origin}/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/events/${event.slug}?ticket_cancelled=1`,
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (err: any) {
    console.error('[tickets/checkout] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
