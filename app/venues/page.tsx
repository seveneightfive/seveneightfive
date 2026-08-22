import type { Metadata } from 'next'
import VenuesList from './VenuesList'
import { createClient } from '@/lib/supabaseServer'

export const metadata: Metadata = {
  title: 'Venues in Topeka, KS | seveneightfive',
  description: 'Explore venues in Topeka, Kansas — galleries, music venues, theaters, bars, and more.',
  openGraph: {
    title: 'Venues in Topeka, KS | seveneightfive',
    description: 'Explore venues in Topeka, KS — galleries, music venues, theaters, bars, and more.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Venues in Topeka, KS | seveneightfive',
    description: 'Explore venues in Topeka, KS.',
  },
}

export default async function VenuesPage({ searchParams }: { searchParams: Promise<{ neighborhood?: string }> }) {
  const params = await searchParams
  const supabase = createClient()

  const today = new Date().toLocaleDateString('en-CA')

  const [{ data: venues }, { data: upcomingEvents }] = await Promise.all([
    supabase
      .from('venues')
      .select('id, name, slug, description, address, neighborhood, city, state, image_url, logo, website, venue_type')
      .order('name'),
    supabase
      .from('events')
      .select('venue_id')
      .gte('event_date', today)
      .not('venue_id', 'is', null),
  ])

  // Tally upcoming events per venue once, server-side, instead of an N+1
  // query per card.
  const counts: Record<string, number> = {}
  for (const row of upcomingEvents || []) {
    counts[row.venue_id] = (counts[row.venue_id] || 0) + 1
  }
  const venuesWithCounts = (venues || []).map(v => ({ ...v, upcoming_events_count: counts[v.id] || 0 }))

  return <VenuesList initialNeighborhood={params.neighborhood} initialVenues={venuesWithCounts} />
}
