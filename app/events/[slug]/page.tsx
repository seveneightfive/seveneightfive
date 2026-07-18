import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ImageLightbox from './ImageLightbox'
import TicketPurchaseButton from '@/app/components/TicketPurchaseButton'
import FollowFavoriteButtons from '@/app/components/FollowFavoriteButtons'
import AddToCalendar from './AddToCalendar'
import ShareButtons from './ShareButtons'
import EventPageViewLogger from './EventPageViewLogger'

// ─── Types ────────────────────────────────────────────────────────────────────

type Venue = {
  id: string
  name: string
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  slug: string | null
  website: string | null
  image_url: string | null
  logo: string | null
}

type Artist = {
  id: string
  name: string
  slug: string | null
  avatar_url: string | null
  artist_type: string | null
  tagline?: string | null
}

type Event = {
  id: string
  title: string
  description: string | null
  event_date: string
  event_start_time: string | null
  event_end_time: string | null
  end_date: string | null
  image_url: string | null
  ticket_price: number | null
  ticket_url: string | null
  learnmore_link: string | null
  event_types: string[] | null
  star: boolean | null
  slug: string | null
  capacity: number | null
  ticketing_enabled: boolean | null
  venue: Venue | null
  artists: Artist[]
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getEvent(slug: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      id, title, description, event_date, event_start_time, event_end_time,
      end_date, image_url, ticket_price, ticket_url, learnmore_link,
      event_types, star, slug, capacity, ticketing_enabled, venue_id,
      venues (id, name, address, neighborhood, city, state, slug, website, image_url, logo),
      event_artists (
        display_order,
        role,
        artists (id, name, slug, avatar_url, artist_type, tagline)
      )
    `)
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  return {
    ...data,
    venue: Array.isArray(data.venues) ? data.venues[0] || null : (data.venues as any) || null,
    artists: (data.event_artists || [])
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((ea: any) => Array.isArray(ea.artists) ? ea.artists[0] : ea.artists)
      .filter(Boolean),
  } as Event
}

// "Also in [Category]" — same event_type(s) as this event.
async function getCategoryEvents(currentId: string, eventTypes: string[] | null): Promise<Event[]> {
  if (!eventTypes || eventTypes.length === 0) return []

  const { data } = await supabase
    .from('events')
    .select(`
      id, title, slug, event_date, event_start_time, image_url, event_types,
      venues (id, name, address, neighborhood, city, state, slug, website, image_url, logo)
    `)
    .neq('id', currentId)
    .gte('event_date', new Date().toISOString().split('T')[0])
    .overlaps('event_types', eventTypes)
    .order('event_date', { ascending: true })
    .limit(3)

  if (!data) return []
  return data.map((e: any) => ({
    ...e,
    venue: Array.isArray(e.venues) ? e.venues[0] || null : e.venues || null,
    artists: [],
  })) as Event[]
}

// "You May Also Like" — same venue first, then same artist(s), excluding
// anything already shown in the "Also in [Category]" feed above so the two
// rows don't repeat the same event.
async function getYouMayAlsoLike(
  currentId: string,
  venueId: string | null,
  artistIds: string[],
  excludeIds: string[]
): Promise<Event[]> {
  const seen = new Set([currentId, ...excludeIds])
  const results: any[] = []
  const today = new Date().toISOString().split('T')[0]
  const cols = `
    id, title, slug, event_date, event_start_time, image_url, event_types,
    venues (id, name, address, neighborhood, city, state, slug, website, image_url, logo)
  `

  if (venueId) {
    const { data } = await supabase
      .from('events')
      .select(cols)
      .eq('venue_id', venueId)
      .neq('id', currentId)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(5)

    for (const e of data || []) {
      if (!seen.has(e.id) && results.length < 3) {
        seen.add(e.id)
        results.push(e)
      }
    }
  }

  if (results.length < 3 && artistIds.length > 0) {
    const { data: links } = await supabase
      .from('event_artists')
      .select('event_id')
      .in('artist_id', artistIds)

    const candidateIds = Array.from(new Set((links || []).map((l: any) => l.event_id)))
      .filter((id) => !seen.has(id))

    if (candidateIds.length > 0) {
      const { data } = await supabase
        .from('events')
        .select(cols)
        .in('id', candidateIds)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(5)

      for (const e of data || []) {
        if (!seen.has(e.id) && results.length < 3) {
          seen.add(e.id)
          results.push(e)
        }
      }
    }
  }

  return results.map((e: any) => ({
    ...e,
    venue: Array.isArray(e.venues) ? e.venues[0] || null : e.venues || null,
    artists: [],
  })) as Event[]
}

// ─── SEO ──────────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const event = await getEvent(slug)
  if (!event) return { title: 'Event Not Found' }

  const d = new Date(event.event_date + 'T12:00:00')
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const description = event.description || `${event.title} | ${dateStr}${event.venue ? ` at ${event.venue.name}` : ''} in Topeka, KS`

  return {
    title: `${event.title} | The 785`,
    description,
    alternates: { canonical: `https://seveneightfive.com/events/${event.slug}` },
    openGraph: {
      title: event.title,
      description,
      images: event.image_url ? [{ url: event.image_url }] : [],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description,
      images: event.image_url ? [event.image_url] : [],
    },
  }
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

const SCHEMA_TYPE_MAP: Record<string, string> = {
  'Live Music':           'MusicEvent',
  'Art':                  'VisualArtsEvent',
  'Exhibition':           'ExhibitionEvent',
  'Comedy Night':         'ComedyEvent',
  'Poetry Reading':       'LiteraryEvent',
  'Open Mic':             'LiteraryEvent',
  'Theater':              'TheaterEvent',
  'Dance':                'DanceEvent',
  'Film / Screening':     'ScreeningEvent',
  'Workshop / Class':     'EducationEvent',
  'Holiday':              'Festival',
  'Party For A Cause':    'SocialEvent',
}

function getJsonLd(event: Event) {
  const startDate = event.event_start_time
    ? `${event.event_date}T${event.event_start_time}`
    : event.event_date

  const endDate = event.event_end_time
    ? `${event.event_date}T${event.event_end_time}`
    : event.end_date || undefined

  const schemaType = event.event_types
    ?.map(t => SCHEMA_TYPE_MAP[t])
    .find(t => !!t) || 'Event'

  return {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: event.title,
    description: event.description,
    url: `https://seveneightfive.com/events/${event.slug}`,
    startDate,
    ...(endDate && { endDate }),
    image: event.image_url,
    ...(event.event_types && event.event_types.length > 0 && {
      keywords: event.event_types.join(', '),
    }),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    // Required by Google whenever eventAttendanceMode is offline — this used
    // to be conditional on event.venue, which is why ~42 events with no
    // venue_id set were showing up in Search Console as "Missing field
    // location." Falling back to a generic Topeka, KS Place (no venue name)
    // keeps every event's markup valid even before a venue gets attached.
    location: event.venue
      ? {
          '@type': 'Place',
          name: event.venue.name,
          address: {
            '@type': 'PostalAddress',
            streetAddress: event.venue.address,
            addressLocality: event.venue.city || 'Topeka',
            addressRegion: event.venue.state || 'KS',
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
    ...(event.ticket_price !== null && {
      offers: {
        '@type': 'Offer',
        price: event.ticket_price,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        ...(event.ticket_url && { url: event.ticket_url }),
        validFrom: event.event_date,
      },
    }),
    ...(event.artists && event.artists.length > 0 && {
      performer: event.artists.map(a => ({
        '@type': 'Person',
        name: a.name,
        ...(a.slug && { url: `https://seveneightfive.com/artists/${a.slug}` }),
      })),
    }),
    organizer: {
      '@type': 'Organization',
      name: 'seveneightfive',
      url: 'https://seveneightfive.com',
    },
  }
}

function getBreadcrumbJsonLd(event: Event) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Events', item: 'https://seveneightfive.com/events' },
      { '@type': 'ListItem', position: 2, name: event.title, item: `https://seveneightfive.com/events/${event.slug}` },
    ],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(t: string | null): string {
  if (!t || t.trim() === ':') return ''
  const ampmMatch = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i)
  if (ampmMatch) {
    const h = parseInt(ampmMatch[1], 10)
    const m = parseInt(ampmMatch[2], 10)
    const ampm = ampmMatch[3].toUpperCase()
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
  }
  const match = t.match(/(\d{1,2}):(\d{2})/)
  if (!match) return ''
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

function renderInline(text: string): React.ReactNode[] {
  const TOKEN_RE =
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(https?:\/\/[^\s<>"]+)|(\bwww\.[^\s<>"]+)/g

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyCounter = 0

  const pushPlain = (segment: string) => {
    if (!segment) return
    const lines = segment.split('\n')
    lines.forEach((line, i) => {
      if (line) nodes.push(line)
      if (i < lines.length - 1) {
        nodes.push(<br key={`br-${keyCounter++}`} />)
      }
    })
  }

  while ((match = TOKEN_RE.exec(text)) !== null) {
    pushPlain(text.slice(lastIndex, match.index))

    const [token, email, urlHttp, urlWww] = match
    if (email) {
      nodes.push(
        <a
          key={`a-${keyCounter++}`}
          href={`mailto:${email}`}
          title={email}
          className="desc-link"
        >
          {email}
        </a>
      )
    } else {
      let displayUrl = (urlHttp || urlWww)
      let trailing = ''
      const trailingMatch = displayUrl.match(/[.,;:!?)\]}'"]+$/)
      if (trailingMatch) {
        trailing = trailingMatch[0]
        displayUrl = displayUrl.slice(0, -trailing.length)
      }
      const href = urlHttp ? displayUrl : `https://${displayUrl}`
      nodes.push(
        <a
          key={`a-${keyCounter++}`}
          href={href}
          title={href}
          target="_blank"
          rel="noopener noreferrer"
          className="desc-link"
        >
          {displayUrl}
        </a>
      )
      if (trailing) nodes.push(trailing)
    }

    lastIndex = match.index + token.length
  }

  pushPlain(text.slice(lastIndex))

  return nodes
}

function renderDescription(text: string): React.ReactNode {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const paragraphs = normalized.split(/\n{2,}/)

  return paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => <p key={i}>{renderInline(p)}</p>)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEvent(slug)
  if (!event) notFound()

  const categoryEvents = await getCategoryEvents(event.id, event.event_types)
  const alsoLikeEvents = await getYouMayAlsoLike(
    event.id,
    event.venue?.id ?? null,
    event.artists.map((a) => a.id),
    categoryEvents.map((e) => e.id)
  )

  const jsonLd = getJsonLd(event)
  const breadcrumbJsonLd = getBreadcrumbJsonLd(event)
  const d = new Date(event.event_date + 'T12:00:00')
  const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' })
  const isToday = d.toDateString() === new Date().toDateString()
  const ctaUrl = event.ticket_url || event.learnmore_link
  const categoryLabel = event.event_types?.[0] || null

  return (
    <>
      <EventPageViewLogger slug={slug} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #8a847d;
          --white: #ffffff; --off: #f7f6f4; --warm: #f2ede6;
          --accent: #c80650; --accent-light: #fdf1ec; --border: #ece8e2;
          --gold: #FFCE03;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--white); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

        /* PAGE WRAP */
        .page-wrap { max-width: 1240px; margin: 0 auto; padding: 0 24px 0; }

        /* FADED HERO BAND — viewport-relative, not a fixed px height.
           back-link/hero-bottom align with the centered 1240px content
           column via calc()/max() directly, rather than an inner wrapper
           div — a wrapper relying on height:100% turned out fragile and
           caused the whole title/date/back-link block to disappear. */
        .hero-band { position: relative; height: clamp(160px, 30vh, 320px); overflow: hidden; width: 100vw; margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw); margin-bottom: 28px; }
        .hero-band img { width: 100%; height: 100%; object-fit: cover; opacity: 0.32; display: block; }
        .hero-fade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, var(--white) 94%); }
        .back-link { position: absolute; z-index: 2; left: max(24px, calc((100vw - 1240px) / 2 + 24px)); top: 20px; display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; font-weight: 600; color: var(--ink); background: var(--white); border: 1px solid var(--border); padding: 7px 14px; border-radius: 100px; text-decoration: none; }
        .back-link:hover { border-color: var(--ink); }

        .hero-bottom { position: absolute; z-index: 2; left: max(24px, calc((100vw - 1240px) / 2 + 24px)); right: max(24px, calc((100vw - 1240px) / 2 + 24px)); bottom: 22px; display: flex; align-items: flex-end; gap: 18px; }
        .hero-bottom__text { min-width: 0; }
        .date-badge { background: var(--ink); color: white; border-radius: 8px; padding: 9px 14px; text-align: center; min-width: 66px; flex-shrink: 0; }
        .date-badge .dow { font-size: 0.64rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.65; }
        .date-badge .day { font-family: var(--serif); font-size: 1.6rem; font-weight: 700; line-height: 1.05; }
        .date-badge .mon { font-size: 0.64rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.65; }
        .top-eyebrow { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; }
        .page-title { font-family: var(--serif); font-size: clamp(1.5rem, 3vw, 2.3rem); font-weight: 700; text-transform: uppercase; line-height: 1.05; letter-spacing: -0.01em; }
        @media (max-width: 640px) {
          .back-link, .hero-bottom { left: 20px; }
          .hero-bottom { right: 20px; }
        }

        /* TWO-COLUMN: image standing alone LEFT, details block RIGHT */
        .event-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 40px; align-items: start; }
        @media (max-width: 900px) {
          .event-grid { grid-template-columns: 1fr; gap: 28px; }
        }

        .event-image-wrap { position: relative; border-radius: 14px; overflow: hidden; background: var(--off); }
        .event-image-noimg { position: relative; aspect-ratio: 4/5; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #2a2620, #1a1814); font-family: var(--serif); font-size: 6rem; font-weight: 700; color: rgba(255,255,255,0.08); }
        @media (max-width: 900px) {
          .event-image-noimg { aspect-ratio: 16/10; }
        }

        .event-types-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
        .hero-type-tag { font-size: 0.66rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); background: var(--accent-light); border: 1px solid rgba(200,6,80,0.2); padding: 4px 11px; border-radius: 100px; text-decoration: none; transition: background 0.15s; }
        .hero-type-tag:hover { background: rgba(200,6,80,0.18); }

        /* DETAILS SIDEBAR (right column) */
        .details-col { display: flex; flex-direction: column; gap: 20px; }

        .time-box { background: var(--off); border-radius: 14px; padding: 18px 22px; font-family: var(--serif); font-size: clamp(1.4rem, 2.4vw, 1.9rem); font-weight: 700; color: var(--ink); letter-spacing: -0.01em; }
        .time-box__sep { margin: 0 10px; color: var(--ink-faint); font-weight: 400; }

        .info-card { background: var(--off); border-radius: 14px; overflow: hidden; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; }
        .info-cell { padding: 20px 22px; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); }
        .info-cell:nth-child(even) { border-right: none; }
        .info-cell:nth-last-child(-n+2) { border-bottom: none; }
        .info-cell.full { grid-column: span 2; border-right: none; }
        .info-label { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 6px; }
        .info-value { font-size: 1.05rem; color: var(--ink); font-weight: 400; line-height: 1.45; }
        .info-value strong { font-weight: 600; }

        /* ARTIST ROW (inside info card, if kept there) */
        .artist-row { display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; padding: 4px 0; }
        .artist-row + .artist-row { border-top: 1px solid var(--border); padding-top: 10px; margin-top: 6px; }
        .artist-avatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: var(--border); }
        .artist-avatar-placeholder { width: 38px; height: 38px; border-radius: 50%; background: var(--border); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 0.95rem; color: var(--ink-faint); flex-shrink: 0; }
        .artist-info { flex: 1; min-width: 0; }
        .artist-name { font-weight: 600; font-size: 0.98rem; }
        .artist-type { font-size: 0.78rem; color: var(--ink-faint); margin-top: 1px; }
        .artist-arrow { color: var(--ink-faint); flex-shrink: 0; }

        /* TICKET ROW — its own full-width line, room for TicketPurchaseButton's dropdown */
        .ticket-row { width: 100%; }
        .btn-block { display: flex; align-items: center; justify-content: center; width: 100%; padding: 15px 18px; border-radius: 8px; font-family: var(--serif); font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; text-decoration: none; text-align: center; transition: all 0.15s; cursor: pointer; border: none; background: var(--accent); color: white; }
        .btn-block:hover { background: #a30440; }
        .btn-block.outline { background: transparent; color: var(--ink); border: 2px solid var(--ink); }
        .btn-block.outline:hover { background: var(--ink); color: white; }

        /* FOLLOW ROW — small, on its own, not part of the 50/50 grid below */
        .follow-row { display: flex; }

        /* ACTION ROW — Calendar + Share, even 50/50 split */
        .action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

        /* VENUE CARD — full-height image like the artist card, black bg */
        .venue-card { display: flex; align-items: stretch; overflow: hidden; border-radius: 14px; background: #14110f; text-decoration: none; color: white; transition: background 0.15s; }
        .venue-card:hover { background: #201b17; }
        .venue-card-img { width: 110px; flex-shrink: 0; object-fit: contain; align-self: stretch; background: rgba(255,255,255,0.06); padding: 8px; box-sizing: border-box; }
        .venue-card-img-placeholder { width: 110px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 1.8rem; color: var(--gold); background: rgba(255,255,255,0.08); }
        .venue-card-body { padding: 16px 20px; display: flex; flex-direction: column; justify-content: center; gap: 3px; min-width: 0; }
        .venue-card-eyebrow { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
        .venue-card-name { font-family: var(--serif); font-size: 1.25rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em; line-height: 1.15; color: white; }
        .venue-card-address { font-size: 0.85rem; color: white; opacity: 0.85; }
        .venue-card-neighborhood { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--gold); margin-top: 2px; }

        /* ARTIST FEATURE CARD — same pattern, light gray bg instead of off-white/pink */
        .artist-card { display: flex; align-items: stretch; overflow: hidden; border-radius: 14px; background: var(--off); text-decoration: none; color: var(--ink); transition: background 0.15s; }
        .artist-card:hover { background: #ece8e2; }
        .artist-card-img { width: 110px; flex-shrink: 0; object-fit: cover; align-self: stretch; background: var(--border); }
        .artist-card-img-placeholder { width: 110px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 1.8rem; color: var(--accent); background: var(--border); }
        .artist-card-body { padding: 16px 20px; display: flex; flex-direction: column; justify-content: center; gap: 3px; min-width: 0; }
        .artist-card-eyebrow { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-soft); }
        .artist-card-name { font-family: var(--serif); font-size: 1.25rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em; line-height: 1.15; }
        .artist-card-type { font-size: 0.88rem; color: var(--ink-soft); }

        /* Circular arrow-only button, far right of both card types — no
           label text, matches the plain chevron-in-a-circle reference */
        .card-arrow { flex-shrink: 0; align-self: center; margin: 0 18px 0 8px; width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid currentColor; display: flex; align-items: center; justify-content: center; opacity: 0.75; transition: opacity 0.15s, transform 0.15s; }
        .venue-card:hover .card-arrow, .artist-card:hover .card-arrow { opacity: 1; transform: translateX(3px); }

        /* DESCRIPTION */
        .section { padding: 48px 0; border-top: 1px solid var(--border); }
        .section-heading { font-family: var(--serif); font-size: 1.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em; margin-bottom: 20px; }
        .description-text { font-size: 1.1rem; font-weight: 300; line-height: 1.85; color: var(--ink); max-width: 760px; }
        .description-text p + p { margin-top: 16px; }
        .description-text .desc-link { color: var(--accent); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; word-break: break-word; transition: opacity 0.15s; }
        .description-text .desc-link:hover { opacity: 0.7; }

        /* RELATED FEEDS — two separate rows */
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .section-header .section-heading { margin-bottom: 0; }
        .see-all-link { font-size: 0.76rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); text-decoration: none; transition: opacity 0.15s; }
        .see-all-link:hover { opacity: 0.75; }

        .related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 780px) {
          .related-grid { grid-template-columns: 1fr; }
        }
        .related-card { display: block; border-radius: 12px; overflow: hidden; background: var(--off); text-decoration: none; color: var(--ink); transition: transform 0.15s, box-shadow 0.15s; }
        .related-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,0.08); }
        .related-card-img { width: 100%; aspect-ratio: 16/10; object-fit: cover; background: var(--border); }
        .related-card-img-placeholder { width: 100%; aspect-ratio: 16/10; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 2rem; color: var(--ink-faint); background: var(--border); }
        .related-card-body { padding: 14px 16px 18px; }
        .related-card-type { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin-bottom: 5px; }
        .related-card-title { font-family: var(--serif); font-weight: 700; text-transform: uppercase; font-size: 1rem; line-height: 1.25; margin-bottom: 6px; }
        .related-card-meta { font-size: 0.8rem; color: var(--ink-faint); }

        /* BROWSE CTA */
        .browse-cta { padding: 40px 0 8px; text-align: center; border-top: 1px solid var(--border); }
        .browse-cta-link { display: inline-flex; align-items: center; gap: 8px; font-family: var(--serif); font-size: 0.85rem; font-weight: 400; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); text-decoration: none; transition: color 0.15s; }
        .browse-cta-link em { font-style: normal; color: var(--accent); font-weight: 600; }
        .browse-cta-link:hover { color: var(--ink); }

        .event-footer { padding: 20px 32px 56px; text-align: center; max-width: 1240px; margin: 0 auto; }
        .footer-brand { font-family: var(--serif); font-size: 0.76rem; font-weight: 400; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); text-decoration: none; }
        .footer-brand em { font-style: normal; color: var(--accent); font-weight: 600; }
        .footer-brand:hover { color: var(--ink); }

        @media (max-width: 640px) {
          .page-wrap { padding: 28px 20px 0; }
          .event-footer { padding: 16px 20px 48px; }
          .btn-block { width: 100%; }
        }
      `}</style>

      <main className="page-wrap">

        {/* FADED HERO BAND */}
        <div className="hero-band">
          {event.image_url && <img src={event.image_url} alt="" />}
          <div className="hero-fade" />
          <a href="/events" className="back-link">← All Events</a>
          <div className="hero-bottom">
            <div className="date-badge">
              <div className="dow">{dayOfWeek.slice(0, 3)}</div>
              <div className="day">{d.getDate()}</div>
              <div className="mon">{d.toLocaleDateString('en-US', { month: 'short' })}</div>
            </div>
            <div className="hero-bottom__text">
              <div className="top-eyebrow">
                {[event.venue?.name, categoryLabel].filter(Boolean).join(' / ')}
              </div>
              <h1 className="page-title">{event.title}</h1>
              {(isToday || event.star) && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  {isToday && <span className="top-today">Today</span>}
                  {event.star && <span className="top-star">Featured</span>}
                </div>
              )}
              {event.event_types && event.event_types.length > 0 && (
                <div className="event-types-row">
                  {event.event_types.map(t => (
                    <a key={t} href={`/events?type=${encodeURIComponent(t)}`} className="hero-type-tag">{t}</a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TWO COLUMN: image left, details right */}
        <div className="event-grid">

          {/* IMAGE — standing alone */}
          <div>
            <div className="event-image-wrap">
              {event.image_url
                ? <ImageLightbox src={event.image_url} alt={event.title} />
                : <div className="event-image-noimg">{event.title[0]}</div>
              }
            </div>
          </div>

          {/* DETAILS COLUMN */}
          <div className="details-col">

            {/* Time — big and bold on its own, not squeezed into the grid */}
            <div className="time-box">
              {event.event_start_time ? (
                <>
                  {formatTime(event.event_start_time)}
                  {event.event_end_time && <span className="time-box__sep">–</span>}
                  {event.event_end_time && formatTime(event.event_end_time)}
                </>
              ) : 'Time TBA'}
            </div>

            {/* Info card */}
            <div className="info-card">
              <div className="info-grid">

                {event.venue && (
                  <div className="info-cell">
                    <div className="info-label">Venue</div>
                    <div className="info-value">
                      <strong>{event.venue.name}</strong>
                    </div>
                  </div>
                )}

                {event.capacity && (
                  <div className="info-cell">
                    <div className="info-label">Capacity</div>
                    <div className="info-value">{event.capacity.toLocaleString()} guests</div>
                  </div>
                )}

              </div>
            </div>

            {/* Ticket box — its own line, full width, since TicketPurchaseButton's
                dropdown (tier selection, quantity, checkout) needs real room and
                was getting cramped squeezed next to the Follow/Calendar/Share icons */}
            <div className="ticket-row">
              {event.ticketing_enabled && event.id && event.slug ? (
                <TicketPurchaseButton eventId={event.id} eventSlug={event.slug} />
              ) : ctaUrl ? (
                <a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="btn-block">
                  {event.ticket_url ? 'Get Tickets' : 'Learn More'}
                </a>
              ) : null}
            </div>

            {/* Follow — its own small row, not part of the 50/50 grid below */}
            <div className="follow-row">
              <FollowFavoriteButtons
                entityType="event"
                entityId={event.id}
                heartOnly
                className="ffb-light"
              />
            </div>
            {/* NOTE: heartOnly's default styling (ffb-heart-btn) assumes a
                dark background — it uses white-ish borders/icon strokes
                meant to sit over a photo. Here it's sitting on the light
                --off sidebar background instead, so this may need its own
                light-mode variant added inside FollowFavoriteButtons.tsx
                (similar to how ffb-light already overrides the pill-style
                Follow button) rather than relying on the className alone —
                check how it actually looks once rendered. */}

            {/* Calendar + Share — even 50/50 split, same width as the boxes above */}
            <div className="action-row">
              <AddToCalendar
                title={event.title}
                date={event.event_date}
                startTime={event.event_start_time}
                endTime={event.event_end_time}
                endDate={event.end_date}
                venueName={event.venue?.name ?? null}
                venueAddress={event.venue?.address ?? null}
                description={event.description}
                slug={event.slug ?? event.id}
              />
              <ShareButtons
                title={event.title}
                description={event.description}
              />
              {/* NOTE: couldn't fetch AddToCalendar.tsx to check its internal
                  button markup — GitHub's API was returning 503s while
                  building this. It's dropped in here as-is; if its default
                  size/shape doesn't sit well next to Share, send a
                  screenshot and I'll true up the sizing. */}
            </div>

            {/* Venue callout — black bg, full-height image like the artist card */}
            {event.venue && (
              <a
                href={event.venue.slug ? `/venues/${event.venue.slug}` : event.venue.website || '#'}
                target={event.venue.slug ? '_self' : '_blank'}
                rel={event.venue.slug ? undefined : 'noopener noreferrer'}
                className="venue-card"
              >
                {event.venue.logo || event.venue.image_url
                  ? <img src={event.venue.logo ?? event.venue.image_url ?? ''} alt={event.venue.name} className="venue-card-img" />
                  : <div className="venue-card-img-placeholder">{event.venue.name[0]}</div>
                }
                <div className="venue-card-body">
                  <div className="venue-card-eyebrow">Venue</div>
                  <div className="venue-card-name">{event.venue.name}</div>
                  {event.venue.address && (
                    <div className="venue-card-address">{event.venue.address}</div>
                  )}
                  {event.venue.neighborhood && (
                    <div className="venue-card-neighborhood">{event.venue.neighborhood}</div>
                  )}
                </div>
                <div className="card-arrow"><ArrowIcon /></div>
              </a>
            )}

            {/* Meet The Artist callout(s) */}
            {event.artists.map((artist) => (
              <a
                key={artist.id}
                href={artist.slug ? `/artists/${artist.slug}` : '#'}
                className="artist-card"
              >
                {artist.avatar_url
                  ? <img src={artist.avatar_url} alt={artist.name} className="artist-card-img" />
                  : <div className="artist-card-img-placeholder">{artist.name[0]}</div>
                }
                <div className="artist-card-body">
                  <div className="artist-card-eyebrow">Meet the Artist</div>
                  <div className="artist-card-name">{artist.name}</div>
                  {artist.artist_type && (
                    <div className="artist-card-type">{artist.artist_type}</div>
                  )}
                </div>
                <div className="card-arrow"><ArrowIcon /></div>
              </a>
            ))}

          </div>
        </div>

        {/* DESCRIPTION */}
        {event.description && (
          <div className="section">
            <div className="section-heading">Description</div>
            <div className="description-text">
              {renderDescription(event.description)}
            </div>
          </div>
        )}

        {/* ALSO IN [CATEGORY] */}
        {categoryEvents.length > 0 && (
          <div className="section">
            <div className="section-header">
              <div className="section-heading">
                {categoryLabel ? `Also in ${categoryLabel}` : 'Related Events'}
              </div>
              <a href="/events" className="see-all-link">See All →</a>
            </div>
            <div className="related-grid">
              {categoryEvents.map((rel) => (
                <RelatedCard key={rel.id} event={rel} />
              ))}
            </div>
          </div>
        )}

        {/* YOU MAY ALSO LIKE */}
        {alsoLikeEvents.length > 0 && (
          <div className="section">
            <div className="section-header">
              <div className="section-heading">You May Also Like</div>
              <a href="/events" className="see-all-link">See All →</a>
            </div>
            <div className="related-grid">
              {alsoLikeEvents.map((rel) => (
                <RelatedCard key={rel.id} event={rel} />
              ))}
            </div>
          </div>
        )}

        {/* BROWSE ALL CTA */}
        <div className="browse-cta">
          <a href="/events" className="browse-cta-link">
            Browse all events on <em>seveneightfive</em> →
          </a>
        </div>

      </main>

      <footer className="event-footer">
        <a href="/events" className="footer-brand">
          <em>seveneightfive</em> magazine
        </a>
      </footer>
    </>
  )
}

// ─── Related event card ───────────────────────────────────────────────────────

function ArrowIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: '-2px', marginLeft: '2px' }}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  )
}

function RelatedCard({ event: rel }: { event: Event }) {
  const relDate = new Date(rel.event_date + 'T12:00:00')
  const relDateStr = relDate.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  })

  return (
    <a href={`/events/${rel.slug}`} className="related-card">
      {rel.image_url
        ? <img src={rel.image_url} alt={rel.title} className="related-card-img" />
        : <div className="related-card-img-placeholder">{rel.title[0]}</div>
      }
      <div className="related-card-body">
        {rel.event_types && rel.event_types.length > 0 && (
          <div className="related-card-type">{rel.event_types[0]}</div>
        )}
        <div className="related-card-title">{rel.title}</div>
        <div className="related-card-meta">
          {relDateStr}{rel.venue ? ` · ${rel.venue.name}` : ''}
        </div>
      </div>
    </a>
  )
}
