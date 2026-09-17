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

// Real, crawlable HTML links to every filter destination page. Rendered
// twice below (once in the desktop sidebar, once in BrowseHeader's mobile
// "Browse Events" dropdown) from this one array, so both stay in sync and
// neither view is JS-gated — Google's mobile-first indexing sees the same
// links a desktop crawl would, just laid out differently.
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

// Used by the desktop sidebar only now — the mobile equivalent lives inside
// BrowseHeader's dropdown (see EventsList's browseLinks prop), rendered from
// this same BROWSE_LINKS array so both stay in sync.
function BrowseLinksGroups() {
  return (
    <>
      {BROWSE_LINKS.map((section) => (
        <div key={section.group} className="browse-group">
          <div className="browse-group-label">{section.group}</div>
          <div className="browse-group-links">
            {section.links.map((link) => (
              <a key={link.href} href={link.href} className="browse-pill">
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </>
  )
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

      <style>{`
        .events-hub-intro { max-width: 1100px; margin: 0 auto; padding: 24px 24px 0; }
        .events-hub-h1 {
          font-family: 'Oswald', sans-serif; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.02em; font-size: clamp(1.6rem, 4vw, 2.4rem); line-height: 1.15;
          margin: 0; color: #1a1814;
        }

        .browse-group { margin-bottom: 12px; }
        .browse-group:last-child { margin-bottom: 0; }
        .browse-group-label {
          display: block; font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; color: #9a948c; margin-bottom: 8px;
        }
        .browse-group-links { display: flex; flex-wrap: wrap; gap: 8px; }
        .browse-pill {
          display: inline-block; font-size: 13px; font-weight: 600; color: #1a1814;
          background: #f2ede6; border: 1px solid #ece8e2; border-radius: 999px;
          padding: 5px 12px; text-decoration: none;
        }
        .browse-pill:hover { background: #ece5db; }

        /* Desktop: two-column layout — sticky sidebar + main content.
           Below 900px this collapses to a single column (sidebar hidden;
           BrowseHeader's "Browse Events" dropdown covers the same links
           instead) — matches the breakpoint used elsewhere on the site
           (e.g. the event detail page's image/details split) for
           consistency. */
        .events-hub-layout { max-width: 1100px; margin: 0 auto; padding: 20px 24px 0; display: block; }
        .events-hub-sidebar { display: none; }

        @media (min-width: 900px) {
          .events-hub-layout { display: grid; grid-template-columns: 220px 1fr; gap: 32px; align-items: start; padding: 20px 0 0; }
          .events-hub-sidebar { display: block; position: sticky; top: 84px; }
        }
      `}</style>

      <div className="events-hub-intro">
        <h1 className="events-hub-h1">Topeka Events &amp; Things to Do</h1>
      </div>

      <div className="events-hub-layout">
        {/* Desktop only (hidden below 900px via CSS) */}
        <aside className="events-hub-sidebar" aria-label="Browse events by date and category">
          <BrowseLinksGroups />
        </aside>

        <div className="events-hub-main">
          {/* Full interactive browse/filter experience, seeded with the
              same server-fetched events above so there's real content in
              the initial HTML — not an empty shell waiting on a client
              fetch. browseLinks feeds BrowseHeader's mobile dropdown. */}
          <EventsList initialEvents={initialEvents as any} browseLinks={BROWSE_LINKS} />
        </div>
      </div>
    </>
  )
}
