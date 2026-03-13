import type { Metadata } from 'next'
import VenuesList from './VenuesList'

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
  return <VenuesList initialNeighborhood={params.neighborhood} />
}
