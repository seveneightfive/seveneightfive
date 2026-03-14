import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { stripe, PLATFORM_FEE_PERCENT } from '@/lib/stripe'

/**
 * POST /api/tickets/checkout
 *
 * Creates a Stripe Checkout Session for purchasing a ticket.
 * Uses Stripe Connect transfer_data to route funds to the event
 * creator's connected account, minus a platform fee.
 *
 * Body: { tierId: string, eventId: string, quantity?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tierId, eventId, quantity = 1 } = await request.json()

    if (!tierId || !eventId) {
      return NextResponse.json({ error: 'tierId and eventId are required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const origin = request.nextUrl.origin

    // Load ticket tier + event + creator's stripe account in one query
    const { data: tier, error: tierError } = await admin
      .from('ticket_tiers')
      .select(`
        id, name, description, price, quantity, quantity_sold, is_active,
        sale_starts_at, sale_ends_at,
        events (
          id, title, event_date, event_start_time, image_url, slug,
          auth_user_id,
          profiles!events_auth_user_id_fkey (
            stripe_account_id,
            stripe_account_status
          )
        )
      `)
      .eq('id', tierId)
      .eq('event_id', eventId)
      .single()

    if (tierError || !tier) {
      return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 })
    }

    const event = Array.isArray(tier.events) ? tier.events[0] : tier.events as any
    const creatorProfile = Array.isArray(event?.profiles)
      ? event.profiles[0]
      : event?.profiles as any

    // Validations
    if (!tier.is_active) {
      return NextResponse.json({ error: 'Ticket sales are not active' }, { status: 400 })
    }

    const now = new Date()
    if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) {
      return NextResponse.json({ error: 'Ticket sales have not started yet' }, { status: 400 })
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

    // Check creator has a connected Stripe account
    const stripeAccountId = creatorProfile?.stripe_account_id
    if (!stripeAccountId || creatorProfile?.stripe_account_status !== 'enabled') {
      return NextResponse.json(
        { error: 'Event creator has not completed payment setup' },
        { status: 400 }
      )
    }

    // Get buyer profile for email + Stripe customer
    const { data: buyerProfile } = await admin
      .from('profiles')
      .select('email, full_name, stripe_customer_id')
      .eq('id', user.id)
      .single()

    // Create or retrieve Stripe customer
    let customerId = buyerProfile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: buyerProfile?.email || user.email,
        name: buyerProfile?.full_name || undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Calculate amounts in cents
    const unitAmount = Math.round(Number(tier.price) * 100)
    const totalAmount = unitAmount * quantity
    const platformFeeAmount = Math.round(totalAmount * PLATFORM_FEE_PERCENT)

    // Create Stripe Checkout Session
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
        application_fee_amount: platformFeeAmount,
        transfer_data: {
          destination: stripeAccountId,
        },
        metadata: {
          tier_id: tierId,
          event_id: eventId,
          buyer_user_id: user.id,
          quantity: String(quantity),
        },
      },
      metadata: {
        tier_id: tierId,
        event_id: eventId,
        buyer_user_id: user.id,
        quantity: String(quantity),
      },
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
