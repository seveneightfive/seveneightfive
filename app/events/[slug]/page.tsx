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
    ...(event.venue && {
      location: {
        '@type': 'Place',
        name: event.venue.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: event.venue.address,
          addressLocality: event.venue.city || 'Topeka',
          addressRegion: event.venue.state || 'KS',
          addressCountry: 'US',
        },
      },
    }),
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
  const fullDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
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

        /* PAGE WRAP — this is the "use more of the viewport" fix: 680px → 1240px */
        .page-wrap { max-width: 1240px; margin: 0 auto; padding: 40px 32px 0; }

        /* TOP EYEBROW + TITLE (no more dark overlay hero banner) */
        .top-eyebrow { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
        .page-title { font-family: var(--serif); font-size: clamp(2rem, 4.2vw, 3.4rem); font-weight: 700; text-transform: uppercase; line-height: 1.02; letter-spacing: -0.01em; margin-bottom: 14px; }
        .top-date-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 32px; }
        .top-date { font-size: 0.95rem; font-weight: 500; color: var(--ink-soft); }
        .top-today { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); background: var(--accent-light); border: 1px solid rgba(200,6,80,0.25); padding: 4px 10px; border-radius: 100px; }
        .top-star { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: white; background: var(--accent); padding: 4px 10px; border-radius: 100px; }

        /* TWO-COLUMN: image standing alone LEFT, details block RIGHT */
        .event-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 40px; align-items: start; }
        @media (max-width: 900px) {
          .event-grid { grid-template-columns: 1fr; gap: 28px; }
        }

        .event-image-wrap { border-radius: 14px; overflow: hidden; background: var(--off); }
        .event-image-wrap img { display: block; width: 100%; height: auto; aspect-ratio: 4/5; object-fit: cover; }
        .event-image-noimg { aspect-ratio: 4/5; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #2a2620, #1a1814); font-family: var(--serif); font-size: 6rem; font-weight: 700; color: rgba(255,255,255,0.08); }
        @media (max-width: 900px) {
          .event-image-wrap img, .event-image-noimg { aspect-ratio: 16/10; }
        }

        .event-types-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; }
        .hero-type-tag { font-size: 0.66rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); background: var(--accent-light); border: 1px solid rgba(200,6,80,0.2); padding: 4px 11px; border-radius: 100px; }

        /* DETAILS SIDEBAR (right column) */
        .details-col { display: flex; flex-direction: column; gap: 20px; }

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

        /* BIG BLOCK BUTTONS — the Symphony Space "BUY TICKETS" look */
        .btn-stack { display: flex; flex-direction: column; gap: 10px; }
        .btn-block { display: flex; align-items: center; justify-content: center; width: 100%; padding: 17px 20px; border-radius: 8px; font-family: var(--serif); font-size: 0.92rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none; text-align: center; transition: all 0.15s; cursor: pointer; border: 2px solid var(--ink); }
        .btn-block.primary { background: var(--accent); color: white; border-color: var(--accent); }
        .btn-block.primary:hover { background: #a30440; border-color: #a30440; }
        .btn-block.dark { background: var(--ink); color: white; }
        .btn-block.dark:hover { background: #000; }
        .btn-block.outline { background: transparent; color: var(--ink); }
        .btn-block.outline:hover { background: var(--ink); color: white; }

        .util-row { display: flex; gap: 8px; margin-top: 4px; }
        .util-row > * { flex: 1; }

        /* CALLOUT BOXES — Venue / Meet the Artist, replacing "Did You Know" */
        .callout-box { display: flex; gap: 16px; align-items: flex-start; background: var(--warm); border-radius: 14px; padding: 20px; text-decoration: none; color: var(--ink); transition: background 0.15s; }
        .callout-box:hover { background: #ece4d8; }
        .callout-box.artist { background: var(--accent-light); }
        .callout-box.artist:hover { background: #fbe2d8; }
        .callout-badge { width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0; object-fit: cover; background: white; border: 2px solid rgba(0,0,0,0.06); }
        .callout-badge-placeholder { width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0; background: white; border: 2px solid rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 1.3rem; color: var(--ink-faint); }
        .callout-eyebrow { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; }
        .callout-title { font-family: var(--serif); font-size: 1.05rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.2; margin-bottom: 4px; }
        .callout-sub { font-size: 0.85rem; color: var(--ink-soft); line-height: 1.4; }
        .callout-arrow { color: var(--ink-faint); flex-shrink: 0; margin-left: auto; align-self: center; }

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

        {/* TOP: eyebrow + title + date row */}
        <div className="top-eyebrow">
          {[event.venue?.name, categoryLabel].filter(Boolean).join(' / ')}
        </div>
        <h1 className="page-title">{event.title}</h1>
        <div className="top-date-row">
          <span className="top-date">{isToday ? 'Today' : dayOfWeek}, {fullDate}</span>
          {isToday && <span className="top-today">Today</span>}
          {event.star && <span className="top-star">Featured</span>}
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
            {event.event_types && event.event_types.length > 0 && (
              <div className="event-types-row">
                {event.event_types.map(t => <span key={t} className="hero-type-tag">{t}</span>)}
              </div>
            )}
          </div>

          {/* DETAILS COLUMN */}
          <div className="details-col">

            {/* Info card */}
            <div className="info-card">
              <div className="info-grid">

                <div className="info-cell">
                  <div className="info-label">Date</div>
                  <div className="info-value">
                    <strong>{isToday ? 'Today | ' : ''}{dayOfWeek}</strong><br />{fullDate}
                  </div>
                </div>

                <div className="info-cell">
                  <div className="info-label">Time</div>
                  <div className="info-value">
                    {event.event_start_time ? (
                      <>
                        <strong>{formatTime(event.event_start_time)}</strong>
                        {event.event_end_time && ` → ${formatTime(event.event_end_time)}`}
                      </>
                    ) : 'Time TBA'}
                  </div>
                </div>

                {event.venue && (
                  <div className="info-cell">
                    <div className="info-label">Venue</div>
                    <div className="info-value">
                      <strong>{event.venue.name}</strong>
                      {event.venue.neighborhood && (
                        <><br /><span style={{ color: 'var(--ink-faint)', fontSize: '0.88rem' }}>{event.venue.neighborhood}</span></>
                      )}
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

            {/* Buttons — big block style */}
            <div className="btn-stack">
              {event.ticketing_enabled && event.id && event.slug && (
                <TicketPurchaseButton eventId={event.id} eventSlug={event.slug} />
              )}
              {ctaUrl && !event.ticketing_enabled && (
                <a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="btn-block primary">
                  {event.ticket_url ? 'Get Tickets' : 'Learn More'}
                </a>
              )}
              {ctaUrl && event.ticketing_enabled && event.learnmore_link && (
                <a href={event.learnmore_link} target="_blank" rel="noopener noreferrer" className="btn-block outline">
                  Learn More
                </a>
              )}

              <div className="util-row">
                <FollowFavoriteButtons
                  entityType="event"
                  entityId={event.id}
                  showFollow={true}
                  showFavorite={false}
                  className="ffb-light"
                />
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
              </div>
            </div>

            {/* Venue callout — replaces the pink "Did You Know" box */}
            {event.venue && (
              <a
                href={event.venue.slug ? `/venues/${event.venue.slug}` : event.venue.website || '#'}
                target={event.venue.slug ? '_self' : '_blank'}
                rel={event.venue.slug ? undefined : 'noopener noreferrer'}
                className="callout-box"
              >
                {event.venue.logo || event.venue.image_url
                  ? <img src={event.venue.logo ?? event.venue.image_url ?? ''} alt={event.venue.name} className="callout-badge" />
                  : <div className="callout-badge-placeholder">{event.venue.name[0]}</div>
                }
                <div>
                  <div className="callout-eyebrow">Venue</div>
                  <div className="callout-title">{event.venue.name}</div>
                  <div className="callout-sub">
                    {[event.venue.address, event.venue.neighborhood || event.venue.city].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="callout-arrow">→</span>
              </a>
            )}

            {/* Meet The Artist callout(s) */}
            {event.artists.map((artist) => (
              <a
                key={artist.id}
                href={artist.slug ? `/artists/${artist.slug}` : '#'}
                className="callout-box artist"
              >
                {artist.avatar_url
                  ? <img src={artist.avatar_url} alt={artist.name} className="callout-badge" />
                  : <div className="callout-badge-placeholder">{artist.name[0]}</div>
                }
                <div>
                  <div className="callout-eyebrow">Meet the Artist</div>
                  <div className="callout-title">{artist.name}</div>
                  <div className="callout-sub">
                    {artist.tagline || artist.artist_type || 'View full profile'}
                  </div>
                </div>
                <span className="callout-arrow">→</span>
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
