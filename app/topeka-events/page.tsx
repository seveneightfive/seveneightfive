import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Things to Do in Topeka, KS | Events This Weekend | seveneightfive',
  description: 'Find things to do in Topeka, Kansas this weekend. Live music, art events, family activities, festivals and more — updated daily by seveneightfive magazine.',
}

export const revalidate = 3600

const CATEGORIES = [
  { label: 'All Events',   href: '/events' },
  { label: 'Live Music',   href: '/live-music' },
  { label: 'Art',          href: '/events?category=Art' },
  { label: 'Family',       href: '/events?category=Community+%2F+Cultural' },
  { label: 'First Friday', href: '/events?category=Art' },
  { label: 'Nightlife',    href: '/events?category=Party+For+A+Cause' },
  { label: 'Galleries',    href: '/topeka-art-galleries' },
  { label: 'Venues',       href: '/venues' },
]

async function getUpcomingEvents() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('events')
    .select(`
      id, title, slug, event_date, event_start_time, image_url, event_types, star,
      venues (name, neighborhood)
    `)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(24)
  return data ?? []
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month:   d.toLocaleDateString('en-US', { month:   'short' }).toUpperCase(),
    day:     d.getDate(),
    full:    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  }
}

export default async function TopekaEventsPage() {
  const events = await getUpcomingEvents()

  // Separate featured (star) events for the hero strip
  const featured = events.filter((e: any) => e.star).slice(0, 3)
  const regular  = events.filter((e: any) => !e.star)

  return (
    <>
      <style>{`
        .te-hero {
          background: #111;
          color: #fff;
          padding: 3rem 1.25rem 2.5rem;
          text-align: center;
        }
        .te-hero h1 {
          font-size: clamp(1.8rem, 5vw, 3rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0 0 0.5rem;
          color: #fff;
        }
        .te-hero p {
          color: #aaa;
          font-size: 1rem;
          max-width: 500px;
          margin: 0 auto 1.75rem;
          line-height: 1.6;
        }
        .te-filters {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding: 1rem 1.25rem;
          scrollbar-width: none;
          background: #fff;
          border-bottom: 1px solid #eee;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .te-filters::-webkit-scrollbar { display: none; }
        .te-filter-pill {
          display: inline-block;
          white-space: nowrap;
          padding: 0.45rem 1.1rem;
          border-radius: 999px;
          border: 1.5px solid #222;
          font-size: 0.85rem;
          font-weight: 500;
          text-decoration: none;
          color: #222;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .te-filter-pill:hover {
          background: #222;
          color: #fff;
        }
        .te-filter-pill.active {
          background: #222;
          color: #fff;
        }
        .te-featured-strip {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1px;
          background: #111;
          border-bottom: 3px solid #111;
        }
        .te-featured-card {
          position: relative;
          aspect-ratio: 16/9;
          overflow: hidden;
          text-decoration: none;
          display: block;
        }
        .te-featured-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .te-featured-card:hover img { transform: scale(1.04); }
        .te-featured-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 1.25rem;
        }
        .te-featured-badge {
          display: inline-block;
          background: #fff;
          color: #111;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          margin-bottom: 0.5rem;
          width: fit-content;
        }
        .te-featured-title {
          color: #fff;
          font-size: 1.05rem;
          font-weight: 600;
          margin: 0 0 0.25rem;
          line-height: 1.3;
        }
        .te-featured-meta {
          color: rgba(255,255,255,0.7);
          font-size: 0.82rem;
          margin: 0;
        }
        .te-section {
          max-width: 1100px;
          margin: 0 auto;
          padding: 2rem 1.25rem 3rem;
        }
        .te-section-title {
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin: 0 0 1.25rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #111;
        }
        .te-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 1.25rem;
        }
        .te-card {
          text-decoration: none;
          color: inherit;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #eee;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.2s;
        }
        .te-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .te-card-img-wrap {
          position: relative;
          aspect-ratio: 3/2;
          background: #f5f5f5;
          overflow: hidden;
        }
        .te-card-img-wrap img {
          width: 100%; height: 100%;
          object-fit: cover;
        }
        .te-card-img-placeholder {
          width: 100%; height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f0f0;
          color: #bbb;
          font-size: 2rem;
        }
        .te-date-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          background: #fff;
          border-radius: 6px;
          padding: 0.3rem 0.5rem;
          text-align: center;
          min-width: 44px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .te-date-badge-month {
          font-size: 0.6rem;
          font-weight: 700;
          color: #e02;
          letter-spacing: 0.06em;
          display: block;
        }
        .te-date-badge-day {
          font-size: 1.1rem;
          font-weight: 700;
          color: #111;
          line-height: 1;
          display: block;
        }
        .te-card-body {
          padding: 0.85rem 1rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .te-card-time {
          font-size: 0.75rem;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .te-card-title {
          font-size: 0.95rem;
          font-weight: 600;
          line-height: 1.35;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .te-card-venue {
          font-size: 0.8rem;
          color: #888;
          margin: 0;
        }
        .te-card-tag {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #555;
          margin-top: 4px;
        }
        .te-cta {
          text-align: center;
          margin-top: 2.5rem;
        }
        .te-cta a {
          display: inline-block;
          padding: 0.8rem 2.5rem;
          background: #111;
          color: #fff;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 0.95rem;
          letter-spacing: 0.02em;
          transition: background 0.15s;
        }
        .te-cta a:hover { background: #333; }
        .te-seo-footer {
          background: #f7f7f7;
          border-top: 1px solid #eee;
          padding: 2rem 1.25rem;
          text-align: center;
        }
        .te-seo-footer p {
          max-width: 680px;
          margin: 0 auto;
          color: #999;
          font-size: 0.82rem;
          line-height: 1.75;
        }
        @media (max-width: 600px) {
          .te-hero { padding: 2rem 1rem 1.75rem; }
          .te-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
          .te-card-body { padding: 0.65rem 0.75rem; }
          .te-featured-strip { grid-template-columns: 1fr; }
          .te-featured-card { aspect-ratio: 16/8; }
        }
      `}</style>

      {/* ── HERO ── */}
      <div className="te-hero">
        <h1>Things to Do in Topeka</h1>
        <p>Your daily guide to events, live music, art, and more happening in the 785.</p>
        <Link href="/events" className="te-filter-pill active" style={{ background: '#fff', color: '#111', border: '2px solid #fff' }}>
          Browse all events →
        </Link>
      </div>

      {/* ── STICKY FILTER PILLS ── */}
      <nav className="te-filters" aria-label="Event categories">
        {CATEGORIES.map((cat) => (
          <Link key={cat.label} href={cat.href} className="te-filter-pill">
            {cat.label}
          </Link>
        ))}
      </nav>

      {/* ── FEATURED STRIP (starred events) ── */}
      {featured.length > 0 && (
        <div className="te-featured-strip">
          {featured.map((event: any) => {
            const venue = Array.isArray(event.venues) ? event.venues[0] : event.venues
            const { full } = formatDate(event.event_date)
            return (
              <Link key={event.id} href={`/events/${event.slug}`} className="te-featured-card">
                {event.image_url
                  ? <img src={event.image_url} alt={event.title} />
                  : <div style={{ width: '100%', height: '100%', background: '#222' }} />
                }
                <div className="te-featured-overlay">
                  <span className="te-featured-badge">★ FEATURED</span>
                  <p className="te-featured-title">{event.title}</p>
                  <p className="te-featured-meta">
                    {full}{event.event_start_time ? ` · ${event.event_start_time}` : ''}
                    {venue ? ` · ${venue.name}` : ''}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── MAIN GRID ── */}
      <div className="te-section">
        <h2 className="te-section-title">Upcoming in Topeka</h2>
        <div className="te-grid">
          {regular.map((event: any) => {
            const venue = Array.isArray(event.venues) ? event.venues[0] : event.venues
            const { month, day, weekday } = formatDate(event.event_date)
            const tag = Array.isArray(event.event_types) ? event.event_types[0] : null

            return (
              <Link key={event.id} href={`/events/${event.slug}`} className="te-card">
                <div className="te-card-img-wrap">
                  {event.image_url
                    ? <img src={event.image_url} alt={event.title} loading="lazy" />
                    : <div className="te-card-img-placeholder">🎵</div>
                  }
                  <div className="te-date-badge">
                    <span className="te-date-badge-month">{month}</span>
                    <span className="te-date-badge-day">{day}</span>
                  </div>
                </div>
                <div className="te-card-body">
                  <span className="te-card-time">
                    {weekday}{event.event_start_time ? ` · ${event.event_start_time}` : ''}
                  </span>
                  <p className="te-card-title">{event.title}</p>
                  {venue && (
                    <p className="te-card-venue">
                      {venue.name}{venue.neighborhood ? ` · ${venue.neighborhood}` : ''}
                    </p>
                  )}
                  {tag && <span className="te-card-tag">{tag}</span>}
                </div>
              </Link>
            )
          })}
        </div>

        <div className="te-cta">
          <Link href="/events">See all Topeka events →</Link>
        </div>
      </div>

      {/* ── SEO FOOTER TEXT ── */}
      <div className="te-seo-footer">
        <p>
          seveneightfive magazine has been covering things to do in Topeka, Kansas since 2006.
          From live music in NOTO and the Midtown Strip to First Friday ArtWalk, Topeka Zoo events,
          Washburn University performances, and community festivals — the most complete calendar
          of Topeka events, updated daily.
        </p>
      </div>
    </>
  )
}
