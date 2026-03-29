import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import BackButton from './BackButton'
import ImageLightbox from './ImageLightbox'
import TicketPurchaseButton from '@/app/components/TicketPurchaseButton'
import FollowFavoriteButtons from '@/app/components/FollowFavoriteButtons'
import AddToCalendar from './AddToCalendar'
import ShareButtons from './ShareButtons'
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
      event_types, star, slug, capacity, ticketing_enabled,
      venues (id, name, address, neighborhood, city, state, slug, website, image_url, logo),
      event_artists (
        display_order,
        role,
        artists (id, name, slug, avatar_url, artist_type)
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

// ─── SEO ──────────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const event = await getEvent(slug)
  if (!event) return { title: 'Event Not Found' }

  const d = new Date(event.event_date + 'T12:00:00')
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const description = event.description || `${event.title} — ${dateStr}${event.venue ? ` at ${event.venue.name}` : ''} in Topeka, KS`

  return {
    title: `${event.title} | The 785`,
    description,
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
    url: `https://seveneightfive/events/${event.slug}`,
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
        ...(a.slug && { url: `https://seveneightfive/artists/${a.slug}` }),
      })),
    }),
    organizer: {
      '@type': 'Organization',
      name: 'seveneightfive',
      url: 'https://seveneightfive.com',
    },
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEvent(slug)
  if (!event) notFound()

  const jsonLd = getJsonLd(event)
  const d = new Date(event.event_date + 'T12:00:00')
  const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' })
  const fullDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const isToday = d.toDateString() === new Date().toDateString()
  const isFree = event.ticket_price === 0
  const isPaid = event.ticket_price !== null && event.ticket_price > 0
  const ctaUrl = event.ticket_url || event.learnmore_link

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #b8b3ad;
          --white: #ffffff; --off: #f7f6f4; --warm: #f2ede6;
          --accent: #c80650; --accent-light: #fdf1ec; --border: #ece8e2;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--white); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

        /* HERO */
        .hero { position: relative; width: 100%; aspect-ratio: 16/7; max-height: 520px; min-height: 280px; background: var(--ink); overflow: hidden; }
        .hero-no-img { position: absolute; inset: 0; background: linear-gradient(135deg, #2a2620, #1a1814); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: clamp(6rem, 20vw, 14rem); font-weight: 700; color: rgba(255,255,255,0.04); text-transform: uppercase; }
        .hero-body { position: relative; z-index: 2; padding: 24px 24px 32px; max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; pointer-events: none; }
        .hero-types { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; pointer-events: auto; }
        .hero-type-tag { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #FFCE03; background: rgba(255,206,3,0.18); border: 1px solid rgba(255,206,3,0.4); padding: 3px 10px; border-radius: 100px; }
        .hero-title { font-family: var(--serif); font-size: clamp(1.8rem, 5vw, 3.5rem); font-weight: 700; color: white; text-transform: uppercase; line-height: 1; letter-spacing: -0.01em; margin-bottom: 12px; animation: fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both; pointer-events: auto; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .hero-date-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; pointer-events: auto; }
        .hero-date { font-size: 0.82rem; font-weight: 500; color: rgba(255,255,255,0.65); letter-spacing: 0.04em; }
        .hero-today { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); background: rgba(200,6,80,0.2); border: 1px solid rgba(200,6,80,0.3); padding: 3px 8px; border-radius: 100px; }
        .hero-star { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: white; background: var(--accent); padding: 3px 8px; border-radius: 100px; }

        /* TOP NAV */
        .top-nav { background: var(--white); border-bottom: 1px solid var(--border); padding: 0 24px; display: flex; align-items: center; height: 52px; }
        .nav-divider { margin: 0 12px; color: var(--border); }
        .nav-current { font-size: 0.72rem; color: var(--ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; }

        /* CONTENT */
        .content { max-width: 680px; margin: 0 auto; padding: 0 24px; }

        /* INFO CARD */
        .info-card { margin: 32px 0; background: var(--off); border-radius: 12px; overflow: hidden; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; }
        .info-cell { padding: 18px 20px; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); }
        .info-cell:nth-child(even) { border-right: none; }
        .info-cell:nth-last-child(-n+2) { border-bottom: none; }
        .info-cell.full { grid-column: span 2; border-right: none; }
        .info-label { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #374151; margin-bottom: 5px; }
        .info-value { font-size: 0.92rem; color: var(--ink); font-weight: 400; line-height: 1.4; }
        .info-value strong { font-weight: 600; }
        .price-free { color: #2d7a2d; font-weight: 600; }
        .price-paid { font-family: var(--serif); font-size: 1.1rem; font-weight: 600; }

        /* ARTIST ROW */
        .artist-row { display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; padding: 4px 0; }
        .artist-row + .artist-row { border-top: 1px solid var(--border); padding-top: 10px; margin-top: 6px; }
        .artist-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: var(--border); }
        .artist-avatar-placeholder { width: 36px; height: 36px; border-radius: 50%; background: var(--border); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 0.9rem; color: var(--ink-faint); flex-shrink: 0; }
        .artist-info { flex: 1; min-width: 0; }
        .artist-name { font-weight: 600; font-size: 0.92rem; }
        .artist-type { font-size: 0.72rem; color: var(--ink-faint); margin-top: 1px; }
        .artist-arrow { color: var(--ink-faint); flex-shrink: 0; }

        /* CTA */
        .cta-row { display: flex; gap: 10px; margin: 24px 0; flex-wrap: wrap; }
        .cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 24px; border-radius: 8px; font-family: var(--serif); font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; text-decoration: none; transition: all 0.15s; cursor: pointer; }
        .cta-primary { background: var(--accent); color: white; border: 2px solid var(--accent); }
        .cta-primary:hover { background: #c80650; border-color: #c80650; }
        .cta-secondary { background: transparent; color: var(--ink); border: 2px solid var(--border); }
        .cta-secondary:hover { border-color: var(--ink); }

        /* DESCRIPTION */
        .section { padding: 32px 0; border-top: 1px solid var(--border); }
        .section-eyebrow { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #374151; margin-bottom: 14px; }
        .description-text { font-size: 1rem; font-weight: 300; line-height: 1.8; color: var(--ink); }
        .description-text p + p { margin-top: 14px; }

        /* VENUE CARD */
        .venue-card { display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--off); border-radius: 10px; text-decoration: none; color: var(--ink); transition: background 0.15s; }
        .venue-card:hover { background: var(--warm); }
        .venue-img { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
        .venue-img-placeholder { width: 56px; height: 56px; border-radius: 8px; background: var(--border); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 1.4rem; color: var(--ink-faint); flex-shrink: 0; }
        .venue-info { flex: 1; min-width: 0; }
        .venue-name { font-family: var(--serif); font-size: 1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.2; margin-bottom: 3px; }
        .venue-address { font-size: 0.78rem; color: var(--ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .venue-arrow { color: var(--ink-faint); flex-shrink: 0; transition: transform 0.15s; }
        .venue-card:hover .venue-arrow { transform: translateX(3px); }

        /* FOOTER */
        .event-footer { padding: 28px 24px 48px; text-align: center; border-top: 1px solid var(--border); max-width: 680px; margin: 0 auto; }
        .footer-brand { font-family: var(--serif); font-size: 0.72rem; font-weight: 400; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); text-decoration: none; }
        .footer-brand em { font-style: normal; color: var(--accent); font-weight: 600; }
        .footer-brand:hover { color: var(--ink); }

        @media (max-width: 640px) {
          .hero { aspect-ratio: 4/3; max-height: 360px; }
          .hero-body { padding: 20px 20px 24px; }
          .content { padding: 0 20px; }
          .info-grid { grid-template-columns: 1fr; }
          .info-cell { border-right: none; }
          .info-cell:nth-last-child(-n+2) { border-bottom: 1px solid var(--border); }
          .info-cell:last-child { border-bottom: none; }
          .cta-btn { width: 100%; justify-content: center; }
          .cta-row { flex-direction: column; }
          .cta-row > * { width: 100%; }
          .cta-row button { width: 100%; justify-content: center; }
        }
      `}</style>

      {/* TOP NAV */}
      <nav className="top-nav">
        <BackButton />
        <span className="nav-divider">/</span>
        <span className="nav-current">{event.title}</span>
      </nav>

      {/* HERO */}
      <section className="hero">
        {event.image_url
          ? <ImageLightbox src={event.image_url} alt={event.title} />
          : <div className="hero-no-img">{event.title[0]}</div>
        }
        <div className="hero-body">
          {event.event_types && event.event_types.length > 0 && (
            <div className="hero-types">
              {event.event_types.map(t => <span key={t} className="hero-type-tag">{t}</span>)}
            </div>
          )}
          <h1 className="hero-title">{event.title}</h1>
          <div className="hero-date-row">
            <span className="hero-date">{isToday ? 'Today' : dayOfWeek}, {fullDate}</span>
            {isToday && <span className="hero-today">Today</span>}
            {event.star && <span className="hero-star">★ Featured</span>}
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <main className="content">

        {/* INFO CARD */}
        <div className="info-card">
          <div className="info-grid">

            {/* Date */}
            <div className="info-cell">
              <div className="info-label">Date</div>
              <div className="info-value">
                <strong>{isToday ? 'Today — ' : ''}{dayOfWeek}</strong><br />{fullDate}
              </div>
            </div>

            {/* Time */}
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

            {/* Venue */}
            {event.venue && (
              <div className="info-cell">
                <div className="info-label">Venue</div>
                <div className="info-value">
                  <strong>{event.venue.name}</strong>
                  {event.venue.neighborhood && (
                    <><br /><span style={{ color: 'var(--ink-faint)', fontSize: '0.82rem' }}>{event.venue.neighborhood}</span></>
                  )}
                </div>
              </div>
            )}

            {/* Capacity */}
            {event.capacity && (
              <div className="info-cell">
                <div className="info-label">Capacity</div>
                <div className="info-value">{event.capacity.toLocaleString()} guests</div>
              </div>
            )}

            {/* Featured Artists */}
            {event.artists && event.artists.length > 0 && (
              <div className="info-cell full">
                <div className="info-label">
                  {event.artists.length === 1 ? 'Featured Artist' : 'Featured Artists'}
                </div>
                <div className="info-value">
                  {event.artists.map((artist) => (
                    <a
                      key={artist.id}
                      href={artist.slug ? `/artists/${artist.slug}` : '#'}
                      className="artist-row"
                    >
                      {artist.avatar_url
                        ? <img src={artist.avatar_url} alt={artist.name} className="artist-avatar" />
                        : <div className="artist-avatar-placeholder">{artist.name[0]}</div>
                      }
                      <div className="artist-info">
                        <div className="artist-name">{artist.name}</div>
                        {artist.artist_type && <div className="artist-type">{artist.artist_type}</div>}
                      </div>
                      <span className="artist-arrow">→</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* CTA BUTTONS */}
        {event.ticketing_enabled && event.id && event.slug && (
          <TicketPurchaseButton eventId={event.id} eventSlug={event.slug} />
        )}

        <div className="cta-row">
          <FollowFavoriteButtons
            entityType="event"
            entityId={event.id}
            showFollow={true}
            showFavorite={false}
            className="ffb-light"
          />
          {ctaUrl && !event.ticketing_enabled && (
            <a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="cta-btn cta-primary">
              {event.ticket_url ? 'Get Tickets' : 'Learn More'}
            </a>
          )}
          {ctaUrl && event.ticketing_enabled && event.learnmore_link && (
            <a href={event.learnmore_link} target="_blank" rel="noopener noreferrer" className="cta-btn cta-secondary">
              Learn More
            </a>
          )}
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

        {/* DESCRIPTION */}
        {event.description && (
          <div className="section">
            <div className="section-eyebrow">About This Event</div>
            <div className="description-text">
              {event.description.split('\n').filter(Boolean).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        )}

        {/* VENUE */}
        {event.venue && (
          <div className="section">
            <div className="section-eyebrow">Venue</div>
            <a
              href={event.venue.slug ? `/venues/${event.venue.slug}` : event.venue.website || '#'}
              target={event.venue.slug ? '_self' : '_blank'}
              rel={event.venue.slug ? undefined : 'noopener noreferrer'}
              className="venue-card"
            >
              {event.venue.logo || event.venue.image_url
                ? <img src={event.venue.logo ?? event.venue.image_url ?? ''} alt={event.venue.name} className="venue-img" />
                : <div className="venue-img-placeholder">{event.venue.name[0]}</div>
              }
              <div className="venue-info">
                <div className="venue-name">{event.venue.name}</div>
                <div className="venue-address">
                  {[event.venue.address, event.venue.neighborhood || event.venue.city].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className="venue-arrow">→</span>
            </a>
          </div>
        )}

      </main>

      <footer className="event-footer">
        <a href="/events" className="footer-brand">
          <em>seveneightfive</em> magazine
        </a>
      </footer>
    </>
  )
}
