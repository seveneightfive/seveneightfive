import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdmin } from '@/lib/supabaseServer'

/**
 * POST /api/tickets/validate
 *
 * Validates a ticket by QR token and marks it as used.
 * The authenticated user must be the creator of the event the ticket belongs to.
 *
 * Body: { qr_token: string }
 *
 * Returns:
 *   200 { checked_in: true, ticket: {...} }   — just checked in
 *   200 { checked_in: false, ticket: {...} }  — already used (with details)
 *   400  missing qr_token
 *   401  not authenticated
 *   403  not the event owner
 *   404  ticket not found
 *   422  ticket refunded / invalid
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { qr_token } = body

  if (!qr_token || typeof qr_token !== 'string') {
    return NextResponse.json({ error: 'qr_token is required' }, { status: 400 })
  }

  const admin = createAdmin()

  // Look up the ticket by QR token, join event info to check ownership
  const { data: ticket, error } = await admin
    .from('tickets')
    .select(`
      id, status, payment_status, amount_paid, buyer_name, buyer_email,
      created_at, qr_token,
      ticket_tiers ( name ),
      events ( id, title, event_date, auth_user_id )
    `)
    .eq('qr_token', qr_token)
    .maybeSingle()

  if (error) {
    console.error('[validate] db error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  // Verify this user owns the event
  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
  if (!event || event.auth_user_id !== user.id) {
    return NextResponse.json({ error: 'You are not the organizer of this event' }, { status: 403 })
  }

  // Refunded tickets can't be used
  if (ticket.status === 'refunded' || ticket.payment_status === 'refunded') {
    return NextResponse.json({ error: 'Ticket has been refunded', ticket: formatTicket(ticket) }, { status: 422 })
  }

  // Already checked in
  if (ticket.status === 'used') {
    return NextResponse.json({ checked_in: false, already_used: true, ticket: formatTicket(ticket) }, { status: 200 })
  }

  // Mark as used
  const { error: updateError } = await admin
    .from('tickets')
    .update({ status: 'used' })
    .eq('id', ticket.id)

  if (updateError) {
    console.error('[validate] update error:', updateError)
    return NextResponse.json({ error: 'Failed to check in ticket' }, { status: 500 })
  }

  return NextResponse.json({ checked_in: true, ticket: formatTicket(ticket) }, { status: 200 })
}

function formatTicket(ticket: any) {
  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
  const tier = Array.isArray(ticket.ticket_tiers) ? ticket.ticket_tiers[0] : ticket.ticket_tiers
  return {
    id: ticket.id,
    buyer_name: ticket.buyer_name || 'Guest',
    buyer_email: ticket.buyer_email,
    tier_name: tier?.name || null,
    event_title: event?.title || null,
    event_date: event?.event_date || null,
    amount_paid: ticket.amount_paid,
    status: ticket.status,
    purchased_at: ticket.created_at,
  }
}
