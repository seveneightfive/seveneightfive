import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@/lib/supabaseServer'

/**
 * POST /api/checkin/[token]
 *
 * Powers the volunteer-facing /events/[slug]/checkin page. Volunteers
 * don't have accounts, so this can't run under normal Supabase RLS
 * (which requires auth.uid() to match the event owner via
 * can_manage_event()). Instead, access is gated by a random per-event
 * scanner token (event_scanner_links) that the seller generates and
 * shares — this route validates the token, then uses the admin client
 * to actually query/write.
 *
 * Body: { action: 'info' | 'search' | 'checkin', ... }
 *   info:    {}                                    → { eventId, eventTitle }
 *   search:  { query: string }                      → { results: TicketResult[] }
 *   checkin: { ticketId: string, staffName: string } → { ok: true, ticket }
 */

type TicketResult = {
  id: string
  qr_token: string
  buyer_name: string | null
  buyer_email: string
  attendee_email: string | null
  tier_name: string
  payment_status: string
  checked_in: boolean
  checked_in_at: string | null
  match_type: 'qr' | 'id' | 'name' | 'email'
}

async function validateToken(admin: ReturnType<typeof createAdminClient>, token: string) {
  const { data: link } = await admin
    .from('event_scanner_links')
    .select('id, event_id, revoked_at, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!link) return { valid: false as const, error: 'This check-in link is invalid.' }
  if (link.revoked_at) return { valid: false as const, error: 'This check-in link has been revoked.' }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { valid: false as const, error: 'This check-in link has expired.' }
  }

  return { valid: true as const, eventId: link.event_id, linkId: link.id }
}

function mapTicket(t: any, matchType: TicketResult['match_type']): TicketResult {
  const tierName = Array.isArray(t.ticket_tiers) ? t.ticket_tiers[0]?.name : t.ticket_tiers?.name
  const checkIns = Array.isArray(t.check_ins) ? t.check_ins : []
  return {
    id: t.id,
    qr_token: t.qr_token,
    buyer_name: t.buyer_name,
    buyer_email: t.buyer_email,
    attendee_email: t.attendee_email,
    tier_name: tierName || 'Ticket',
    payment_status: t.payment_status,
    checked_in: checkIns.length > 0,
    checked_in_at: checkIns[0]?.checked_in_at || null,
    match_type: matchType,
  }
}

const TICKET_SELECT = `
  id, qr_token, buyer_name, buyer_email, attendee_email, payment_status,
  ticket_tiers ( name ),
  check_ins ( checked_in_at )
`

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = createAdminClient()

  const validation = await validateToken(admin, token)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 403 })
  }
  const { eventId, linkId } = validation

  const body = await request.json().catch(() => ({}))
  const action = body?.action

  if (action === 'info') {
    const { data: event } = await admin.from('events').select('id, title').eq('id', eventId).single()
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    return NextResponse.json({ eventId: event.id, eventTitle: event.title })
  }

  if (action === 'search') {
    const query = String(body?.query || '').trim()
    if (!query) return NextResponse.json({ results: [] })

    // Try QR token exact match first, then ticket id, then attendee
    // email, then buyer name — first non-empty match wins, same
    // priority order as the original implementation plus email.
    let { data: byQr } = await admin
      .from('tickets')
      .select(TICKET_SELECT)
      .eq('event_id', eventId)
      .eq('qr_token', query)
      .maybeSingle()
    if (byQr) return NextResponse.json({ results: [mapTicket(byQr, 'qr')] })

    const { data: byId } = await admin
      .from('tickets')
      .select(TICKET_SELECT)
      .eq('event_id', eventId)
      .ilike('id', `%${query}%`)
      .limit(10)
    if (byId?.length) return NextResponse.json({ results: byId.map((t) => mapTicket(t, 'id')) })

    if (query.includes('@')) {
      const { data: byEmail } = await admin
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('event_id', eventId)
        .or(`buyer_email.ilike.%${query}%,attendee_email.ilike.%${query}%`)
        .limit(10)
      if (byEmail?.length) return NextResponse.json({ results: byEmail.map((t) => mapTicket(t, 'email')) })
    }

    const { data: byName } = await admin
      .from('tickets')
      .select(TICKET_SELECT)
      .eq('event_id', eventId)
      .ilike('buyer_name', `%${query}%`)
      .limit(10)

    return NextResponse.json({ results: (byName || []).map((t) => mapTicket(t, 'name')) })
  }

  if (action === 'checkin') {
    const ticketId = String(body?.ticketId || '')
    const staffName = String(body?.staffName || '').trim()
    if (!ticketId || !staffName) {
      return NextResponse.json({ error: 'ticketId and staffName are required' }, { status: 400 })
    }

    const { data: ticket } = await admin
      .from('tickets')
      .select(TICKET_SELECT)
      .eq('id', ticketId)
      .eq('event_id', eventId)
      .maybeSingle()

    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

    const alreadyCheckedIn = Array.isArray((ticket as any).check_ins) && (ticket as any).check_ins.length > 0
    if (alreadyCheckedIn) {
      return NextResponse.json({ error: 'Already checked in', ticket: mapTicket(ticket, 'id') }, { status: 409 })
    }

    const { error: insertErr } = await admin
      .from('check_ins')
      .insert([{ ticket_id: ticketId, checked_in_by_name: staffName }])

    if (insertErr) {
      console.error('[checkin] insert error:', insertErr)
      return NextResponse.json({ error: 'Check-in failed' }, { status: 500 })
    }

    await admin.from('event_scanner_links').update({ last_used_at: new Date().toISOString() }).eq('id', linkId)

    return NextResponse.json({ ok: true, ticket: mapTicket({ ...ticket, check_ins: [{ checked_in_at: new Date().toISOString() }] }, 'id') })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
