import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServer'

/**
 * GET /api/tickets/lookup?session_id=cs_xxx
 *
 * Server-side lookup of tickets by Stripe Checkout Session ID. This is what
 * the post-checkout success page hits. Works for BOTH logged-in and guest
 * buyers because we look up by an unguessable Stripe session id rather than
 * by auth.uid().
 *
 * Security note: session ids are not enumerable (Stripe uses random suffixes
 * of ~32 chars). A buyer landing on /tickets/success?session_id=... gets
 * their tickets; anyone else trying to use that URL would also see them,
 * but the only way to get the URL is to have just completed the checkout
 * (Stripe redirects with this id). This matches how Eventbrite, etc., do it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const sessionId = searchParams.get('session_id')

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return NextResponse.json({ error: 'Invalid session id' }, { status: 400 })
  }

  const admin = createClient()

  // The webhook may not have run yet — let the caller poll. We just return
  // whatever's there right now.
  const { data, error } = await admin
    .from('tickets')
    .select(
      `
      id, qr_token, status, payment_status, amount_paid, created_at,
      buyer_email, buyer_name,
      events!inner ( id, title, event_date, event_start_time, image_url, slug, venue_id, venues ( name, address ) ),
      ticket_tiers!inner ( id, name, price )
    `
    )
    .eq('stripe_checkout_session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[tickets/lookup] error:', error)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }

  // Flatten the joined shape for the client (matching the my_tickets view shape).
  const tickets = (data || []).map((t: any) => {
    const ev = Array.isArray(t.events) ? t.events[0] : t.events
    const tier = Array.isArray(t.ticket_tiers) ? t.ticket_tiers[0] : t.ticket_tiers
    const venue = ev?.venues
      ? Array.isArray(ev.venues)
        ? ev.venues[0]
        : ev.venues
      : null
    return {
      id: t.id,
      qr_token: t.qr_token,
      status: t.status,
      payment_status: t.payment_status,
      amount_paid: t.amount_paid,
      buyer_email: t.buyer_email,
      buyer_name: t.buyer_name,
      event_title: ev?.title,
      event_date: ev?.event_date,
      event_start_time: ev?.event_start_time,
      event_slug: ev?.slug,
      tier_name: tier?.name,
      venue_name: venue?.name || null,
      venue_address: venue?.address || null,
    }
  })

  return NextResponse.json({ tickets })
}
