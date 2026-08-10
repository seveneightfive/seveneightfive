'use client'

import { useState } from 'react'
import SurveyContainer from '@/components/survey/SurveyContainer'
import RatingStars from '@/components/survey/RatingStars'
import RecommendationButtons from '@/components/survey/RecommendationButtons'
import PhotoUploader from '@/components/survey/PhotoUploader'
import SuccessScreen from '@/components/survey/SuccessScreen'
import { SURVEY_COPY, formatSurveyDate, type SurveyType } from '@/lib/survey'

const CAPACITY_OPTIONS = [
  { label: 'Under 25%', value: 15 },
  { label: '25–50%', value: 37 },
  { label: '50–75%', value: 62 },
  { label: '75–100%', value: 87 },
  { label: 'Sold out', value: 100 },
]

const VIBE_OPTIONS = ['🔥 Electric', '😊 Great', '🙂 Good', '😐 Okay', '😴 Quiet']

type Props = {
  token: string
  surveyType: SurveyType
  status: string
  expiresAt: string | null
  recipientName: string | null
  eventPerformanceId: string
  performanceDate: string | null
  artistName: string
  artistImage: string | null
  venueName: string
  venueImage: string | null
  eventTitle: string | null
  eventImage: string | null
}

const THANK_YOU_MESSAGE =
  'Thank you, your feedback helps strengthen the local music community.'

export default function SurveyClient({
  token,
  surveyType,
  status,
  expiresAt,
  recipientName,
  eventPerformanceId,
  performanceDate,
  artistName,
  artistImage,
  venueName,
  venueImage,
  eventTitle,
  eventImage,
}: Props) {
  const copy = SURVEY_COPY[surveyType]
  const isVenueReviewing = surveyType === 'venue_to_artist'
  const subjectName = isVenueReviewing ? artistName : venueName
  const subjectImage = isVenueReviewing ? (artistImage ?? eventImage) : (venueImage ?? eventImage)
  const eventDate = formatSurveyDate(performanceDate)

  const alreadyExpired = !!expiresAt && new Date(expiresAt) < new Date()

  const [screen, setScreen] = useState(0)
  const [recommendation, setRecommendation] = useState<number | null>(null)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [attendance, setAttendance] = useState('')
  const [capacityPercent, setCapacityPercent] = useState<number | null>(null)
  const [vibe, setVibe] = useState<string | null>(null)
  const [comments, setComments] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const TOTAL_STEPS = 4 // recommendation, ratings, details, photos

  if (status === 'completed') {
    return (
      <SurveyContainer step={0} totalSteps={TOTAL_STEPS}>
        <SuccessScreen message="You've already shared your feedback for this show. Thanks again!" />
      </SurveyContainer>
    )
  }

  if (alreadyExpired) {
    return (
      <SurveyContainer step={0} totalSteps={TOTAL_STEPS}>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="font-display text-2xl font-semibold text-white">This link has expired</h1>
          <p className="mt-3 max-w-xs text-base text-white/70">
            Survey links are only valid for 30 days after the show. Reach out if you&apos;d still like to share feedback.
          </p>
        </div>
      </SurveyContainer>
    )
  }

  const allRated = copy.starQuestions.every((q) => ratings[q.field])

  const submit = async () => {
    setSubmitting(true)
    setSubmitError('')

    const publicComments = [
      vibe ? `Crowd energy: ${vibe.replace(/^\S+\s/, '')}.` : null,
      comments.trim() || null,
    ]
      .filter(Boolean)
      .join(' ')

    try {
      const res = await fetch(`/api/survey/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendation,
          ratings,
          estimatedAttendance: attendance ? Number(attendance) : null,
          venueCapacityPercent: capacityPercent,
          commentsPublic: publicComments || null,
          photos,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Something went wrong')
      }

      setScreen(5)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Screen 5: Success ──────────────────────────────────────────────
  if (screen === 5) {
    return (
      <SurveyContainer step={0} totalSteps={TOTAL_STEPS}>
        <SuccessScreen message={THANK_YOU_MESSAGE} />
      </SurveyContainer>
    )
  }

  return (
    <SurveyContainer step={screen} totalSteps={TOTAL_STEPS} onBack={screen > 0 ? () => setScreen((s) => s - 1) : undefined}>
      {/* ── Screen 0: Welcome ── */}
      {screen === 0 && (
        <div className="flex flex-1 flex-col">
          <div className="flex-1">
            {subjectImage && (
              <div className="mt-4 aspect-square w-full overflow-hidden rounded-3xl bg-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={subjectImage} alt={subjectName} className="h-full w-full object-cover" />
              </div>
            )}

            <div className="mt-6 inline-flex items-center rounded-full bg-accent-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-black">
              {copy.eyebrow}
            </div>

            <h1 className="mt-4 font-display text-3xl font-semibold leading-tight text-white">
              {copy.welcomeTitle({ subjectName, eventDate })}
            </h1>

            {eventTitle && <p className="mt-2 text-sm text-white/50">{eventTitle}</p>}

            <p className="mt-4 text-base leading-relaxed text-white/70">{copy.welcomeSubtitle}</p>

            {recipientName && (
              <p className="mt-6 text-sm text-white/40">Hi {recipientName} 👋</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setScreen(1)}
            className="mt-6 w-full rounded-2xl bg-brand-600 py-4 text-center text-lg font-semibold text-white shadow-lg transition-transform active:scale-[0.98]"
          >
            Let&apos;s go
          </button>
        </div>
      )}

      {/* ── Screen 1: Would you do it again ── */}
      {screen === 1 && (
        <div className="flex flex-1 flex-col justify-center">
          <h2 className="mb-8 text-center font-display text-2xl font-semibold text-white">
            {copy.recommendationTitle}
          </h2>
          <RecommendationButtons
            value={recommendation}
            onChange={(v) => {
              setRecommendation(v)
              setTimeout(() => setScreen(2), 300)
            }}
          />
        </div>
      )}

      {/* ── Screen 2: Ratings ── */}
      {screen === 2 && (
        <div className="flex flex-1 flex-col">
          <h2 className="mb-6 text-center font-display text-2xl font-semibold text-white">{copy.starTitle}</h2>
          <div className="flex flex-1 flex-col gap-7">
            {copy.starQuestions.map((q) => (
              <div key={q.field} className="rounded-2xl bg-white/5 p-4">
                <p className="mb-3 text-center text-sm font-medium text-white/85">{q.label}</p>
                <RatingStars value={ratings[q.field] || 0} onChange={(v) => setRatings((r) => ({ ...r, [q.field]: v }))} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setScreen(3)}
            disabled={!allRated}
            className="mt-6 w-full rounded-2xl bg-brand-600 py-4 text-center text-lg font-semibold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-30"
          >
            Continue
          </button>
        </div>
      )}

      {/* ── Screen 3: Optional details ── */}
      {screen === 3 && (
        <div className="flex flex-1 flex-col">
          <h2 className="mb-1 text-center font-display text-2xl font-semibold text-white">A few more details</h2>
          <p className="mb-6 text-center text-sm text-white/50">All optional — skip anything you&apos;d rather not answer.</p>

          <div className="flex flex-col gap-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/85">How many people attended?</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={attendance}
                onChange={(e) => setAttendance(e.target.value)}
                placeholder="e.g. 120"
                className="w-full rounded-xl border-2 border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-accent-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/85">How full was the venue?</label>
              <div className="flex flex-wrap gap-2">
                {CAPACITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCapacityPercent(capacityPercent === opt.value ? null : opt.value)}
                    className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors ${
                      capacityPercent === opt.value
                        ? 'border-accent-500 bg-accent-500 text-black'
                        : 'border-white/15 text-white/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/85">How was the crowd?</label>
              <div className="flex flex-wrap gap-2">
                {VIBE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setVibe(vibe === opt ? null : opt)}
                    className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors ${
                      vibe === opt ? 'border-accent-500 bg-accent-500 text-black' : 'border-white/15 text-white/70'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/85">Anything else you&apos;d like to share?</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                placeholder="Optional"
                className="w-full resize-none rounded-xl border-2 border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-accent-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setScreen(4)}
            className="mt-8 w-full rounded-2xl bg-brand-600 py-4 text-center text-lg font-semibold text-white shadow-lg transition-transform active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      )}

      {/* ── Screen 4: Photo upload ── */}
      {screen === 4 && (
        <div className="flex flex-1 flex-col">
          <h2 className="mb-1 text-center font-display text-2xl font-semibold text-white">Got a photo from the show?</h2>
          <p className="mb-6 text-center text-sm text-white/50">Optional — help others see what they missed.</p>

          <PhotoUploader
            eventPerformanceId={eventPerformanceId}
            photos={photos}
            onAdd={(url) => setPhotos((p) => [...p, url])}
            onRemove={(url) => setPhotos((p) => p.filter((u) => u !== url))}
          />

          {submitError && <p className="mt-4 text-center text-sm text-brand-400">{submitError}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="mt-8 w-full rounded-2xl bg-brand-600 py-4 text-center text-lg font-semibold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit feedback'}
          </button>
        </div>
      )}
    </SurveyContainer>
  )
}
