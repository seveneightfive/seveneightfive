import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'

function slugify(title: string, date: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return `${base}-${date}`
}

const ALLOWED_FIELDS = [
  'title', 'description', 'event_date', 'start_date', 'end_date',
  'event_start_time', 'event_end_time', 'image_url', 'ticket_price',
  'ticket_url', 'learnmore_link', 'event_types', 'star', 'venue_id',
]

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const safeData: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) safeData[key] = body[key]
  }

  const slug = slugify(body.title || 'event', body.event_date || new Date().toISOString().slice(0, 10))
  safeData.slug = slug
  safeData.auth_user_id = user.id

  const { data, error } = await supabase
    .from('events')
    .insert(safeData)
    .select('id, slug')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id, slug: data.slug })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { eventId, ...updates } = body

  // Verify access: creator, venue owner, or featured artist
  const { data: existing } = await supabase
    .from('events')
    .select('id, auth_user_id, venue_id')
    .eq('id', eventId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  let hasAccess = existing.auth_user_id === user.id
  if (!hasAccess && existing.venue_id) {
    const { data: ownedVenue } = await supabase
      .from('venues').select('id').eq('id', existing.venue_id).eq('auth_user_id', user.id).single()
    hasAccess = !!ownedVenue
  }
  if (!hasAccess) {
    const { data: myArtists } = await supabase.from('artists').select('id').eq('auth_user_id', user.id)
    const myArtistIds = (myArtists || []).map((a: any) => a.id)
    if (myArtistIds.length) {
      const { data: link } = await supabase
        .from('event_artists').select('artist_id').eq('event_id', eventId).in('artist_id', myArtistIds).limit(1).maybeSingle()
      hasAccess = !!link
    }
  }
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const safeData: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in updates) safeData[key] = updates[key]
  }

  // Regenerate slug if title or date changed
  if (updates.title || updates.event_date) {
    const { data: current } = await supabase
      .from('events')
      .select('title, event_date')
      .eq('id', eventId)
      .single()
    const title = updates.title || current?.title || 'event'
    const date = updates.event_date || current?.event_date || new Date().toISOString().slice(0, 10)
    safeData.slug = slugify(title, date)
  }

  const { error } = await supabase
    .from('events')
    .update(safeData)
    .eq('id', eventId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
