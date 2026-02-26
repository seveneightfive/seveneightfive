import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { eventId, artistId } = await request.json()

  // Verify caller is the artist owner or the event creator
  const [{ data: artistMatch }, { data: eventMatch }] = await Promise.all([
    supabase.from('artists').select('id').eq('id', artistId).eq('auth_user_id', user.id).single(),
    supabase.from('events').select('id').eq('id', eventId).eq('auth_user_id', user.id).single(),
  ])

  if (!artistMatch && !eventMatch) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { error } = await supabase
    .from('event_artists')
    .insert({ event_id: eventId, artist_id: artistId })

  if (error) {
    // Ignore duplicate key errors
    if (error.code === '23505') {
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { eventId, artistId } = await request.json()

  // Verify caller is the artist owner or the event creator
  const [{ data: artistMatch }, { data: eventMatch }] = await Promise.all([
    supabase.from('artists').select('id').eq('id', artistId).eq('auth_user_id', user.id).single(),
    supabase.from('events').select('id').eq('id', eventId).eq('auth_user_id', user.id).single(),
  ])

  if (!artistMatch && !eventMatch) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { error } = await supabase
    .from('event_artists')
    .delete()
    .eq('event_id', eventId)
    .eq('artist_id', artistId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
