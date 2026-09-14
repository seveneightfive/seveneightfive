import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { sendTicketEmail } from '@/app/lib/email'

/**
 * POST /api/admin/tickets/resend-confirmation
 *
 * Re-sends a ticket confirmation email through the app's own
 * sendTicketEmail — NOT the same as Resend's dashboard "Resend"
 * button, which just replays the exact stored HTML of the original
 * send (so it would resend the broken qr.io image forever). This
 * route rebuilds the email fresh, from current ticket data, so it
 * picks up the QR fix.
 *
 * Only sends VALID tickets for the session — cancelled/refunded rows
 * (e.g. webhook-double-delivery duplicates) are excluded, so a
 * corrected resend can't hand a buyer more tickets than they
 * actually hold.
 *
 * Auth: shared-secret header, not a real admin role system (there
 * isn't one yet). Set ADMIN_API_SECRET in the environment and pass
 * it as `x-admin-secret`. Tighten this if/when proper staff auth
 * exists.
 *
 * Body: { stripe_checkout_session_id: string }
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret')
  if (!process.env.ADMIN_API_SECRET || secret !== process.env.ADMIN_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const sessionId = body.stripe_checkout_session_id
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'stripe_checkout_session_id is required' }, { status: 400 })
  }

  const admin = createClient()

  const { data: tickets, error } = await admin
    .from('tickets')
    .select(`
      qr_token, buyer_name, buyer_email, amount_paid, event_id,
      ticket_tiers ( name ),
      events (
        title, slug, image_url, event_date, event_start_time, event_end_time,
        auth_user_id, venues ( name, address ), profiles!events_auth_user_id_profile_fkey ( full_name, email )
      )
    `)
    .eq('stripe_checkout_session_id', sessionId)
    .eq('status', 'valid')

  if (error) {
    console.error('[resend-confirmation] db error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  if (!tickets || tickets.length === 0) {
    return NextResponse.json({ error: 'No valid tickets found for that session id' }, { status: 404 })
  }

  const first = tickets[0]
  const ev = Array.isArray(first.events) ? first.events[0] : first.events
  if (!ev) {
    return NextResponse.json({ error: 'Ticket has no associated event' }, { status: 500 })
  }
  const venue = Array.isArray(ev.venues) ? ev.venues[0] : ev.venues
  const creatorProfile = Array.isArray(ev.profiles) ? ev.profiles[0] : ev.profiles

  const amountPaid = tickets.reduce((sum, t) => sum + (parseFloat(t.amount_paid as any) || 0), 0)

  await sendTicketEmail({
    to: first.buyer_email,
    buyerName: first.buyer_name,
    event: {
      title: ev.title,
      slug: ev.slug,
      date: ev.event_date,
      startTime: ev.event_start_time,
      endTime: ev.event_end_time,
      image_url: ev.image_url,
      venueName: venue?.name || null,
      venueAddress: venue?.address || null,
      venueCityState: null,
    },
    tickets: tickets.map((t) => ({
      qr_token: t.qr_token,
      ticket_tier_name: Array.isArray(t.ticket_tiers) ? t.ticket_tiers[0]?.name || 'Ticket' : (t.ticket_tiers as any)?.name || 'Ticket',
    })),
    amountPaid,
    orderRef: sessionId,
    organizerName: creatorProfile?.full_name || null,
    organizerEmail: creatorProfile?.email || null,
  })

  return NextResponse.json({ sent_to: first.buyer_email, ticket_count: tickets.length })
}
