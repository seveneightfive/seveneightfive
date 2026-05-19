import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import {
  stripe,
  serviceFeeAmount,
  applicationFeeAmount,
} from '@/lib/stripe'

/**
 * POST /api/tickets/checkout
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

    // Require guest info if not logged in
    if (!user && !guest) {
      return NextResponse.json(
        { error: 'Buyer information is required for guest checkout' },
        { status: 400 }
      )
    }

    // Validate guest payload
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

    /**
     * Load ticket tier + event + creator's Stripe Connect status.
     */
    const { data: tier, error: tierError } = await admin
      .from('ticket_tiers')
      .select(`
        id,
        name,
        description,
        price,
        quantity,
        quantity_sold,
        is_active,
        sale_starts_at,
        sale_ends_at,

        events!inner (
          id,
          title,
          slug,
          image_url,
          event_date,
          event_start_time,
          auth_user_id,

          profiles!events_auth_user_id_profile_fkey (
            id,
            stripe_account_id,
            stripe_account_status
          )
        )
      `)
      .eq('id', tierId)
      .eq('event_id', eventId)
      .single()

    if (tierError || !tier) {
      console.error('[tickets/checkout] tier query error:', tierError)
      return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 })
    }

    // Supabase nested joins can return object OR array
    const event = Array.isArray(tier.events) ? tier.events[0] : tier.events
    const creatorProfile = Array.isArray(event?.profiles)
      ? event.profiles[0]
      : event?.profiles

    /**
     * Validate ticket tier
     */
    if (!tier.is_active) {
      return NextResponse.json(
        { error: 'Ticket sales are not active' },
        { status: 400 }
      )
    }

    const now = new Date()
    if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) {
      return NextResponse.json(
        { error: 'Ticket sales have not started yet' },
        { status: 400 }
      )
    }
    if (tier.sale_ends_at && new Date(tier.sale_ends_at) < now) {
      return NextResponse.json(
        { error: 'Ticket sales have ended' },
        { status: 400 }
      )
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

    /**
     * Validate organizer Stripe setup
     */
    const stripeAccountId = creatorProfile?.stripe_account_id
    const stripeStatus = creatorProfile?.stripe_account_status

    if (!stripeAccountId) {
      return NextResponse.json(
        { error: 'Event creator has not connected Stripe' },
        { status: 400 }
      )
    }
    if (stripeStatus !== 'enabled') {
      return NextResponse.json(
        { error: 'Event creator has not completed payment setup' },
        { status: 400 }
      )
    }

    /**
     * Buyer / customer handling
     */
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

      let existingCustomerId = buyerProfile?.stripe_customer_id

      if (!existingCustomerId) {
        const customer = await stripe.customers.create({
          email: buyerEmail,
          name: buyerName || undefined,
          phone: buyerPhone || undefined,
          metadata: { supabase_user_id: user.id },
        })
        existingCustomerId = customer.id
        await admin
          .from('profiles')
          .update({ stripe_customer_id: existingCustomerId })
          .eq('id', user.id)
      }
      customerId = existingCustomerId
    } else {
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

    /**
     * Pricing — buyer absorbs Stripe fees.
     *
     * unitAmount         = ticket face value (cents)
     * serviceFeePerTicket = dime-rounded Stripe fee estimate (buyer side)
     * appFeePerTicket    = serviceFeePerTicket + $0.70 platform margin
     *                      (pulled from organizer's transfer)
     */
    const unitAmount = Math.round(Number(tier.price) * 100)
    const serviceFeePerTicket = serviceFeeAmount(unitAmount)
    const appFeePerTicket = applicationFeeAmount(unitAmount)
    const applicationFeeAmountTotal = appFeePerTicket * quantity

    /**
     * Metadata for webhook + reporting
     */
    const sessionMetadata: Record<string, string> = {
      tier_id: tierId,
      event_id: eventId,
      quantity: String(quantity),
      buyer_email: buyerEmail,
      buyer_name: buyerName || '',
      buyer_phone: buyerPhone || '',
      ticket_unit_amount: String(unitAmount),
      service_fee_per_ticket: String(serviceFeePerTicket),
      application_fee_per_ticket: String(appFeePerTicket),
    }
    if (buyerUserId) sessionMetadata.buyer_user_id = buyerUserId

    /**
     * Build line items so buyer sees the fee broken out on Stripe's
     * hosted checkout page:
     *   1. Ticket(s) at face value
     *   2. Service fee (one line, total across all tickets)
     */
    const lineItems: import('stripe').Stripe.Checkout.SessionCreateParams.LineItem[] = [
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
    ]

    if (serviceFeePerTicket > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: serviceFeePerTicket * quantity,
          product_data: {
            name: 'Service fee',
            description: 'Covers payment processing.',
          },
        },
        quantity: 1,
      })
    }

    /**
     * Create Stripe Checkout Session
     */
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: applicationFeeAmountTotal,
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
