import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'

/**
 * PATCH /api/tickets/manage/[id]
 *
 * Lets a seller correct a ticket's attendee name/email from the
 * dashboard — for typos, or filling in details a walk-up cash buyer
 * gave verbally instead of typing themselves. Ownership is checked
 * via the ticket's event (same access rules as the rest of the
 * ticketing dashboard: event owner, venue owner, or linked artist).
 *
 * Body: { buyer_name?: string, attendee_email?: string | null }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ticketId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const { data: ticket } = await admin
      .from('tickets')
      .select('id, event_id, events!inner ( auth_user_id, venue_id, venues(auth_user_id) )')
      .eq('id', ticketId)
      .maybeSingle()

    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

    const eventRow = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
    let hasAccess = eventRow?.auth_user_id === user.id
    if (!hasAccess) {
      const venue = Array.isArray(eventRow?.venues) ? eventRow.venues[0] : eventRow?.venues
      if (venue?.auth_user_id === user.id) hasAccess = true
    }
    if (!hasAccess) {
      const { data: myArtists } = await admin.from('artists').select('id').eq('auth_user_id', user.id)
      const myArtistIds = (myArtists || []).map((a: any) => a.id)
      if (myArtistIds.length) {
        const { data: link } = await admin
          .from('event_artists')
          .select('artist_id')
          .eq('event_id', ticket.event_id)
          .in('artist_id', myArtistIds)
          .limit(1)
          .maybeSingle()
        if (link) hasAccess = true
      }
    }
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, any> = {}

    if (typeof body.buyer_name === 'string') {
      const name = body.buyer_name.trim()
      if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      updates.buyer_name = name
    }

    if ('attendee_email' in body) {
      const email = body.attendee_email ? String(body.attendee_email).trim() : null
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'That email doesn\'t look valid' }, { status: 400 })
      }
      updates.attendee_email = email ? email.toLowerCase() : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data: updated, error: updateErr } = await admin
      .from('tickets')
      .update(updates)
      .eq('id', ticketId)
      .select('id, buyer_name, attendee_email')
      .single()

    if (updateErr) {
      console.error('[tickets PATCH] update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ticket: updated })
  } catch (err: any) {
    console.error('[tickets PATCH] error:', err)
    return NextResponse.json({ error: err?.message || 'Something went wrong' }, { status: 500 })
  }
}
