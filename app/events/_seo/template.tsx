// app/events/_seo/template.tsx
//
// Shared engine behind every crawlable /events/{slug} filter page
// (today, this-weekend, live-music, free, family, etc). Each route folder
// under app/events/ is a thin wrapper that calls buildSeoEventsMetadata()
// and <SeoEventsPage slug="..." /> with its own hardcoded slug — using
// static folders (not a [slug] catch-all) so these never collide with
// the real event-detail route at app/events/[slug]/page.tsx.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EventCard from '@/app/components/EventCard'
import EventListRow from '@/app/components/EventListRow'
import AdvertisementBanner from '@/app/components/AdvertisementBanner'
import {
  getSeoPage,
  getFilteredEvents,
  type SeoPageRow,
  type SeoFilteredEvent,
} from '@/lib/seoEventsFilter'

const SITE_URL = 'https://www.seveneightfive.com'
const ADD_EVENT_URL = 'https://seveneightfive.fillout.com/add-event'

export async function buildSeoEventsMetadata(slug: string): Promise<Metadata> {
  const page = await getSeoPage(slug)
  if (!page) return { title: 'Page Not Found' }

  return {
    title: page.page_title || page.name || 'Events in Topeka',
    description: page.meta_description || undefined,
    alternates: { canonical: `${SITE_URL}/events/${slug}` },
    openGraph: {
      title: page.page_title || page.name || 'Events in Topeka',
      description: page.meta_description || undefined,
      images: page.hero_image_url ? [{ url: page.hero_image_url }] : [],
      type: 'website',
    },
  }
}

function buildEventJsonLd(event: SeoFilteredEvent) {
  const startDate = event.start_date
    || (event.event_start_time ? `${event.event_date}T${event.event_start_time}` : event.event_date)
  const endDate = event.end_date || undefined

  return {
    '@type': 'Event',
    name: event.title,
    startDate,
    ...(endDate && { endDate }),
    url: event.slug ? `${SITE_URL}/events/${event.slug}` : undefined,
    image: event.image_url || undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: event.venue
      ? {
          '@type': 'Place',
          name: event.venue.name,
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Topeka',
            addressRegion: 'KS',
            addressCountry: 'US',
          },
        }
      : {
          '@type': 'Place',
          name: 'Topeka, KS',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Topeka',
            addressRegion: 'KS',
            addressCountry: 'US',
          },
        },
    ...(event.ticket_price !== null && event.ticket_price !== undefined && {
      offers: {
        '@type': 'Offer',
        price: event.ticket_price,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        ...(event.ticket_url && { url: event.ticket_url }),
      },
    }),
  }
}

function buildItemListJsonLd(events: SeoFilteredEvent[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((event, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: buildEventJsonLd(event),
    })),
  }
}

function buildBreadcrumbJsonLd(page: SeoPageRow) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Events', item: `${SITE_URL}/events` },
      { '@type': 'ListItem', position: 2, name: page.name || page.page_title, item: `${SITE_URL}/events/${page.slug}` },
    ],
  }
}

export async function SeoEventsPage({ slug }: { slug: string }) {
  const page = await getSeoPage(slug)
  if (!page) notFound()

  const events = await getFilteredEvents(page)
  const heading = (page.page_title || page.name || 'Events in Topeka').split(' | ')[0]

  // First few events (prioritizing starred/featured ones) anchor the mobile
  // swipeable row; the rest fill the scannable list below. Desktop skips
  // this split entirely and shows one full grid.
  const featured = [...events].sort((a, b) => (b.star ? 1 : 0) - (a.star ? 1 : 0)).slice(0, 4)
  const featuredIds = new Set(featured.map((e) => e.id))
  const rest = events.filter((e) => !featuredIds.has(e.id))

  const itemListJsonLd = events.length > 0 ? buildItemListJsonLd(events) : null
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(page)

  return (
    <>
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-5xl px-5 pb-16 pt-4 sm:px-8">

        {/* HERO — photo band if hero_image_url is set, plain text block if not.
            The "Add event" button sits top-right either way so it's always
            reachable no matter which SEO page someone lands on. */}
        <div className="relative overflow-hidden rounded-xl border border-neutral-200">
          {page.hero_image_url ? (
            <div className="relative h-[170px] sm:h-[220px]">
              <img src={page.hero_image_url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#14110f]/90 via-[#14110f]/20 to-transparent" />
              <div className="absolute inset-x-5 bottom-4 sm:inset-x-8">
                {page.subheading && (
                  <div className="font-['Oswald'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#FFCE03]">
                    {page.subheading}
                  </div>
                )}
                <h1 className="font-['Oswald'] text-2xl font-bold uppercase leading-tight tracking-tight text-white sm:text-4xl">
                  {heading}
                </h1>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-50 px-5 py-6 sm:px-8 sm:py-8">
              {page.subheading && (
                <div className="font-['Oswald'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#C80650]">
                  {page.subheading}
                </div>
              )}
              <h1 className="font-['Oswald'] text-2xl font-bold uppercase leading-tight tracking-tight text-black sm:text-4xl">
                {heading}
              </h1>
            </div>
          )}

          <a
            href={ADD_EVENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-[#C80650] px-3 py-2 font-['Oswald'] text-xs font-bold uppercase tracking-wide text-white shadow-sm sm:right-4 sm:top-4"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add event
          </a>
        </div>

        {page.intro_copy && (
          <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-neutral-700">
            {page.intro_copy}
          </p>
        )}

        {/* Crawlable cross-link back to the hub and to sibling filter pages —
            keeps internal link equity flowing between /events and its
            children instead of dead-ending on a leaf page. */}
        <nav aria-label="Browse other events" className="mt-4 flex flex-wrap gap-2 text-xs">
          <a href="/events" className="rounded-full border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 hover:border-[#C80650] hover:text-[#C80650]">
            ← All Topeka Events
          </a>
        </nav>

        {events.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-neutral-300 py-14 text-center text-neutral-500">
            Nothing matches this yet — check back soon, or{' '}
            <a href={ADD_EVENT_URL} target="_blank" rel="noopener noreferrer" className="text-[#C80650] underline">
              add an event
            </a>.
          </div>
        ) : (
          <>
            {/* MOBILE: swipeable top-picks row */}
            <div className="mt-6 sm:hidden">
              <div className="mb-2 font-['Oswald'] text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                Top picks · swipe
              </div>
              <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
                {featured.map((event) => (
                  <div key={event.id} className="w-[62vw] flex-shrink-0">
                    <EventCard event={event} featured={!!event.star} />
                  </div>
                ))}
              </div>
            </div>

            <div className="my-6">
              <AdvertisementBanner />
            </div>

            {/* MOBILE: dense scannable list for everything else */}
            <div className="sm:hidden">
              {rest.length > 0 && (
                <div className="mb-2 font-['Oswald'] text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                  All events
                </div>
              )}
              {rest.map((event) => (
                <EventListRow key={event.id} event={event} />
              ))}
            </div>

            {/* DESKTOP: one full grid, no split needed at this width */}
            <div className="hidden grid-cols-2 gap-5 sm:grid lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} featured={!!event.star} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  )
}
