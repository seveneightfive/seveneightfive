import { supabase } from '@/lib/supabase'
import HomeClient from './HomeClient'

export const revalidate = 3600

type EventRow = {
  id: string
  title: string
  event_date: string
  event_start_time: string | null
  event_end_time: string | null
  ticket_price: number | null
  event_types: string[] | null
  slug: string | null
  star: boolean | null
  image_url: string | null
  venue: { name: string } | { name: string }[] | null
}

export default async function HomePage() {
  const now = new Date()

  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const today = todayStart.toISOString().split('T')[0]

  const tomorrowEnd = new Date(now)
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)
  const tomorrow = tomorrowEnd.toISOString().split('T')[0]

  // Run all three queries in parallel
  const [
    { data: events },
    { data: upcomingEventIds },
  ] = await Promise.all([

    // 1. Events for today + tomorrow for the home page list
    supabase
      .from('events')
      .select(`
        id,
        title,
        event_date,
        event_start_time,
        event_end_time,
        ticket_price,
        event_types,
        slug,
        star,
        image_url,
        venue:venues ( name )
      `)
      .in('event_date', [today, tomorrow])
      .order('event_date', { ascending: true })
      .order('event_start_time', { ascending: true })
      .limit(10),

    // 2. Get all upcoming event IDs (from today onwards) for artist ranking
    supabase
      .from('events')
      .select('id')
      .gte('event_date', today),
  ])

  // 3. Get artist_ids from event_artists for those upcoming event IDs
  const eventIdList = (upcomingEventIds ?? []).map((e) => e.id)

  const { data: eventArtistLinks } = eventIdList.length > 0
    ? await supabase
        .from('event_artists')
        .select('artist_id')
        .in('event_id', eventIdList)
    : { data: [] }

  // Count upcoming events per artist
  const countMap: Record<string, number> = {}
  for (const link of eventArtistLinks ?? []) {
    countMap[link.artist_id] = (countMap[link.artist_id] ?? 0) + 1
  }

  // Get top 8 artist IDs sorted by count
  const topArtistIds = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id)

  // 4. Fetch full artist details for those top artists
  const { data: artists } = topArtistIds.length > 0
    ? await supabase
        .from('artists')
        .select('id, name, slug, tagline, artist_type, avatar_url, image_url')
        .in('id', topArtistIds)
        .eq('published', true)
    : { data: [] }

  // Re-attach the count and restore sort order
  const sortedArtists = (artists ?? [])
    .map((artist) => ({
      ...artist,
      upcomingCount: countMap[artist.id] ?? 0,
    }))
    .sort((a, b) => b.upcomingCount - a.upcomingCount)

  const normalizedEvents = (events as EventRow[] ?? []).map((e) => ({
    ...e,
    venue: Array.isArray(e.venue) ? e.venue[0] ?? null : e.venue,
  }))

  return <HomeClient events={normalizedEvents} artists={sortedArtists} />
}
