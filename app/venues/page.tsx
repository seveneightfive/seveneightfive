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
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, slug, address, neighborhood, city, state, image_url, logo, website, venue_type')
    .order('name')
  return <VenuesList initialNeighborhood={params.neighborhood} initialVenues={venues || []} />
}
