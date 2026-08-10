export type SurveyType = 'venue_to_artist' | 'artist_to_venue'

export type StarQuestion = {
  field: string
  label: string
}

export type SurveyDirectionCopy = {
  eyebrow: string
  welcomeTitle: (opts: { subjectName: string; eventDate: string }) => string
  welcomeSubtitle: string
  recommendationTitle: string
  recommendationField: 'booking_recommendation' | 'would_perform_here_again'
  starTitle: string
  starQuestions: StarQuestion[]
}

// `survey_type` names the direction feedback flows: the recipient is the
// FIRST party, rating the SECOND. venue_to_artist = a venue rating an
// artist who played there (recipient is the venue). artist_to_venue = an
// artist rating a venue they played (recipient is the artist).
export const SURVEY_COPY: Record<SurveyType, SurveyDirectionCopy> = {
  venue_to_artist: {
    eyebrow: 'Venue Feedback',
    welcomeTitle: ({ subjectName, eventDate }) => `How was the show with ${subjectName} on ${eventDate}?`,
    welcomeSubtitle: "Two minutes to help other venues know what to expect. It stays between us and the community.",
    recommendationTitle: 'Would you book them again?',
    recommendationField: 'booking_recommendation',
    starTitle: 'Rate the performance',
    starQuestions: [
      { field: 'communication', label: 'How was communication leading up to the show?' },
      { field: 'professionalism', label: 'How professional were they?' },
      { field: 'performance_quality', label: 'How was the performance quality?' },
      { field: 'audience_response', label: 'How did the audience respond?' },
    ],
  },
  artist_to_venue: {
    eyebrow: 'Artist Feedback',
    welcomeTitle: ({ subjectName, eventDate }) => `How was your experience at ${subjectName} on ${eventDate}?`,
    welcomeSubtitle: "Two minutes to help other artists know what to expect. It stays between us and the community.",
    recommendationTitle: 'Would you perform here again?',
    recommendationField: 'would_perform_here_again',
    starTitle: 'Rate the venue',
    starQuestions: [
      { field: 'communication', label: 'How was communication leading up to the show?' },
      { field: 'hospitality', label: 'How hospitable was the venue?' },
      { field: 'payment', label: 'Was payment handled smoothly?' },
      { field: 'technical_experience', label: 'How was the sound, lights, and tech support?' },
    ],
  },
}

export function formatSurveyDate(dateStr: string | null): string {
  if (!dateStr) return 'the show'
  try {
    const d = new Date(`${dateStr}T00:00:00`)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}
