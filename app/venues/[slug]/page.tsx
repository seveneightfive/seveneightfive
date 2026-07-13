import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// ─── Types ────────────────────────────────────────────────────────────────────

type Venue = {
  id: string
  name: string
  slug: string
  description: string | null
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  image_url: string | null
  website: string | null
  venue_type: string[] | null
  phone: string | null
  email: string | null
  social_instagram: string | null
  social_facebook: string | null
  est: string | null
}

type Event = {
  id: string
  slug: string | null
  title: string
  event_date: string | null
  event_start_time: string | null
  image_url: string | null
  ticket_price: number | null
  ticket_url: string | null
}

const SITE_URL = 'https://seveneightfive.com'

// ─── SEO ─────────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const venue = await getVenue(slug)
  if (!venue) return { title: 'Venue Not Found' }
  const description = venue.description || `${venue.name} — ${venue.neighborhood || venue.city || 'Topeka'}, KS`
  return {
    title: `${venue.name} | The 785`,
    description,
    alternates: { canonical: `${SITE_URL}/venues/${venue.slug}` },
    openGraph: { title: venue.name, description, images: venue.image_url ? [{ url: venue.image_url }] : [], type: 'website' },
    twitter: { card: 'summary_large_image', title: venue.name, description, images: venue.image_url ? [venue.image_url] : [] },
  }
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getVenue(slug: string): Promise<Venue | null> {
  const { data, error } = await supabase
    .from('venues')
    .select(`
      id, name, slug, description, address, neighborhood, city, state,
      image_url, website, venue_type, phone, email,
      social_instagram, social_facebook, est
    `)
    .eq('slug', slug)
    .single()

  if (error || !data) {
    console.error('[getVenue] error:', error?.message, error?.details, 'slug:', slug)
    return null
  }
  return data as Venue
}

async function getVenueEvents(venueId: string): Promise<Event[]> {
  const today = new Date().toLocaleDateString('en-CA')
  const { data } = await supabase
    .from('events')
    .select('id, slug, title, event_date, event_start_time, image_url, ticket_price, ticket_url')
    .eq('venue_id', venueId)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(10)

  return (data || []) as Event[]
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

// Adjust these keys to match your actual venue_type tag values in Supabase
const VENUE_TYPE_MAP: Record<string, string> = {
  'Bar': 'BarOrPub',
  'Brewery': 'Brewery',
  'Nightclub': 'NightClub',
  'Restaurant': 'Restaurant',
  'Coffee Shop': 'CafeOrCoffeeShop',
  'Art Gallery': 'ArtGallery',
  'Theater': 'PerformingArtsTheater',
  'Music Venue': 'MusicVenue',
  'Event Space': 'EventVenue',
}

function getJsonLd(venue: Venue) {
  const matchedTypes = (venue.venue_type || [])
    .map(t => VENUE_TYPE_MAP[t])
    .filter(Boolean)

  const sameAs = [venue.social_instagram, venue.social_facebook].filter(Boolean) as string[]

  return {
    '@context': 'https://schema.org',
    '@type': matchedTypes.length > 0 ? ['LocalBusiness', ...matchedTypes] : 'LocalBusiness',
    name: venue.name,
    ...(venue.description && { description: venue.description }),
    ...(venue.image_url && { image: venue.image_url }),
    ...(venue.website && { url: venue.website }),
    ...(venue.phone && { telephone: venue.phone }),
    ...(sameAs.length > 0 && { sameAs }),
    ...(venue.address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: venue.address,
        addressLocality: venue.city || 'Topeka',
        addressRegion: venue.state || 'KS',
        addressCountry: 'US',
      },
    }),
    mainEntityOfPage: `${SITE_URL}/venues/${venue.slug}`,
  }
}

function getBreadcrumbJsonLd(venue: Venue) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Venues', item: `${SITE_URL}/venues` },
      { '@type': 'ListItem', position: 2, name: venue.name, item: `${SITE_URL}/venues/${venue.slug}` },
    ],
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const venue = await getVenue(slug)
  if (!venue) notFound()

  const events = await getVenueEvents(venue.id)
  const jsonLd = getJsonLd(venue)
  const breadcrumbJsonLd = getBreadcrumbJsonLd(venue)

  // Contact / social icons — order intentional: primary action first, then reach-out, then socials
  const contactLinks: { label: string; url: string; icon: React.ReactNode; color: string }[] = []

  if (venue.website) {
    contactLinks.push({
      label: 'Website',
      url: venue.website,
      color: '#1a1814',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      ),
    })
  }
  if (venue.phone) {
    contactLinks.push({
      label: 'Call',
      url: `tel:${venue.phone}`,
      color: '#1a1814',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      ),
    })
  }
  if (venue.email) {
    contactLinks.push({
      label: 'Email',
      url: `mailto:${venue.email}`,
      color: '#1a1814',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" />
        </svg>
      ),
    })
  }
  if (venue.social_instagram) {
    contactLinks.push({
      label: 'Instagram',
      url: venue.social_instagram,
      color: '#E1306C',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
    })
  }
  if (venue.social_facebook) {
    contactLinks.push({
      label: 'Facebook',
      url: venue.social_facebook,
      color: '#1877F2',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      ),
    })
  }
  if (venue.address) {
    contactLinks.push({
      label: 'Directions',
      url: `https://maps.google.com/?q=${encodeURIComponent(`${venue.address} ${venue.city || ''} ${venue.state || ''}`)}`,
      color: '#1a1814',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
      ),
    })
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #c0bab3;
          --white: #ffffff; --off: #f7f6f4; --accent: #C80650; --accent-light: #fdf1ec; --gold: #FFCE03;
          --border: #ece8e2; --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html { scroll-behavior: smooth; background: var(--white); }
        body { background: var(--white); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

        /* ── HERO ── */
        .hero { position: relative; width: 100%; height: 100svh; max-height: 680px; min-height: 460px; overflow: hidden; background: var(--ink); display: flex; flex-direction: column; justify-content: flex-end; }
        .hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 30%; }
        .hero-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.72) 75%, rgba(0,0,0,0.92) 100%); }
        .hero-monogram { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: clamp(8rem, 30vw, 20rem); font-weight: 700; color: rgba(255,255,255,0.04); text-transform: uppercase; letter-spacing: -0.04em; user-select: none; }
        .hero-back { position: absolute; top: 20px; left: 20px; z-index: 3; display: inline-flex; align-items: center; gap: 6px; font-size: 0.7rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #fff; text-decoration: none; background: rgba(0,0,0,0.32); backdrop-filter: blur(6px); padding: 8px 14px; border-radius: 100px; border: 1px solid rgba(255,255,255,0.16); transition: background 0.15s; }
        .hero-back:hover { background: rgba(0,0,0,0.5); }
        .hero-body { position: relative; z-index: 2; padding: 24px 32px 40px var(--page-pad); }
        .hero-eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .hero-type-label { font-size: 0.65rem; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); }
        .hero-name { font-family: var(--serif); font-size: clamp(2.4rem, 8vw, 5rem); font-weight: 700; color: #fff; line-height: 0.95; letter-spacing: -0.01em; text-transform: uppercase; margin-bottom: 12px; animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .hero-pills { display: flex; flex-wrap: wrap; gap: 6px; animation: fadeUp 0.6s 0.12s cubic-bezier(0.22,1,0.36,1) both; }
        .hero-pill { font-size: 0.67rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.18); padding: 4px 10px; border-radius: 100px; backdrop-filter: blur(4px); display: flex; align-items: center; gap: 4px; }

        /* ── LAYOUT ── */
        :root { --page-pad: 64px; }
        .venue-main { max-width: 1440px; margin: 0 auto; padding: 48px var(--page-pad) 0; }
        .venue-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 40px; align-items: start; }

        .panel-header { padding: 0; }
        .panel-body { padding: 16px 0 0; }
        .eyebrow { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink); margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
        .eyebrow::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .eyebrow-accent { color: var(--accent); }

        /* ── ABOUT ── */
        .about-panel { position: sticky; top: 24px; }
        .desc-text { font-size: 0.98rem; font-weight: 400; line-height: 1.75; color: #141210; }
        .desc-text + .desc-text { margin-top: 12px; }
        .desc-empty { font-size: 0.92rem; font-style: italic; color: var(--ink-faint); }
        .address-block { margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; align-items: flex-start; gap: 10px; }
        .address-icon { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
        .address-text { font-size: 0.88rem; color: var(--ink-soft); line-height: 1.5; }
        .address-link { color: var(--accent); text-decoration: none; font-size: 0.8rem; font-weight: 500; }
        .address-link:hover { text-decoration: underline; }
        .type-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 18px; }
        .type-tag { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-soft); background: var(--off); border-radius: 100px; padding: 5px 11px; }

        /* ── EVENTS ── */
        .events-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; text-align: center; }
        .events-empty-icon { font-size: 2rem; }
        .events-empty-title { font-family: var(--serif); font-size: 1rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); }
        .events-empty-sub { font-size: 0.85rem; color: var(--ink-faint); }
        .events-list { display: flex; flex-direction: column; gap: 10px; }
        .link-row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: var(--white); border: 1.5px solid var(--border); border-radius: 10px; text-decoration: none; color: var(--ink); transition: border-color 0.15s, box-shadow 0.15s; -webkit-tap-highlight-color: transparent; }
        .link-row:hover, .link-row:active { border-color: var(--ink); box-shadow: -3px 0 0 var(--accent); }
        .link-chevron { color: var(--ink-faint); font-size: 1rem; flex-shrink: 0; transition: transform 0.15s; }
        .link-row:hover .link-chevron { transform: translateX(3px); }

        /* ── CONTACT STRIP ── */
        .contact-strip { margin-top: 32px; padding: 28px 0 56px; border-top: 1px solid var(--border); }
        .contact-strip-label { text-align: center; font-size: 0.65rem; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 20px; }
        .contact-icons { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; }
        .contact-icon-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; width: 84px; }
        .contact-icon-circle { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--border); transition: transform 0.15s, border-color 0.15s, background 0.15s; }
        .contact-icon-btn:hover .contact-icon-circle { transform: translateY(-3px); border-color: currentColor; background: var(--off); }
        .contact-icon-label { font-size: 0.68rem; font-weight: 500; letter-spacing: 0.03em; color: var(--ink-soft); text-align: center; }

        /* ── FOOTER ── */
        .venue-footer { padding: 0 24px 40px; text-align: center; }
        .footer-wordmark { font-family: var(--serif); font-size: 0.72rem; font-weight: 400; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); text-decoration: none; transition: color 0.15s; }
        .footer-wordmark em { font-style: normal; color: var(--accent); font-weight: 600; }
        .footer-wordmark:hover { color: var(--ink); }

        /* ── RESPONSIVE ── */
        @media (max-width: 860px) {
          .venue-grid { grid-template-columns: 1fr; }
          .about-panel { position: static; }
        }
        @media (max-width: 640px) {
          :root { --page-pad: 20px; }
          .hero { height: 100svh; max-height: 100svh; min-height: 0; }
          .hero-body { padding: 20px 20px 28px var(--page-pad); }
          .venue-main { padding: 32px var(--page-pad) 0; }
          .contact-strip { padding: 24px 0 40px; }
        }
      `}</style>

      {/* ── HERO ── */}
      <section className="hero">
        <a href="/venues" className="hero-back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Venues
        </a>
        {venue.image_url ? (
          <>
            <img src={venue.image_url} alt={venue.name} className="hero-img" />
            <div className="hero-scrim" />
          </>
        ) : (
          <div className="hero-monogram">{venue.name[0]}</div>
        )}
        <div className="hero-body">
          <div className="hero-eyebrow">
            {venue.neighborhood && <span className="hero-type-label">{venue.neighborhood}</span>}
          </div>
          <h1 className="hero-name">{venue.name}</h1>
          <div className="hero-pills">
            {(venue.city || venue.neighborhood) && (
              <span className="hero-pill">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {venue.city || venue.neighborhood}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── CONTENT ── */}
      <main className="venue-main">
        <div className="venue-grid">

          {/* ── ABOUT (33%) ── */}
          <section className="panel about-panel">
            <div className="panel-header">
              <div className="eyebrow">
                {venue.est ? <><span className="eyebrow-accent">Est.</span>&nbsp;{venue.est}</> : 'About'}
              </div>
            </div>
            <div className="panel-body">
              {venue.description
                ? venue.description.split('\n').filter(Boolean).map((p, i) => <p key={i} className="desc-text">{p}</p>)
                : <p className="desc-empty">No description available.</p>
              }

              {venue.venue_type && venue.venue_type.length > 0 && (
                <div className="type-tags">
                  {venue.venue_type.map(t => <span key={t} className="type-tag">{t}</span>)}
                </div>
              )}

              {venue.address && (
                <div className="address-block">
                  <svg className="address-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <div>
                    <div className="address-text">{venue.address}{venue.city && `, ${venue.city}`}{venue.state && `, ${venue.state}`}</div>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(`${venue.address} ${venue.city || ''} ${venue.state || ''}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="address-link"
                    >
                      Open in Maps →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── EVENTS (66%) ── */}
          <section className="panel">
            <div className="panel-header">
              <div className="eyebrow">Upcoming Events</div>
            </div>
            <div className="panel-body">
              {events.length === 0 ? (
                <div className="events-empty">
                  <div className="events-empty-icon">📅</div>
                  <div className="events-empty-title">No upcoming events</div>
                  <div className="events-empty-sub">Check back soon or follow on social media</div>
                </div>
              ) : (
                <div className="events-list">
                  {events.map(event => (
                    <a
                      key={event.id}
                      href={event.slug ? `/events/${event.slug}` : event.ticket_url || '#'}
                      target={event.slug ? '_self' : '_blank'}
                      rel="noopener noreferrer"
                      className="link-row"
                    >
                      {event.image_url && (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          style={{ width: 90, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: '0.95rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {event.title}
                        </div>
                        {event.event_date && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', marginTop: 3 }}>
                            {new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {event.event_start_time && ` · ${event.event_start_time.trim()}`}
                          </div>
                        )}
                      </div>
                      {event.ticket_price !== null && (
                        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: event.ticket_price === 0 ? 'var(--accent)' : 'var(--ink-soft)', flexShrink: 0 }}>
                          {event.ticket_price === 0 ? 'Free' : `$${event.ticket_price}`}
                        </span>
                      )}
                      <span className="link-chevron">→</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>

        {/* ── CONTACT ICON STRIP ── */}
        {contactLinks.length > 0 && (
          <div className="contact-strip">
            <div className="contact-strip-label">Get in Touch</div>
            <div className="contact-icons">
              {contactLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target={link.url.startsWith('mailto') || link.url.startsWith('tel') ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  className="contact-icon-btn"
                  style={{ color: link.color }}
                >
                  <span className="contact-icon-circle">{link.icon}</span>
                  <span className="contact-icon-label">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="venue-footer">
        <a href="/venues" className="footer-wordmark">
          <em>seveneightfive</em> Venue Directory
        </a>
      </footer>
    </>
  )
}
