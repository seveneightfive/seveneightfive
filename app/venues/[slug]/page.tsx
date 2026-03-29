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
  venue_type: string | null
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

function getJsonLd(venue: Venue) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: venue.name,
    description: venue.description,
    image: venue.image_url,
    url: venue.website,
    address: venue.address ? {
      '@type': 'PostalAddress',
      streetAddress: venue.address,
      addressLocality: venue.city || 'Topeka',
      addressRegion: venue.state || 'KS',
      addressCountry: 'US',
    } : undefined,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const venue = await getVenue(slug)
  if (!venue) notFound()

  const events = await getVenueEvents(venue.id)
  const jsonLd = getJsonLd(venue)

  const socialLinks: { label: string; url: string; icon: string; color: string }[] = []
  if (venue.website) socialLinks.push({ label: 'Website', url: venue.website, icon: '🌐', color: '#1a1814' })
  if (venue.social_instagram) socialLinks.push({ label: 'Instagram', url: venue.social_instagram, icon: '◎', color: '#E1306C' })
  if (venue.social_facebook) socialLinks.push({ label: 'Facebook', url: venue.social_facebook, icon: 'f', color: '#1877F2' })
  if (venue.email) socialLinks.push({ label: 'Email', url: `mailto:${venue.email}`, icon: '✉', color: '#6b6560' })

  const navItems = [
    { id: 'about', label: 'About', icon: '◉' },
    { id: 'events', label: 'Events', icon: '◷' },
    ...(socialLinks.length > 0 ? [{ id: 'links', label: 'Links', icon: '↗' }] : []),
    { id: 'contact', label: 'Contact', icon: '✉' },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #c0bab3;
          --white: #ffffff; --off: #f7f6f4; --accent: #C80650; --accent-light: #fdf1ec; --gold: #FFCE03;
          --border: #ece8e2; --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
          --nav-h: 56px; --bottom-nav-h: 64px;
        }
        html { scroll-behavior: smooth; background: var(--white); }
        body { background: var(--white); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

        /* ── HERO ── */
        .hero { position: relative; width: 100%; height: 100svh; max-height: 680px; min-height: 460px; overflow: hidden; background: var(--ink); display: flex; flex-direction: column; justify-content: flex-end; }
        .hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 30%; }
        .hero-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.72) 75%, rgba(0,0,0,0.92) 100%); }
        .hero-monogram { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: clamp(8rem, 30vw, 20rem); font-weight: 700; color: rgba(255,255,255,0.04); text-transform: uppercase; letter-spacing: -0.04em; user-select: none; }
        .hero-body { position: relative; z-index: 2; padding: 24px 24px 32px; }
        .hero-eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .hero-type-label { font-size: 0.65rem; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); }
        .hero-name { font-family: var(--serif); font-size: clamp(2.4rem, 8vw, 5rem); font-weight: 700; color: #fff; line-height: 0.95; letter-spacing: -0.01em; text-transform: uppercase; margin-bottom: 12px; animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .hero-pills { display: flex; flex-wrap: wrap; gap: 6px; animation: fadeUp 0.6s 0.12s cubic-bezier(0.22,1,0.36,1) both; }
        .hero-pill { font-size: 0.67rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.18); padding: 4px 10px; border-radius: 100px; backdrop-filter: blur(4px); display: flex; align-items: center; gap: 4px; }

        /* ── NAV ── */
        .top-nav { position: sticky; top: 0; z-index: 200; background: var(--white); border-bottom: 1px solid var(--border); display: flex; align-items: center; height: var(--nav-h); padding: 0 24px; gap: 0; overflow-x: auto; scrollbar-width: none; }
        .top-nav::-webkit-scrollbar { display: none; }
        .top-nav-back { display: flex; align-items: center; gap: 6px; font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-soft); text-decoration: none; padding-right: 20px; margin-right: 4px; border-right: 1px solid var(--border); white-space: nowrap; flex-shrink: 0; transition: color 0.15s; }
        .top-nav-back:hover { color: var(--ink); }
        .top-nav-link { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); text-decoration: none; padding: 0 16px; height: 100%; display: flex; align-items: center; border-bottom: 2px solid transparent; white-space: nowrap; flex-shrink: 0; transition: all 0.15s; }
        .top-nav-link:hover { color: var(--ink); border-bottom-color: var(--ink); }
        .bottom-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 200; background: var(--white); border-top: 1px solid var(--border); height: var(--bottom-nav-h); padding-bottom: env(safe-area-inset-bottom); }
        .bottom-nav-inner { display: flex; height: 100%; align-items: stretch; padding: 0 4px; width: 100%; }
        .bottom-nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; text-decoration: none; color: var(--ink-faint); transition: color 0.15s; padding: 8px 2px; min-width: 0; }
        .bottom-nav-item:hover, .bottom-nav-item:active { color: var(--accent); }
        .bottom-nav-icon { font-size: 1rem; line-height: 1; }
        .bottom-nav-label { font-size: 0.58rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .bottom-nav-back { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; text-decoration: none; color: var(--ink-faint); transition: color 0.15s; padding: 8px 2px; border-right: 1px solid var(--border); margin-right: 4px; }
        .bottom-nav-back:hover { color: var(--ink); }

        /* ── CONTENT ── */
        .venue-main { max-width: 680px; margin: 0 auto; padding: 0 24px; }
        .section { padding: 52px 0; border-bottom: 1px solid var(--border); }
        .section:last-child { border-bottom: none; padding-bottom: 80px; }
        .eyebrow { font-size: 0.65rem; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: #374151; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
        .eyebrow::after { content: ''; flex: 1; height: 1px; background: var(--border); max-width: 48px; }

        /* ── ABOUT ── */
        .desc-text { font-size: 1.02rem; font-weight: 300; line-height: 1.8; color: var(--ink); }
        .desc-text + .desc-text { margin-top: 14px; }
        .desc-empty { font-size: 0.95rem; font-style: italic; color: var(--ink-faint); }
        .address-block { margin-top: 24px; display: flex; align-items: flex-start; gap: 10px; }
        .address-icon { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
        .address-text { font-size: 0.9rem; color: var(--ink-soft); line-height: 1.5; }
        .address-link { color: var(--accent); text-decoration: none; font-size: 0.82rem; }
        .address-link:hover { text-decoration: underline; }

        /* ── EVENTS ── */
        .events-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 0; text-align: center; }
        .events-empty-icon { font-size: 2rem; }
        .events-empty-title { font-family: var(--serif); font-size: 1rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); }
        .events-empty-sub { font-size: 0.85rem; color: var(--ink-faint); }
        .link-row { display: flex; align-items: center; gap: 14px; padding: 15px 18px; background: var(--white); border: 1.5px solid var(--border); border-radius: 10px; text-decoration: none; color: var(--ink); transition: border-color 0.15s, box-shadow 0.15s; -webkit-tap-highlight-color: transparent; }
        .link-row:hover, .link-row:active { border-color: var(--ink); box-shadow: -3px 0 0 var(--accent); }
        .link-chevron { color: var(--ink-faint); font-size: 1rem; flex-shrink: 0; transition: transform 0.15s; }
        .link-row:hover .link-chevron { transform: translateX(3px); }

        /* ── LINKS ── */
        .links-stack { display: flex; flex-direction: column; gap: 10px; }
        .link-icon-wrap { width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
        .link-name { font-family: var(--serif); font-size: 0.95rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; flex: 1; }

        /* ── CONTACT ── */
        .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .contact-cell { padding: 16px; background: var(--off); border-radius: 8px; }
        .contact-cell-label { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 5px; }
        .contact-cell-value { font-size: 0.88rem; color: var(--ink); line-height: 1.4; word-break: break-word; }
        .contact-cell-value a { color: var(--accent); text-decoration: none; }
        .contact-cell-value a:hover { text-decoration: underline; }

        /* ── FOOTER ── */
        .venue-footer { padding: 28px 24px 40px; text-align: center; border-top: 1px solid var(--border); }
        .footer-wordmark { font-family: var(--serif); font-size: 0.72rem; font-weight: 400; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); text-decoration: none; transition: color 0.15s; }
        .footer-wordmark em { font-style: normal; color: var(--accent); font-weight: 600; }
        .footer-wordmark:hover { color: var(--ink); }

        /* ── RESPONSIVE ── */
        @media (min-width: 641px) { .bottom-nav { display: none !important; } .top-nav { display: flex; } body { padding-bottom: 0; } }
        @media (max-width: 640px) {
          .top-nav { display: none !important; }
          .bottom-nav { display: flex; }
          body { padding-bottom: var(--bottom-nav-h); }
          .hero { height: 100svh; max-height: 100svh; min-height: 0; }
          .hero-body { padding: 20px 20px 28px; }
          .venue-main { padding: 0 20px; }
          .section { padding: 40px 0; }
          .contact-grid { grid-template-columns: 1fr; }
          .venue-footer { padding-bottom: 20px; }
        }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .bottom-nav { padding-bottom: calc(env(safe-area-inset-bottom) + 4px); height: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom)); }
          @media (max-width: 640px) { body { padding-bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom)); } }
        }
      `}</style>

      {/* ── HERO ── */}
      <section className="hero">
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
            {venue.venue_type && <span className="hero-type-label">{venue.venue_type}</span>}
          </div>
          <h1 className="hero-name">{venue.name}</h1>
          <div className="hero-pills">
            {(venue.neighborhood || venue.city) && (
              <span className="hero-pill">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {[venue.neighborhood, venue.city].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── DESKTOP NAV ── */}
      <nav className="top-nav">
        <a href="/venues" className="top-nav-back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Venues
        </a>
        {navItems.map(n => (
          <a key={n.id} href={`#${n.id}`} className="top-nav-link">{n.label}</a>
        ))}
      </nav>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <a href="/venues" className="bottom-nav-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span className="bottom-nav-label">Back</span>
          </a>
          {navItems.map(n => (
            <a key={n.id} href={`#${n.id}`} className="bottom-nav-item">
              <span className="bottom-nav-icon">{n.icon}</span>
              <span className="bottom-nav-label">{n.label}</span>
            </a>
          ))}
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <main className="venue-main">

        <section id="about" className="section">
          <div className="eyebrow">About</div>
        
          {venue.est && (
  <div className="est-block">
    <strong>est.</strong> {venue.est}
  </div>
)}

{venue.description
            ? venue.description.split('\n').filter(Boolean).map((p, i) => <p key={i} className="desc-text">{p}</p>)
            : <p className="desc-empty">No description available.</p>
          }

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
        </section>

        <section id="events" className="section">
          <div className="eyebrow">Upcoming Events</div>
          {events.length === 0 ? (
            <div className="events-empty">
              <div className="events-empty-icon">📅</div>
              <div className="events-empty-title">No upcoming events</div>
              <div className="events-empty-sub">Check back soon or follow on social media</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      style={{ width: 80, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
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
        </section>

        {socialLinks.length > 0 && (
          <section id="links" className="section">
            <div className="eyebrow">Find Us Online</div>
            <div className="links-stack">
              {socialLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target={link.url.startsWith('mailto') ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  className="link-row"
                >
                  <span className="link-icon-wrap" style={{ background: link.color + '15', color: link.color }}>{link.icon}</span>
                  <span className="link-name">{link.label}</span>
                  <span className="link-chevron">→</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section id="contact" className="section">
          <div className="eyebrow">Contact & Info</div>
          <div className="contact-grid">
            {venue.phone && (
              <div className="contact-cell">
                <div className="contact-cell-label">Phone</div>
                <div className="contact-cell-value"><a href={`tel:${venue.phone}`}>{venue.phone}</a></div>
              </div>
            )}
            {venue.email && (
              <div className="contact-cell">
                <div className="contact-cell-label">Email</div>
                <div className="contact-cell-value"><a href={`mailto:${venue.email}`}>{venue.email}</a></div>
              </div>
            )}
            {(venue.neighborhood || venue.city) && (
              <div className="contact-cell">
                <div className="contact-cell-label">Area</div>
                <div className="contact-cell-value">{[venue.neighborhood, venue.city, venue.state].filter(Boolean).join(', ')}</div>
              </div>
            )}
            {venue.venue_type && (
              <div className="contact-cell">
                <div className="contact-cell-label">Type</div>
                <div className="contact-cell-value">{venue.venue_type}</div>
              </div>
            )}
            {venue.website && (
              <div className="contact-cell" style={{ gridColumn: '1 / -1' }}>
                <div className="contact-cell-label">Website</div>
                <div className="contact-cell-value">
                  <a href={venue.website} target="_blank" rel="noopener noreferrer">
                    {venue.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

      </main>

      <footer className="venue-footer">
        <a href="/venues" className="footer-wordmark">
          <em>seveneightfive</em> Venue Directory
        </a>
      </footer>
    </>
  )
}
