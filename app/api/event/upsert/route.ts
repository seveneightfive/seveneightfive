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

  // Verify the event belongs to this auth user
  const { data: existing } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('auth_user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Event not found or access denied' }, { status: 403 })
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
