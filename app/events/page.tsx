import type { Metadata } from 'next'
import EventsList from './EventsList'

export const metadata: Metadata = {
  title: 'Events in Topeka, KS | seveneightfive',
  description: 'Discover the best events happening in Topeka, Kansas — live music, art shows, community events, local flavor and more.',
  openGraph: {
    title: 'Events in Topeka, KS | seveneightfive',
    description: 'Discover the best events happening in Topeka, Kansas — live music, art shows, community events, local flavor and more.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Events in Topeka, KS | seveneightfive',
    description: 'Discover the best events happening in Topeka, Kansas.',
  },
}

export default function EventsPage() {
  return <EventsList />
}
