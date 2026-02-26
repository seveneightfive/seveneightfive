import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'

const ALLOWED_FIELDS = [
  'name', 'address', 'neighborhood', 'city', 'state',
  'website', 'venue_type', 'image_url',
]

export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { venueId, updates } = body

  // Verify the venue belongs to this auth user
  const { data: existing } = await supabase
    .from('venues')
    .select('id')
    .eq('id', venueId)
    .eq('auth_user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Venue not found or access denied' }, { status: 403 })
  }

  // Whitelist fields
  const safeUpdates: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in updates) safeUpdates[key] = updates[key]
  }

  const { error } = await supabase
    .from('venues')
    .update(safeUpdates)
    .eq('id', venueId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
