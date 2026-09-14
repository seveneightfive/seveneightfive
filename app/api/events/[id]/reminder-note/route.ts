import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdmin } from '@/lib/supabaseServer'

/**
 * PATCH /api/events/[id]/reminder-note
 *
 * Lets the event owner set (or clear) the optional note that gets
 * inserted into the automated 3-days-before reminder email. Body:
 * { note: string | null }. Empty string is normalized to null.
 *
 * Ownership check is owner-only for v1 (event.auth_user_id === user.id) —
 * doesn't yet extend to the venue-owner / linked-artist access paths
 * that the ticketing dashboard itself checks client-side. Worth
 * widening if venue managers or artists need to set this too.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const rawNote = typeof body.note === 'string' ? body.note.trim() : null
  const note = rawNote ? rawNote.slice(0, 1000) : null // generous cap, keeps the email readable

  const admin = createAdmin()

  const { data: event, error: eventError } = await admin
    .from('events')
    .select('id, auth_user_id')
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) {
    console.error('[reminder-note] db error:', eventError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }
  if (event.auth_user_id !== user.id) {
    return NextResponse.json({ error: 'You are not the organizer of this event' }, { status: 403 })
  }

  const { error: updateError } = await admin
    .from('events')
    .update({ reminder_note: note })
    .eq('id', eventId)

  if (updateError) {
    console.error('[reminder-note] update error:', updateError)
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }

  return NextResponse.json({ reminder_note: note })
}
