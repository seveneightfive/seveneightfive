import type { Metadata } from 'next'
import EventsList from './EventsList'
import { getSeoPage, getFilteredEvents } from '@/lib/seoEventsFilter'

const SITE_URL = 'https://www.seveneightfive.com'

export const revalidate = 3600 // re-check Supabase hourly for the SSR seed data

export const metadata: Metadata = {
  title: 'Topeka Events & Things to Do | seveneightfive',
  description: 'Find upcoming concerts, live music, festivals, art exhibits, theater, comedy, family activities and more happening in Topeka, Kansas.',
  alternates: { canonical: `${SITE_URL}/events` },
  openGraph: {
    title: 'Topeka Events & Things to Do | seveneightfive',
    description: 'Find upcoming concerts, live music, festivals, art exhibits, theater, comedy, family activities and more happening in Topeka, Kansas.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Topeka Events & Things to Do | seveneightfive',
    description: 'Find upcoming concerts, live music, festivals, art exhibits, theater, comedy, family activities and more happening in Topeka, Kansas.',
  },
}

// Real, crawlable HTML links to every filter destination page, rendered in
// EventsList's desktop sidebar. The "By Date" group there becomes in-place
// filters (still <a href>s to these pages); the rest link out.
const BROWSE_LINKS: { group: string; links: { href: string; label: string }[] }[] = [
  {
    group: 'By Date',
    links: [
      { href: '/events/today', label: 'Today' },
      { href: '/events/this-weekend', label: 'This Weekend' },
      { href: '/events/this-week', label: 'This Week' },
      { href: '/events/this-month', label: 'This Month' },
    ],
  },
  {
    group: 'By Category',
    links: [
      { href: '/events/live-music', label: 'Live Music' },
      { href: '/events/art', label: 'Art' },
      { href: '/events/theater', label: 'Theater' },
      { href: '/events/comedy', label: 'Comedy' },
      { href: '/events/family', label: 'Family' },
      { href: '/events/karaoke', label: 'Karaoke' },
    ],
  },
  {
    group: 'More',
    links: [
      { href: '/events/free', label: 'Free Events' },
      { href: '/events/first-friday-artwalk', label: 'First Friday Art Walk' },
      { href: '/events/all-events', label: 'All Upcoming Events' },
    ],
  },
]

function buildItemListJsonLd(events: Awaited<ReturnType<typeof getFilteredEvents>>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.slice(0, 30).map((event, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name: event.title,
        startDate: event.start_date
          || (event.event_start_time ? `${event.event_date}T${event.event_start_time}` : event.event_date),
        url: event.slug ? `${SITE_URL}/events/${event.slug}` : undefined,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: event.venue
          ? {
              '@type': 'Place',
              name: event.venue.name,
              address: { '@type': 'PostalAddress', addressLocality: 'Topeka', addressRegion: 'KS', addressCountry: 'US' },
            }
          : {
              '@type': 'Place',
              name: 'Topeka, KS',
              address: { '@type': 'PostalAddress', addressLocality: 'Topeka', addressRegion: 'KS', addressCountry: 'US' },
            },
      },
    })),
  }
}

export default async function EventsPage() {
  // Reuse the same "all-events" seo_pages row (filter_type: date-range,
  // filter_value: upcoming) that /events/all-events itself uses, so the
  // hub page ships with real, server-rendered event data on first load
  // instead of an empty client-only shell.
  const allEventsPage = await getSeoPage('all-events')
  const initialEvents = allEventsPage ? await getFilteredEvents(allEventsPage, 60) : []
  const itemListJsonLd = initialEvents.length > 0 ? buildItemListJsonLd(initialEvents) : null

  return (
    <>
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}

      {/* Layout (desktop sidebar, events bar, right rail) and the H1 all
          live in EventsList now — the sidebar filters in place, so it
          needs EventsList's state. BROWSE_LINKS still feeds its category
          links, which are plain <a href>s in the server-rendered HTML. */}
      <EventsList
        initialEvents={initialEvents as any}
        browseLinks={BROWSE_LINKS}
        heading="Topeka Events & Things to Do"
      />
    </>
  )
}
