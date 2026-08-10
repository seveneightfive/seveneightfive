import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabaseServer'
import SurveyClient from './SurveyClient'
import type { SurveyType } from '@/lib/survey'

/**
 * /survey/[token]
 *
 * Public post-show feedback survey. The token itself is the secret (UUID),
 * same shareable-link model as /tickets/[qr_token] — no auth gate.
 */

type Params = { token: string }

export const dynamic = 'force-dynamic'

export default async function SurveyPage({ params }: { params: Promise<Params> }) {
  const { token } = await params

  const admin = createClient()

  const { data: request, error } = await admin
    .from('performance_survey_requests')
    .select(`
      id,
      token,
      survey_type,
      recipient_name,
      recipient_email,
      status,
      completed_at,
      expires_at,
      event_performances (
        id,
        performance_date,
        artists ( id, name, image_url, avatar_url ),
        venues ( id, name, image_url, capacity ),
        events ( id, title, image_url )
      )
    `)
    .eq('token', token)
    .maybeSingle()

  if (error || !request) notFound()

  const surveyType = request.survey_type as SurveyType
  if (surveyType !== 'venue_to_artist' && surveyType !== 'artist_to_venue') notFound()

  const performance = Array.isArray(request.event_performances)
    ? request.event_performances[0]
    : request.event_performances

  if (!performance) notFound()

  const artist = Array.isArray(performance.artists) ? performance.artists[0] : performance.artists
  const venue = Array.isArray(performance.venues) ? performance.venues[0] : performance.venues
  const event = Array.isArray(performance.events) ? performance.events[0] : performance.events

  return (
    <SurveyClient
      token={request.token as string}
      surveyType={surveyType}
      status={request.status ?? 'sent'}
      expiresAt={request.expires_at}
      recipientName={request.recipient_name}
      eventPerformanceId={performance.id}
      performanceDate={performance.performance_date}
      artistName={artist?.name ?? 'the artist'}
      artistImage={artist?.image_url ?? artist?.avatar_url ?? null}
      venueName={venue?.name ?? 'the venue'}
      venueImage={venue?.image_url ?? null}
      eventTitle={event?.title ?? null}
      eventImage={event?.image_url ?? null}
    />
  )
}
