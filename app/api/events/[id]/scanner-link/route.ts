import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'

/**
 * GET /api/events/[id]/scanner-link
 *
 * Returns the event's active volunteer check-in link, creating one on
 * first request if none exists yet. This is what /dashboard/events/[id]/tickets
 * displays under "Door Check-In" — sellers share the returned URL with
 * staff; anyone with the link can search and check in tickets without
 * needing an account (see /api/checkin/[token]).
 */
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

    // Ownership check — same pattern as /api/events/[id]/form-fields
    const { data: eventRow } = await admin
      .from('events')
      .select('id, slug, auth_user_id, venue_id, venues(auth_user_id)')
      .eq('id', eventId)
      .maybeSingle()

    if (!eventRow) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    let hasAccess = eventRow.auth_user_id === user.id
    if (!hasAccess) {
      const venue = Array.isArray(eventRow.venues) ? eventRow.venues[0] : eventRow.venues
      if (venue?.auth_user_id === user.id) hasAccess = true
    }
    if (!hasAccess) {
      const { data: myArtists } = await admin.from('artists').select('id').eq('auth_user_id', user.id)
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

    let { data: existing } = await admin
      .from('event_scanner_links')
      .select('token')
      .eq('event_id', eventId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!existing) {
      const token = randomBytes(24).toString('base64url')
      const { data: created, error: createErr } = await admin
        .from('event_scanner_links')
        .insert({ event_id: eventId, token, label: 'Door staff', created_by: user.id })
        .select('token')
        .single()

      if (createErr || !created) {
        console.error('[scanner-link] create error:', createErr)
        return NextResponse.json({ error: 'Failed to create check-in link' }, { status: 500 })
      }
      existing = created
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://seveneightfive.com'
    const url = `${siteUrl}/events/${eventRow.slug}/checkin?token=${existing.token}`

    return NextResponse.json({ url, token: existing.token })
  } catch (err: any) {
    console.error('[scanner-link] error:', err)
    return NextResponse.json({ error: err?.message || 'Something went wrong' }, { status: 500 })
  }
}
