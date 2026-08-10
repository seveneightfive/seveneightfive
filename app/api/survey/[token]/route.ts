import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServer'

/**
 * POST /api/survey/:token
 *
 * Submits a post-show feedback survey. survey_type is looked up from the
 * stored performance_survey_requests row (never trusted from the client)
 * and determines which review table the response lands in:
 *   - venue_to_artist → venue_artist_reviews (venue rating the artist)
 *   - artist_to_venue → artist_venue_reviews (artist rating the venue)
 * Optional photos are attached to event_performance_media with
 * verified_live = true. Marks the request completed on success.
 */

type Params = { token: string }

function clampRating(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : null
}

function clampPercent(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : null
}

export async function POST(request: NextRequest, context: { params: Promise<Params> }) {
  const { token } = await context.params
  const admin = createClient()

  const { data: surveyRequest, error: fetchError } = await admin
    .from('performance_survey_requests')
    .select('id, event_performances_id, survey_type, status, expires_at, recipient_name, recipient_email')
    .eq('token', token)
    .maybeSingle()

  if (fetchError || !surveyRequest) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  }

  if (surveyRequest.status === 'completed') {
    return NextResponse.json({ error: 'This survey has already been submitted' }, { status: 409 })
  }

  if (surveyRequest.expires_at && new Date(surveyRequest.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This survey link has expired' }, { status: 410 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const ratings = (body.ratings ?? {}) as Record<string, unknown>
  const estimatedAttendance = Number.isFinite(Number(body.estimatedAttendance))
    ? Math.max(0, Math.round(Number(body.estimatedAttendance)))
    : null
  const venueCapacityPercent = body.venueCapacityPercent != null ? clampPercent(body.venueCapacityPercent) : null
  const commentsPublic =
    typeof body.commentsPublic === 'string' && body.commentsPublic.trim()
      ? body.commentsPublic.trim().slice(0, 2000)
      : null

  const baseFields = {
    event_performances_id: surveyRequest.event_performances_id,
    reviewer_name: surveyRequest.recipient_name,
    reviewer_email: surveyRequest.recipient_email,
    communication: clampRating(ratings.communication),
    estimated_attendance: estimatedAttendance,
    venue_capacity_percent: venueCapacityPercent,
    comments_public: commentsPublic,
  }

  let insertError
  if (surveyRequest.survey_type === 'venue_to_artist') {
    const { error } = await admin.from('venue_artist_reviews').insert({
      ...baseFields,
      reviewer_role: 'venue',
      professionalism: clampRating(ratings.professionalism),
      performance_quality: clampRating(ratings.performance_quality),
      audience_response: clampRating(ratings.audience_response),
      booking_recommendation: clampRating(body.recommendation),
    })
    insertError = error
  } else if (surveyRequest.survey_type === 'artist_to_venue') {
    const { error } = await admin.from('artist_venue_reviews').insert({
      ...baseFields,
      reviewer_role: 'artist',
      hospitality: clampRating(ratings.hospitality),
      payment: clampRating(ratings.payment),
      technical_experience: clampRating(ratings.technical_experience),
      would_perform_here_again: clampRating(body.recommendation),
    })
    insertError = error
  } else {
    return NextResponse.json({ error: 'Unknown survey type' }, { status: 400 })
  }

  if (insertError) {
    return NextResponse.json({ error: 'Could not save your feedback' }, { status: 500 })
  }

  const photos = Array.isArray(body.photos) ? body.photos : []
  const mediaRows = photos
    .filter((url): url is string => typeof url === 'string' && url.startsWith('https://'))
    .slice(0, 5)
    .map((url) => ({
      event_performances_id: surveyRequest.event_performances_id,
      media_type: 'image',
      media_url: url,
      uploaded_by_name: surveyRequest.recipient_name,
      uploaded_by_email: surveyRequest.recipient_email,
      uploaded_by_type: surveyRequest.survey_type === 'venue_to_artist' ? 'venue' : 'artist',
      verified_live: true,
    }))

  if (mediaRows.length > 0) {
    await admin.from('event_performance_media').insert(mediaRows)
  }

  await admin
    .from('performance_survey_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', surveyRequest.id)

  return NextResponse.json({ success: true })
}
