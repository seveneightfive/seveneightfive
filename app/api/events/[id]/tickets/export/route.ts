import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'

/**
 * GET /api/events/[id]/tickets/export
 *
 * Seller-only CSV export of paid tickets for an event. Standard buyer
 * columns first, then one column per distinct custom question label
 * that has at least one answer recorded for this event.
 */
function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const { data: eventRow } = await admin
      .from('events')
      .select('id, title, slug, auth_user_id, venue_id, venues(auth_user_id)')
      .eq('id', eventId)
      .maybeSingle()

    if (!eventRow) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    let hasAccess = eventRow.auth_user_id === user.id
    if (!hasAccess) {
      const venue = Array.isArray(eventRow.venues) ? eventRow.venues[0] : eventRow.venues
      if (venue?.auth_user_id === user.id) hasAccess = true
    }
    if (!hasAccess) {
      const { data: myArtists } = await admin
        .from('artists')
        .select('id')
        .eq('auth_user_id', user.id)
      const myArtistIds = (myArtists || []).map((a: any) => a.id)
      if (myArtistIds.length) {
        const { data: link } = await admin
          .from('event_artists')
          .select('artist_id')
          .eq('event_id', eventId)
          .in('artist_id', myArtistIds)
          .limit(1)
          .maybeSingle()
        if (link) hasAccess = true
      }
    }
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: tickets, error: ticketsErr } = await admin
      .from('tickets')
      .select(`
        id, buyer_name, buyer_email, buyer_phone, attendee_email, amount_paid, status,
        payment_status, created_at, source, notes, ticket_tiers(name)
      `)
      .eq('event_id', eventId)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: true })

    if (ticketsErr) {
      console.error('[tickets/export] tickets query error:', ticketsErr)
      return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 })
    }

    const ticketIds = (tickets || []).map((t) => t.id)

    let responsesByTicket: Record<string, Record<string, string>> = {}
    let questionLabels: string[] = []

    if (ticketIds.length > 0) {
      const { data: responses } = await admin
        .from('event_registration_responses')
        .select('ticket_id, response, event_form_fields(label)')
        .in('ticket_id', ticketIds)

      const labelSet = new Set<string>()
      for (const r of responses || []) {
        const label = Array.isArray(r.event_form_fields)
          ? r.event_form_fields[0]?.label
          : (r.event_form_fields as any)?.label
        if (!label) continue
        labelSet.add(label)
        responsesByTicket[r.ticket_id] = responsesByTicket[r.ticket_id] || {}
        // If the same label appears twice for a ticket (shouldn't normally
        // happen), keep the most recent — insertion order from the query
        // above is by created_at asc on tickets, not responses, so this
        // is just a defensive last-write-wins.
        responsesByTicket[r.ticket_id][label] = r.response
      }
      questionLabels = Array.from(labelSet)
    }

    const headers = [
      'Name', 'Email', 'Attendee Email', 'Phone', 'Tier', 'Amount Paid', 'Status', 'Source', 'Notes', 'Purchased At',
      ...questionLabels,
    ]

    const rows = (tickets || []).map((t) => {
      const tierName = Array.isArray(t.ticket_tiers) ? t.ticket_tiers[0]?.name : (t.ticket_tiers as any)?.name
      const answers = responsesByTicket[t.id] || {}
      return [
        t.buyer_name || '',
        t.buyer_email || '',
        t.attendee_email || '',
        t.buyer_phone || '',
        tierName || '',
        t.amount_paid != null ? Number(t.amount_paid).toFixed(2) : '0.00',
        t.status || '',
        t.source || 'online',
        t.notes || '',
        t.created_at ? new Date(t.created_at).toISOString() : '',
        ...questionLabels.map((label) => answers[label] || ''),
      ]
    })

    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(','))
      .join('\r\n')

    const filename = `${eventRow.slug || 'event'}-attendees.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    console.error('[tickets/export] error:', err)
    return NextResponse.json({ error: err?.message || 'Export failed' }, { status: 500 })
  }
}
