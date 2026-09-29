import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdmin } from '@/lib/supabaseServer'

/**
 * PATCH /api/events/[id]/sales-cutoff
 *
 * Sets when ticket sales stop for the whole event (see lib/ticketSalesCutoff.ts).
 * Body: { mode: 'none' | 'offset' | 'custom', offsetMinutes?: number, endsAt?: string | null }
 *
 * Access: event owner, venue owner, or an artist linked to the event —
 * the same people who can open the ticketing dashboard.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdmin()
  const { data: event } = await admin
    .from('events')
    .select('id, auth_user_id, venue_id, venues(auth_user_id)')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  let hasAccess = event.auth_user_id === user.id
  if (!hasAccess) {
    const venue = Array.isArray(event.venues) ? event.venues[0] : (event.venues as any)
    if (venue?.auth_user_id === user.id) hasAccess = true
  }
  if (!hasAccess) {
    const { data: myArtists } = await admin.from('artists').select('id').eq('auth_user_id', user.id)
    const ids = (myArtists || []).map((a: any) => a.id)
    if (ids.length) {
      const { data: link } = await admin
        .from('event_artists').select('artist_id').eq('event_id', eventId).in('artist_id', ids).limit(1).maybeSingle()
      if (link) hasAccess = true
    }
  }
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const mode = body.mode
  if (!['none', 'offset', 'custom'].includes(mode)) {
    return NextResponse.json({ error: 'Pick when ticket sales should stop' }, { status: 400 })
  }

  const updates: Record<string, any> = { ticket_sales_end_mode: mode }
  if (mode === 'offset') {
    const mins = Number(body.offsetMinutes)
    if (!Number.isFinite(mins) || Math.abs(mins) > 7 * 24 * 60) {
      return NextResponse.json({ error: 'That cutoff time is out of range' }, { status: 400 })
    }
    updates.ticket_sales_end_offset_minutes = Math.round(mins)
  }
  if (mode === 'custom') {
    const d = body.endsAt ? new Date(body.endsAt) : null
    if (!d || Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Choose a date and time for sales to stop' }, { status: 400 })
    }
    updates.ticket_sales_end_at = d.toISOString()
  }

  const { data, error } = await admin
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select('ticket_sales_end_mode, ticket_sales_end_offset_minutes, ticket_sales_end_at')
    .single()
  if (error) {
    console.error('[sales-cutoff] update error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
  return NextResponse.json(data)
}
