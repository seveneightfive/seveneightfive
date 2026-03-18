import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdmin } from '@/lib/supabaseServer'

/**
 * POST /api/tickets/rsvp
 *
 * Creates a free ticket (RSVP) directly without going through Stripe.
 * Only valid for ticket tiers with price = 0.
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

    const admin = createAdmin()

    // Verify the tier exists, is active, and is genuinely free
    const { data: tier, error: tierError } = await admin
      .from('ticket_tiers')
      .select('id, name, price, quantity, quantity_sold, is_active, event_id')
      .eq('id', tierId)
      .eq('event_id', eventId)
      .single()

    if (tierError || !tier) {
      return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 })
    }

    if (!tier.is_active) {
      return NextResponse.json({ error: 'This ticket tier is not currently available' }, { status: 400 })
    }

    if (Number(tier.price) !== 0) {
      return NextResponse.json({ error: 'This tier requires payment — use the checkout flow' }, { status: 400 })
    }

    // Check capacity
    if (tier.quantity !== null) {
      const remaining = tier.quantity - tier.quantity_sold
      if (remaining < quantity) {
        return NextResponse.json(
          { error: `Only ${remaining} spot(s) remaining` },
          { status: 400 }
        )
      }
    }

    // Check if user already RSVP'd for this event
    const { data: existing } = await admin
      .from('tickets')
      .select('id')
      .eq('buyer_user_id', user.id)
      .eq('event_id', eventId)
      .eq('payment_status', 'paid')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'You already have an RSVP for this event' }, { status: 400 })
    }

    // Get buyer profile for email
    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    // Insert ticket(s) directly
    const tickets = Array.from({ length: quantity }, () => ({
      ticket_tier_id: tierId,
      event_id: eventId,
      buyer_user_id: user.id,
      buyer_email: profile?.email || '',
      buyer_name: profile?.full_name || null,
      payment_status: 'paid' as const,
      amount_paid: 0,
      platform_fee: 0,
      status: 'valid' as const,
    }))

    const { data: inserted, error: insertError } = await admin
      .from('tickets')
      .insert(tickets)
      .select('id, qr_token')

    if (insertError) {
      console.error('[tickets/rsvp] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save your RSVP' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      tickets: inserted,
      message: `RSVP confirmed for ${quantity} guest${quantity > 1 ? 's' : ''}`,
    })

  } catch (err: any) {
    console.error('[tickets/rsvp] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
