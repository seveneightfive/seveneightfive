import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'

const POINTS_FIRST_SUBMISSION_AT_VENUE = 15
const POINTS_ADDITIONAL_SUBMISSION = 5

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { venue_id, title, content, images } = body

  if (!venue_id) {
    return NextResponse.json({ error: 'venue_id is required' }, { status: 400 })
  }
  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
  }

  // Confirm the venue exists before writing anything tied to it.
  const { data: venue } = await supabase
    .from('venues')
    .select('id')
    .eq('id', venue_id)
    .single()
  if (!venue) {
    return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('menu_procs')
    .insert({
      user_id: user.id,
      venue_id,
      title: title || null,
      content: content || null,
      images,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message || 'Could not save submission' }, { status: 500 })
  }

  // Is this the user's first submission at this specific venue? Worth more
  // points than a repeat submission, to reward breadth (visiting/covering
  // new spots) over just posting to the same venue repeatedly.
  const { count: priorCount } = await supabase
    .from('menu_procs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('venue_id', venue_id)
    .neq('id', inserted.id)

  const isFirstAtVenue = (priorCount || 0) === 0
  const pointsToAward = isFirstAtVenue ? POINTS_FIRST_SUBMISSION_AT_VENUE : POINTS_ADDITIONAL_SUBMISSION

  const { data: awarded, error: awardError } = await supabase.rpc('award_points', {
    p_user_id: user.id,
    p_action_type: 'menu_proc_submitted',
    p_points: pointsToAward,
    p_ref_table: 'menu_procs',
    p_ref_id: inserted.id,
  })

  if (awardError) {
    // Submission itself succeeded — don't fail the request over a points
    // logging error, just surface it so it shows up in logs.
    console.error('[menu-proc/create] award_points failed:', awardError.message)
  }

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    points_awarded: awardError ? 0 : (awarded ? pointsToAward : 0),
  })
}
