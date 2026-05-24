import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'

/**
 * PATCH /api/advertise/:id
 *
 * Edits content fields on an existing ad. Dates, duration, price, and
 * payment status cannot be changed here — those require a new checkout
 * (use the renew flow for that).
 *
 * Only the owner of the ad can edit it (RLS handles enforcement).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { headline, ad_copy, content, ad_image_url, button_text, button_link } = body

  if (!headline || !ad_copy || !button_text || !button_link) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Note: we deliberately do NOT update start_date, end_date, duration,
  // price, payment_status, status, views, clicks, user_id, or created_at.
  // Only mutable content fields.
  const { data, error } = await supabase
    .from('advertisements')
    .update({
      headline,
      ad_copy,
      content: content || null,
      ad_image_url: ad_image_url || null,
      button_text,
      button_link,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)   // belt-and-suspenders alongside RLS
    .select('id')
    .single()

  if (error || !data) {
    console.error('[advertise/edit] error:', error)
    return NextResponse.json({ error: 'Failed to update advertisement' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
