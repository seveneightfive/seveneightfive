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

// Real, crawlable HTML links to every filter destination page. This is the
// piece that turns "filters" into an SEO asset: Google can follow each of
// these <a> tags to a fully server-rendered page with its own metadata and
// event listings, instead of only seeing whatever the client-side filter
// UI happens to render after JS runs.
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

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 0' }}>
        <h1
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            lineHeight: 1.15,
            margin: 0,
            color: '#1a1814',
          }}
        >
          Topeka Events &amp; Things to Do
        </h1>
        <p style={{ marginTop: 10, maxWidth: 720, fontSize: 15, lineHeight: 1.5, color: '#4a4640' }}>
          Find upcoming concerts, live music, festivals, art exhibits, theater, comedy, family activities
          and more happening in Topeka, Kansas.
        </p>

        {/* Crawlable browse-by links — real <a> tags, not JS-driven filter
            state, so Google can index each destination independently. */}
        <nav aria-label="Browse events by date and category" style={{ marginTop: 20 }}>
          {BROWSE_LINKS.map((section) => (
            <div key={section.group} style={{ marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#9a948c',
                  marginRight: 10,
                }}
              >
                {section.group}
              </span>
              <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, verticalAlign: 'middle' }}>
                {section.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    style={{
                      display: 'inline-block',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#1a1814',
                      background: '#f2ede6',
                      border: '1px solid #ece8e2',
                      borderRadius: 999,
                      padding: '5px 12px',
                      textDecoration: 'none',
                    }}
                  >
                    {link.label}
                  </a>
                ))}
              </span>
            </div>
          ))}
        </nav>
      </div>

      {/* Full interactive browse/filter experience, seeded with the same
          server-fetched events above so there's real content in the
          initial HTML — not an empty shell waiting on a client fetch. */}
      <EventsList initialEvents={initialEvents as any} />
    </>
  )
}
