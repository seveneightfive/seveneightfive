'use client'

import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EventVenue = {
  id: string
  name: string
  slug: string | null
  neighborhood: string | null
}

type Event = {
  id: string
  title: string
  slug: string | null
  event_date: string
  event_start_time: string | null
  event_end_time: string | null
  image_url: string | null
  ticket_price: number | null
  ticket_url: string | null
  learnmore_link: string | null
  event_types: string[] | null
  star: boolean | null
  venue: EventVenue | null
}

type Musician = {
  id: string
  name: string
  slug: string | null
  tagline: string | null
  avatar_url: string | null
  image_url: string | null
  musician_profile: { musical_genres: string[] | null } | null
}

type Venue = {
  id: string
  name: string
  slug: string | null
  address: string | null
  neighborhood: string | null
  image_url: string | null
  logo: string | null
  venue_type: string | null
  upcoming_count: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HERO_IMG = 'https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/hero-images/ILove90s-TylerStruck-Web.jpg'
const EVENTS_PER_PAGE = 12

const GENRE_FILTERS = [
  'All Genres', 'Rock', 'Pop', 'Jazz', 'Blues', 'Country', 'Folk',
  'Americana', 'Hip-Hop', 'Electronic', 'Funk', 'Singer-Songwriter',
  'Punk', 'Bluegrass', 'Jam Band',
]

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

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (d.getTime() === today.getTime()) return 'Tonight'
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Seeded shuffle for stable random order per render
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LiveMusicClient({
  initialEvents,
  initialMusicians,
  venues,
}: {
  initialEvents: Event[]
  initialMusicians: Musician[]
  venues: Venue[]
}) {
  const [search, setSearch] = useState('')
  const [genreFilter, setGenreFilter] = useState('All Genres')
  const [page, setPage] = useState(1)

  // Stable random shuffle of musicians (12 shown, link to view all)
  const shuffledMusicians = useMemo(() => shuffleArray(initialMusicians), [initialMusicians])
  const displayedMusicians = shuffledMusicians.slice(0, 12)

  // Filter events
  const filteredEvents = useMemo(() => {
    let evts = initialEvents
    if (search.trim()) {
      const q = search.toLowerCase()
      evts = evts.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.venue?.name.toLowerCase().includes(q) ||
        e.venue?.neighborhood?.toLowerCase().includes(q)
      )
    }
    return evts
  }, [initialEvents, search])

  const totalEvents = filteredEvents.length
  const totalPages = Math.ceil(totalEvents / EVENTS_PER_PAGE)
  const pagedEvents = filteredEvents.slice((page - 1) * EVENTS_PER_PAGE, page * EVENTS_PER_PAGE)

  // Sort venues: those with upcoming events first
  const sortedVenues = [...venues].sort((a, b) => b.upcoming_count - a.upcoming_count)

  function handleSearch(val: string) {
    setSearch(val)
    setPage(1)
  }

  return (
    <>
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
        .lm-hero {
          position: relative; width: 100%; height: 80vh; min-height: 520px; max-height: 760px;
          background: #1a1814; overflow: hidden;
        }
        .lm-hero-img {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; object-position: center 30%;
          filter: brightness(0.45);
        }
        .lm-hero-body {
          position: relative; z-index: 2; height: 100%;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 40px 24px;
        }
        .lm-hero-eyebrow {
          font-size: 0.68rem; font-weight: 600; letter-spacing: 0.22em;
          text-transform: uppercase; color: var(--accent);
          margin-bottom: 18px;
        }
        .lm-hero-title {
          font-family: var(--serif); font-weight: 700;
          font-size: clamp(3.2rem, 10vw, 8rem);
          line-height: 0.92; letter-spacing: -0.01em;
          text-transform: uppercase; color: white;
          margin-bottom: 20px;
          animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both;
        }
        .lm-hero-title span { color: var(--accent); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .lm-hero-byline {
          font-size: 0.82rem; font-style: italic; color: rgba(255,255,255,0.55);
          letter-spacing: 0.04em; margin-bottom: 32px;
        }
        .lm-hero-sub {
          font-size: 1rem; color: rgba(255,255,255,0.7); font-weight: 300;
          max-width: 480px; line-height: 1.6; margin-bottom: 36px;
        }
        .lm-hero-cta {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--accent); color: white;
          font-family: var(--serif); font-size: 0.9rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.1em;
          padding: 14px 32px; border-radius: 4px; text-decoration: none;
          transition: background 0.15s;
        }
        .lm-hero-cta:hover { background: #a00440; }
        .lm-hero-scroll {
          position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          color: rgba(255,255,255,0.4); font-size: 0.62rem; letter-spacing: 0.14em;
          text-transform: uppercase;
          animation: bounce 2s ease-in-out infinite;
        }
        @keyframes bounce { 0%,100%{transform:translateX(-50%) translateY(0);} 50%{transform:translateX(-50%) translateY(5px);} }

        /* PAGE LAYOUT */
        .lm-page { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

        /* SECTION HEADERS */
        .lm-section { padding: 64px 0; border-top: 1px solid var(--border); }
        .lm-section:first-of-type { border-top: none; }
        .lm-section-head {
          display: flex; align-items: baseline; justify-content: space-between;
          flex-wrap: wrap; gap: 12px; margin-bottom: 32px;
        }
        .lm-section-title {
          font-family: var(--serif); font-size: clamp(1.8rem, 4vw, 2.8rem);
          font-weight: 700; text-transform: uppercase; line-height: 1;
          letter-spacing: -0.01em;
        }
        .lm-section-title em { font-style: normal; color: var(--accent); }
        .lm-section-count {
          font-size: 0.72rem; font-weight: 600; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--ink-faint);
        }
        .lm-view-all {
          font-size: 0.78rem; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--accent); text-decoration: none;
          border-bottom: 1px solid transparent; transition: border-color 0.15s;
        }
        .lm-view-all:hover { border-color: var(--accent); }

        /* SEARCH BAR */
        .lm-search-row { display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap; }
        .lm-search {
          flex: 1; min-width: 200px; padding: 12px 16px;
          border: 1.5px solid var(--border); border-radius: 8px;
          font-family: var(--sans); font-size: 0.9rem; color: var(--ink);
          background: var(--white); outline: none; transition: border-color 0.15s;
        }
        .lm-search:focus { border-color: var(--accent); }
        .lm-search::placeholder { color: var(--ink-faint); }

        /* EVENT GRID */
        .lm-events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        /* EVENT CARD */
        .lm-event-card {
          background: var(--white); border: 1px solid var(--border); border-radius: 10px;
          overflow: hidden; text-decoration: none; color: var(--ink);
          transition: box-shadow 0.15s, transform 0.15s;
          display: flex; flex-direction: column;
        }
        .lm-event-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .lm-event-card.starred { border-color: var(--accent); }
        .lm-event-img-wrap { position: relative; aspect-ratio: 16/9; overflow: hidden; background: var(--off); }
        .lm-event-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .lm-event-card:hover .lm-event-img { transform: scale(1.03); }
        .lm-event-no-img {
          width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
          font-family: var(--serif); font-size: 3rem; font-weight: 700; color: var(--border);
          background: linear-gradient(135deg, var(--off), var(--warm));
        }
        .lm-event-star-badge {
          position: absolute; top: 10px; left: 10px;
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          color: white; background: var(--accent); padding: 3px 9px; border-radius: 100px;
        }
        .lm-event-date-badge {
          position: absolute; top: 10px; right: 10px;
          background: rgba(26,24,20,0.82); color: white; backdrop-filter: blur(4px);
          padding: 5px 10px; border-radius: 6px;
          font-family: var(--serif); font-size: 0.78rem; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase; line-height: 1.2; text-align: center;
        }
        .lm-event-body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .lm-event-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .lm-event-time { font-size: 0.72rem; font-weight: 600; color: var(--accent); letter-spacing: 0.06em; }
        .lm-event-type-tag {
          font-size: 0.58rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--ink-faint); background: var(--off); border: 1px solid var(--border);
          padding: 2px 7px; border-radius: 100px;
        }
        .lm-event-title {
          font-family: var(--serif); font-size: 1.1rem; font-weight: 600;
          text-transform: uppercase; line-height: 1.15; letter-spacing: 0.01em;
        }
        .lm-event-venue { font-size: 0.78rem; color: var(--ink-soft); }
        .lm-event-venue strong { font-weight: 600; color: var(--ink); }
        .lm-event-price {
          margin-top: auto; padding-top: 10px;
          font-size: 0.78rem; font-weight: 600;
          color: var(--ink-faint); border-top: 1px solid var(--border);
        }
        .lm-event-price.free { color: #2d7a2d; }
        .lm-event-price.paid { color: var(--ink); font-family: var(--serif); font-size: 0.9rem; }

        /* PAGINATION */
        .lm-pagination {
          display: flex; align-items: center; justify-content: center;
          gap: 6px; margin-top: 40px; flex-wrap: wrap;
        }
        .lm-page-btn {
          width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
          border: 1.5px solid var(--border); border-radius: 6px;
          font-family: var(--serif); font-size: 0.82rem; font-weight: 600;
          color: var(--ink-soft); background: var(--white); cursor: pointer;
          transition: all 0.12s;
        }
        .lm-page-btn:hover { border-color: var(--ink); color: var(--ink); }
        .lm-page-btn.active { background: var(--accent); border-color: var(--accent); color: white; }
        .lm-page-btn:disabled { opacity: 0.35; cursor: default; pointer-events: none; }
        .lm-page-arrow {
          width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
          border: 1.5px solid var(--border); border-radius: 6px;
          background: var(--white); cursor: pointer; color: var(--ink-soft);
          transition: all 0.12s; font-size: 1.1rem;
        }
        .lm-page-arrow:hover { border-color: var(--ink); color: var(--ink); }
        .lm-page-arrow:disabled { opacity: 0.35; cursor: default; pointer-events: none; }

        /* NO RESULTS */
        .lm-empty {
          text-align: center; padding: 64px 24px; color: var(--ink-faint);
          font-size: 0.9rem; grid-column: 1 / -1;
        }

        /* MUSICIAN GRID */
        .lm-musicians-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 16px;
        }
        .lm-musician-card {
          text-decoration: none; color: var(--ink);
          display: flex; flex-direction: column; align-items: center;
          gap: 10px; padding: 20px 12px; text-align: center;
          border: 1px solid var(--border); border-radius: 10px; background: var(--white);
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .lm-musician-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-2px); }
        .lm-musician-avatar {
          width: 72px; height: 72px; border-radius: 50%; object-fit: cover;
          background: var(--border); flex-shrink: 0;
        }
        .lm-musician-avatar-placeholder {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, var(--warm), var(--border));
          display: flex; align-items: center; justify-content: center;
          font-family: var(--serif); font-size: 1.6rem; font-weight: 700; color: var(--ink-soft);
        }
        .lm-musician-name { font-family: var(--serif); font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.2; }
        .lm-musician-genres { font-size: 0.68rem; color: var(--ink-faint); line-height: 1.4; }

        /* VENUES GRID */
        .lm-venues-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        .lm-venue-card {
          text-decoration: none; color: var(--ink);
          display: flex; align-items: center; gap: 14px;
          padding: 16px; border: 1px solid var(--border); border-radius: 10px;
          background: var(--white); transition: box-shadow 0.15s, transform 0.15s;
        }
        .lm-venue-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-2px); }
        .lm-venue-img {
          width: 56px; height: 56px; border-radius: 8px; object-fit: cover;
          flex-shrink: 0; background: var(--border);
        }
        .lm-venue-placeholder {
          width: 56px; height: 56px; border-radius: 8px; background: var(--warm);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--serif); font-size: 1.4rem; font-weight: 700; color: var(--ink-soft);
          flex-shrink: 0;
        }
        .lm-venue-info { flex: 1; min-width: 0; }
        .lm-venue-name {
          font-family: var(--serif); font-size: 0.95rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.2; margin-bottom: 3px;
        }
        .lm-venue-addr { font-size: 0.72rem; color: var(--ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lm-venue-count {
          flex-shrink: 0; display: flex; flex-direction: column; align-items: center;
          gap: 2px; min-width: 40px;
        }
        .lm-venue-count-num {
          font-family: var(--serif); font-size: 1.4rem; font-weight: 700; color: var(--accent); line-height: 1;
        }
        .lm-venue-count-label { font-size: 0.58rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); text-align: center; }

        /* STAT ROW */
        .lm-stats {
          display: flex; gap: 0; border: 1px solid var(--border); border-radius: 10px;
          overflow: hidden; margin-bottom: 64px;
        }
        .lm-stat {
          flex: 1; padding: 20px; text-align: center; border-right: 1px solid var(--border);
        }
        .lm-stat:last-child { border-right: none; }
        .lm-stat-num { font-family: var(--serif); font-size: 2rem; font-weight: 700; color: var(--accent); line-height: 1; margin-bottom: 4px; }
        .lm-stat-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }

        @media (max-width: 640px) {
          .lm-hero { height: 70vh; min-height: 400px; }
          .lm-hero-title { font-size: clamp(2.6rem, 14vw, 4rem); }
          .lm-page { padding: 0 16px; }
          .lm-section { padding: 48px 0; }
          .lm-events-grid { grid-template-columns: 1fr; }
          .lm-musicians-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .lm-venues-grid { grid-template-columns: 1fr; }
          .lm-stats { flex-wrap: wrap; }
          .lm-stat { flex: 1 1 50%; border-bottom: 1px solid var(--border); }
          .lm-stat:nth-child(even) { border-right: none; }
        }
      `}</style>

      {/* ── HERO ── */}
      <section className="lm-hero" aria-label="Live music in Topeka KS">
        <img src={HERO_IMG} alt="Live music in Topeka, KS" className="lm-hero-img" />
        <div className="lm-hero-body">
          <p className="lm-hero-eyebrow">Topeka, Kansas</p>
          <h1 className="lm-hero-title">Keep <span>Music</span> Live</h1>
          <p className="lm-hero-byline">— Suki</p>
          <p className="lm-hero-sub">
            Your guide to live music in Topeka, KS — concerts, local artists, and the venues keeping it all alive.
          </p>
          <a href="#concerts" className="lm-hero-cta">
            See Upcoming Concerts
          </a>
        </div>
        <div className="lm-hero-scroll" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </section>

      <div className="lm-page">

        {/* ── STATS ── */}
        <div className="lm-stats" style={{ marginTop: 48 }}>
          <div className="lm-stat">
            <div className="lm-stat-num">{initialEvents.length}</div>
            <div className="lm-stat-label">Upcoming Shows</div>
          </div>
          <div className="lm-stat">
            <div className="lm-stat-num">{initialMusicians.length}</div>
            <div className="lm-stat-label">Local Musicians</div>
          </div>
          <div className="lm-stat">
            <div className="lm-stat-num">{venues.length}</div>
            <div className="lm-stat-label">Music Venues</div>
          </div>
          <div className="lm-stat">
            <div className="lm-stat-num">785</div>
            <div className="lm-stat-label">Area Code</div>
          </div>
        </div>

        {/* ── CONCERTS ── */}
        <section className="lm-section" id="concerts">
          <div className="lm-section-head">
            <div>
              <h2 className="lm-section-title">
                Upcoming <em>Concerts</em><br />& Music Events
              </h2>
            </div>
            <span className="lm-section-count">{totalEvents} show{totalEvents !== 1 ? 's' : ''}</span>
          </div>

          <div className="lm-search-row">
            <input
              className="lm-search"
              type="search"
              placeholder="Search by artist, venue, or neighborhood…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              aria-label="Search live music events"
            />
          </div>

          <div className="lm-events-grid">
            {pagedEvents.length === 0 ? (
              <div className="lm-empty">
                {search ? `No shows matching "${search}"` : 'No upcoming shows — check back soon.'}
              </div>
            ) : (
              pagedEvents.map(event => {
                const time = formatTime(event.event_start_time)
                const types = (event.event_types || []).filter(t => t !== 'Live Music').slice(0, 2)
                const href = event.slug ? `/events/${event.slug}` : '#'
                const isFree = event.ticket_price === 0
                const isPaid = event.ticket_price !== null && event.ticket_price > 0

                return (
                  <a key={event.id} href={href} className={`lm-event-card${event.star ? ' starred' : ''}`}>
                    <div className="lm-event-img-wrap">
                      {event.image_url
                        ? <img src={event.image_url} alt={event.title} className="lm-event-img" />
                        : <div className="lm-event-no-img">{event.title[0]}</div>
                      }
                      {event.star && <span className="lm-event-star-badge">★ Featured</span>}
                      <span className="lm-event-date-badge">{formatShortDate(event.event_date)}</span>
                    </div>
                    <div className="lm-event-body">
                      <div className="lm-event-meta">
                        {time && <span className="lm-event-time">{time}</span>}
                        {types.map(t => <span key={t} className="lm-event-type-tag">{t}</span>)}
                      </div>
                      <div className="lm-event-title">{event.title}</div>
                      {event.venue && (
                        <div className="lm-event-venue">
                          <strong>{event.venue.name}</strong>
                          {event.venue.neighborhood && ` · ${event.venue.neighborhood}`}
                        </div>
                      )}
                      {(isFree || isPaid) && (
                        <div className={`lm-event-price ${isFree ? 'free' : 'paid'}`}>
                          {isFree ? 'Free' : `$${event.ticket_price}`}
                        </div>
                      )}
                    </div>
                  </a>
                )
              })
            )}
          </div>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <nav className="lm-pagination" aria-label="Events pagination">
              <button
                className="lm-page-arrow"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                ←
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | '…')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === '…'
                    ? <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--ink-faint)' }}>…</span>
                    : <button
                        key={p}
                        className={`lm-page-btn${page === p ? ' active' : ''}`}
                        onClick={() => setPage(p as number)}
                        aria-label={`Page ${p}`}
                        aria-current={page === p ? 'page' : undefined}
                      >{p}</button>
                )
              }
              <button
                className="lm-page-arrow"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                →
              </button>
            </nav>
          )}
        </section>

        {/* ── MUSICIANS ── */}
        <section className="lm-section" id="musicians">
          <div className="lm-section-head">
            <div>
              <h2 className="lm-section-title">
                Local <em>Musicians</em>
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: 6, fontWeight: 300 }}>
                Topeka artists keeping the scene alive
              </p>
            </div>
            <a href="/artists?type=Musician" className="lm-view-all">
              View all {initialMusicians.length} musicians →
            </a>
          </div>

          <div className="lm-musicians-grid">
            {displayedMusicians.map(musician => {
              const genres = musician.musician_profile?.musical_genres?.slice(0, 2) || []
              return (
                <a
                  key={musician.id}
                  href={musician.slug ? `/artists/${musician.slug}` : '/artists?type=Musician'}
                  className="lm-musician-card"
                >
                  {musician.avatar_url || musician.image_url
                    ? <img
                        src={musician.avatar_url ?? musician.image_url ?? ''}
                        alt={musician.name}
                        className="lm-musician-avatar"
                      />
                    : <div className="lm-musician-avatar-placeholder">{musician.name[0]}</div>
                  }
                  <div className="lm-musician-name">{musician.name}</div>
                  {genres.length > 0 && (
                    <div className="lm-musician-genres">{genres.join(' · ')}</div>
                  )}
                </a>
              )
            })}
          </div>
        </section>

        {/* ── VENUES ── */}
        <section className="lm-section" id="venues">
          <div className="lm-section-head">
            <div>
              <h2 className="lm-section-title">
                Music <em>Venues</em>
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: 6, fontWeight: 300 }}>
                Where the music happens in Topeka, KS
              </p>
            </div>
            <a href="/venues" className="lm-view-all">
              All venues →
            </a>
          </div>

          <div className="lm-venues-grid">
            {sortedVenues.length === 0 ? (
              <p style={{ color: 'var(--ink-faint)', fontSize: '0.9rem' }}>No music venues listed yet.</p>
            ) : (
              sortedVenues.map(venue => {
                const imgSrc = venue.logo || venue.image_url
                const href = venue.slug ? `/venues/${venue.slug}` : '/venues'
                return (
                  <a key={venue.id} href={href} className="lm-venue-card">
                    {imgSrc
                      ? <img src={imgSrc} alt={venue.name} className="lm-venue-img" />
                      : <div className="lm-venue-placeholder">{venue.name[0]}</div>
                    }
                    <div className="lm-venue-info">
                      <div className="lm-venue-name">{venue.name}</div>
                      <div className="lm-venue-addr">
                        {[venue.neighborhood, venue.address].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="lm-venue-count">
                      <span className="lm-venue-count-num">{venue.upcoming_count}</span>
                      <span className="lm-venue-count-label">upcoming<br />show{venue.upcoming_count !== 1 ? 's' : ''}</span>
                    </div>
                  </a>
                )
              })
            )}
          </div>
        </section>

        {/* ── FOOTER CTA ── */}
        <section style={{ padding: '48px 0 64px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: 12 }}>
            Know a show we&rsquo;re missing?
          </p>
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 24, fontWeight: 300 }}>
            Submit events, claim your artist profile, and help build the Topeka music scene.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="/events"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--accent)', color: 'white',
                fontFamily: 'var(--serif)', fontSize: '0.88rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '13px 28px', borderRadius: 4, textDecoration: 'none',
              }}
            >
              All Events
            </a>
            <a
              href="/artists"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'transparent', color: 'var(--ink)',
                fontFamily: 'var(--serif)', fontSize: '0.88rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '13px 28px', borderRadius: 4, textDecoration: 'none',
                border: '2px solid var(--border)',
              }}
            >
              Artist Directory
            </a>
          </div>
        </section>

      </div>
    </>
  )
}
