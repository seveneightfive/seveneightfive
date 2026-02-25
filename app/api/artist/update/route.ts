import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'

export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { artistId, artist, musician_profile, visual_profile } = body

  // Verify the artist belongs to this auth user
  const { data: existing } = await supabase
    .from('artists')
    .select('id')
    .eq('id', artistId)
    .eq('auth_user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Artist not found or access denied' }, { status: 403 })
  }

  // Update main artist record
  const { error: artistError } = await supabase
    .from('artists')
    .update(artist)
    .eq('id', artistId)

  if (artistError) {
    return NextResponse.json({ error: artistError.message }, { status: 500 })
  }

  // Update musician profile if provided
  if (musician_profile) {
    const { data: existing_mp } = await supabase
      .from('artist_musician_profiles')
      .select('artist_id')
      .eq('artist_id', artistId)
      .single()

    if (existing_mp) {
      const { error } = await supabase
        .from('artist_musician_profiles')
        .update(musician_profile)
        .eq('artist_id', artistId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase
        .from('artist_musician_profiles')
        .insert({ ...musician_profile, artist_id: artistId })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Update visual profile if provided
  if (visual_profile) {
    const { data: existing_vp } = await supabase
      .from('artist_visual_profiles')
      .select('artist_id')
      .eq('artist_id', artistId)
      .single()

    if (existing_vp) {
      const { error } = await supabase
        .from('artist_visual_profiles')
        .update(visual_profile)
        .eq('artist_id', artistId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase
        .from('artist_visual_profiles')
        .insert({ ...visual_profile, artist_id: artistId })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
