import type { Metadata } from 'next'
import { createClient } from '@/lib/supabaseServer'
import LiveMusicClient from './LiveMusicClient'

export const metadata: Metadata = {
  title: 'Live Music Topeka KS | Concerts & Music Events | seveneightfive',
  description: 'Find live music in Topeka, KS — upcoming concerts, local musicians, and the best music venues. Updated daily. The 785 is your guide to live music in Topeka.',
  keywords: ['live music topeka ks', 'topeka concerts', 'topeka live music', 'music venues topeka', 'topeka bands', 'kansas live music'],
  openGraph: {
    title: 'Live Music Topeka KS | Concerts & Music Events | seveneightfive',
    description: 'Find live music in Topeka, KS — upcoming concerts, local musicians, and the best music venues.',
    images: [{ url: 'https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/hero-images/ILove90s-TylerStruck-Web.jpg' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Music Topeka KS | seveneightfive',
    description: 'Find live music in Topeka, KS — upcoming concerts, local musicians, and the best music venues.',
    images: ['https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/hero-images/ILove90s-TylerStruck-Web.jpg'],
  },
  alternates: {
    canonical: 'https://seveneightfive.com/live-music',
  },
}

export default async function LiveMusicPage() {
  const supabase = createClient()
  const today = new Date().toLocaleDateString('en-CA')

  const [
    { data: eventData },
    { data: musicianData },
    { data: venueData },
  ] = await Promise.all([
    supabase
      .from('events')
      .select(`
        id, title, slug, event_date, event_start_time, event_end_time,
        image_url, ticket_price, ticket_url, learnmore_link, event_types, star,
        venues (id, name, slug, neighborhood)
      `)
      .contains('event_types', ['Live Music'])
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .order('event_start_time', { ascending: true }),

    supabase
      .from('artists')
      .select(`
        id, name, slug, tagline, avatar_url, image_url,
        artist_musician_profiles (musical_genres)
      `)
      .eq('artist_type', 'Musician')
      .eq('published', true)
      .order('name'),

    supabase
      .from('venues')
      .select('id, name, slug, address, neighborhood, image_url, logo, venue_type')
      .overlaps('venue_type', ['Live Music', 'Music Venue', 'Bar / Nightclub', 'Concert Venue'])
      .order('name'),
  ])

  const events = (eventData || []).map((e: any) => ({
    ...e,
    venue: Array.isArray(e.venues) ? e.venues[0] || null : e.venues || null,
  }))

  const musicians = (musicianData || []).map((a: any) => ({
    ...a,
    musician_profile: Array.isArray(a.artist_musician_profiles)
      ? a.artist_musician_profiles[0] || null
      : a.artist_musician_profiles || null,
  }))

  // Count upcoming live music events per venue
  const venueEventCounts: Record<string, number> = {}
  for (const event of events) {
    const vid = (event as any).venues?.id || event.venue?.id
    if (vid) venueEventCounts[vid] = (venueEventCounts[vid] || 0) + 1
  }

  const venues = (venueData || []).map((v: any) => ({
    ...v,
    upcoming_count: venueEventCounts[v.id] || 0,
  }))

  return (
    <LiveMusicClient
      initialEvents={events}
      initialMusicians={musicians}
      venues={venues}
    />
  )
}
