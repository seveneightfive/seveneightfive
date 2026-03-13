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
  ticket_url: string | null
  venue: { name: string; neighborhood: string | null } | { name: string; neighborhood: string | null }[] | null
}

export default async function HomePage() {
  const now = new Date()

  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const today = todayStart.toISOString().split('T')[0]

  const tomorrowEnd = new Date(now)
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)
  const tomorrow = tomorrowEnd.toISOString().split('T')[0]

  // Run all queries in parallel
  const [
    { data: events },
    { data: upcomingEventIds },
    { data: featuredRaw },
    { data: notoVenues },
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
        ticket_url,
        venue:venues ( name, neighborhood )
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

    // 3. Featured (starred) upcoming events for the hero slider
    supabase
      .from('events')
      .select('id, title, event_date, event_start_time, event_types, slug, image_url, ticket_url, venues ( name, neighborhood )')
      .eq('star', true)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(6),

    // 4. NOTO neighborhood venues
    supabase
      .from('venues')
      .select('id')
      .eq('neighborhood', 'NOTO'),
  ])

  // Count upcoming events at NOTO venues
  const notoVenueIds = (notoVenues ?? []).map((v) => v.id)
  const { count: notoEventCount } = notoVenueIds.length > 0
    ? await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .in('venue_id', notoVenueIds)
        .gte('event_date', today)
    : { count: 0 }

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

  // 4. Fetch full artist details — prefer event-linked artists, fall back to verified/published
  let artists: any[] = []
  if (topArtistIds.length > 0) {
    const { data } = await supabase
      .from('artists')
      .select('id, name, slug, tagline, artist_type, avatar_url, image_url')
      .in('id', topArtistIds)
      .eq('published', true)
    artists = data ?? []
  }

  // Fallback: if event_artists join returned nothing, show verified published artists
  if (artists.length === 0) {
    const { data } = await supabase
      .from('artists')
      .select('id, name, slug, tagline, artist_type, avatar_url, image_url')
      .eq('published', true)
      .eq('verified', true)
      .order('name')
      .limit(8)
    artists = data ?? []
  }

  // Final fallback: any published artists
  if (artists.length === 0) {
    const { data } = await supabase
      .from('artists')
      .select('id, name, slug, tagline, artist_type, avatar_url, image_url')
      .eq('published', true)
      .order('name')
      .limit(8)
    artists = data ?? []
  }

  // Re-attach the count and restore sort order
  const sortedArtists = artists
    .map((artist) => ({
      ...artist,
      upcomingCount: countMap[artist.id] ?? 0,
    }))
    .sort((a, b) => b.upcomingCount - a.upcomingCount)

  const normalizedEvents = (events as EventRow[] ?? []).map((e) => ({
    ...e,
    venue: Array.isArray(e.venue) ? e.venue[0] ?? null : e.venue,
  }))

  const featuredEvents = (featuredRaw ?? []).map((e: any) => ({
    ...e,
    venue: Array.isArray(e.venues) ? e.venues[0] ?? null : e.venues ?? null,
  }))

  return (
    <HomeClient
      events={normalizedEvents}
      artists={sortedArtists}
      featuredEvents={featuredEvents}
      notoVenueCount={notoVenueIds.length}
      notoEventCount={notoEventCount ?? 0}
    />
  )
}
