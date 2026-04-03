'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Venue = {
  id: string
  name: string
  slug: string | null
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  image_url: string | null
  logo: string | null
  venue_type: string[] | null
}

type Event = {
  id: string
  title: string
  slug: string | null
  event_date: string
  event_start_time: string | null
  image_url: string | null
  ticket_price: number | null
  venues: { id: string; name: string; slug: string | null } | null
}

// Fisher-Yates shuffle — runs client-side so venues appear random each visit
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function ArtGalleriesClient() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchData() {
      const { data: venueData } = await supabase
        .from('venues')
        .select('id, name, slug, address, neighborhood, city, state, image_url, logo, venue_type')
        .overlaps('venue_type', ['Studio / Classes', 'Gallery / Museum', 'Artist Studio', 'First Friday ArtWalk'])

      const venues = venueData || []
      // Shuffle so order is random on each page load
      setVenues(shuffle(venues))

      if (venues.length > 0) {
        const venueIds = venues.map((v: Venue) => v.id)
        const today = new Date().toLocaleDateString('en-CA')

        // Cap at 6 months in the future
        const sixMonths = new Date()
        sixMonths.setMonth(sixMonths.getMonth() + 6)
        const maxDate = sixMonths.toLocaleDateString('en-CA')

        const { data: eventData } = await supabase
          .from('events')
          .select('id, title, slug, event_date, event_start_time, image_url, ticket_price, venues(id, name, slug)')
          .in('venue_id', venueIds)
          .gte('event_date', today)
          .lte('event_date', maxDate)
          .order('event_date', { ascending: true })

        setEvents((eventData || []) as unknown as Event[])
      }

      setLoading(false)
    }
    fetchData()
  }, [])

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth * 0.75
    scrollRef.current.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' })
  }

  // Group events by date
  const eventsByDate = events.reduce<Record<string, Event[]>>((acc, event) => {
    const key = event.event_date
    if (!acc[key]) acc[key] = []
    acc[key].push(event)
    return acc
  }, {})

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    if (d.getTime() === today.getTime()) return 'Today'
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const formatTime = (t: string | null) => {
    if (!t) return null
    const [hStr, mStr] = t.split(':')
    let h = parseInt(hStr, 10)
    const m = mStr ?? '00'
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return `${h}:${m} ${ampm}`
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #b8b3ad;
          --white: #ffffff; --off: #f7f6f4; --warm: #f2ede6;
          --accent: #C80650; --border: #ece8e2;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { overflow-x: hidden; max-width: 100vw; background: var(--white); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
        .page { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

        /* ── HEADER ── */
        .header { padding: 48px 0 36px; border-bottom: 1px solid var(--border); }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .header-eyebrow { font-size: 0.68rem; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; animation: fadeUp 0.5s ease both; }
        .header-title { font-family: var(--serif); font-size: clamp(2rem, calc(1.14rem + 4.29vw), 5rem); font-weight: 700; text-transform: uppercase; line-height: 0.95; letter-spacing: 0.04em; animation: fadeUp 0.5s ease 0.08s both; }
        .header-title em { font-style: normal; color: var(--accent); }
        .header-sub { font-size: 0.9rem; color: var(--ink-soft); margin-top: 12px; max-width: 480px; line-height: 1.55; animation: fadeUp 0.5s ease 0.18s both; }
        .header-count { font-size: 0.75rem; color: var(--ink-soft); margin-top: 10px; animation: fadeUp 0.5s ease 0.28s both; }

        /* ── SECTION HEADER ── */
        .section { padding: 40px 0 8px; }
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 16px; }
        .section-title { font-family: var(--serif); font-size: 1.1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink); }
        .section-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .view-all-link { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); text-decoration: none; transition: opacity 0.15s; white-space: nowrap; }
        .view-all-link:hover { opacity: 0.7; }
        .carousel-btn { width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid var(--border); background: var(--white); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s, background 0.15s; flex-shrink: 0; }
        .carousel-btn:hover { border-color: var(--ink); background: var(--ink); color: var(--white); }
        .carousel-btn svg { width: 14px; height: 14px; }

        /* ── VENUE CAROUSEL ── */
        .venues-carousel-wrap { position: relative; margin: 0 -24px; padding: 0 24px; }
        .venues-carousel { display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; padding-bottom: 16px; scrollbar-width: none; }
        .venues-carousel::-webkit-scrollbar { display: none; }

        /* ── VENUE CARD (Nashville style) ── */
        .venue-card { text-decoration: none; color: var(--ink); flex: 0 0 280px; scroll-snap-align: start; display: flex; flex-direction: column; -webkit-tap-highlight-color: transparent; }
        .venue-card-img-wrap { position: relative; width: 100%; aspect-ratio: 3/2; border-radius: 8px; overflow: hidden; background: #1a1814; }
        .venue-card-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
        .venue-card:hover .venue-card-img-wrap img { transform: scale(1.04); }
        .venue-card-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 3rem; font-weight: 700; color: rgba(255,255,255,0.08); text-transform: uppercase; background: linear-gradient(135deg, #2a2620, #1a1814); }
        .venue-card-badge { position: absolute; top: 10px; left: 10px; background: var(--accent); color: #fff; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; }
        .venue-card-body { padding: 12px 0 0; }
        .venue-card-name { font-family: var(--serif); font-size: 0.95rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; line-height: 1.15; margin-bottom: 4px; }
        .venue-card-location { font-size: 0.75rem; color: var(--ink-soft); display: flex; align-items: center; gap: 4px; }
        .venue-card-location svg { flex-shrink: 0; opacity: 0.6; }

        /* ── EVENTS SECTION ── */
        .events-section { padding: 32px 0 80px; }
        .events-section-title { font-family: var(--serif); font-size: 1.1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink); margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
        .events-count-chip { font-size: 0.68rem; font-weight: 600; background: var(--off); border: 1px solid var(--border); border-radius: 20px; padding: 2px 10px; color: var(--ink-soft); letter-spacing: 0; }
        .date-group { margin-bottom: 36px; }
        .date-label { font-family: var(--serif); font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-soft); padding: 8px 0; border-bottom: 1px solid var(--border); margin-bottom: 0; }

        /* ── EVENT ROW — desktop: 16:9 thumb, mobile: square ── */
        .event-row { display: grid; grid-template-columns: 200px 1fr; gap: 0; text-decoration: none; color: var(--ink); border-bottom: 1px solid var(--border); transition: opacity 0.15s; -webkit-tap-highlight-color: transparent; overflow: hidden; }
        .event-row:last-child { border-bottom: none; }
        .event-row:hover { opacity: 0.7; }
        .event-thumb { width: 100%; aspect-ratio: 16/9; overflow: hidden; background: var(--off); flex-shrink: 0; }
        .event-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .event-thumb-empty { width: 100%; height: 100%; background: linear-gradient(135deg, #2a2620, #1a1814); }
        .event-info { padding: 16px 20px; display: flex; flex-direction: column; justify-content: center; gap: 6px; min-width: 0; }
        .event-date-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); }
        .event-title { font-family: var(--serif); font-size: 1.05rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.2; }
        .event-meta { font-size: 0.78rem; color: var(--ink-soft); line-height: 1.4; }
        .event-price { display: inline-block; margin-top: 4px; font-size: 0.68rem; font-weight: 600; background: var(--off); border: 1px solid var(--border); border-radius: 4px; padding: 2px 8px; color: var(--ink-soft); }

        /* ── EMPTY / LOADING ── */
        .empty { padding: 48px 0; color: var(--ink-soft); }
        .empty-title { font-family: var(--serif); font-size: 1.1rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
        .empty-sub { font-size: 0.85rem; color: var(--ink-faint); }
        .loading { display: flex; align-items: center; justify-content: center; min-height: 320px; }
        .loading-dots { display: flex; gap: 8px; }
        .loading-dots span { width: 7px; height: 7px; background: var(--ink-faint); border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse { 0%,80%,100%{opacity:0.3;transform:scale(0.85)}40%{opacity:1;transform:scale(1)} }

        /* ── RESPONSIVE ── */
        @media (max-width: 700px) {
          .header { padding: 32px 0 24px; }
          .page { padding: 0 16px; }
          .venues-carousel-wrap { margin: 0 -16px; padding: 0 16px; }
          .venue-card { flex: 0 0 220px; }
          /* Mobile events: square thumb on left like the original */
          .event-row { grid-template-columns: 80px 1fr; }
          .event-thumb { aspect-ratio: 1/1; }
          .event-info { padding: 10px 14px; gap: 4px; }
          .event-title { font-size: 0.88rem; }
          .event-date-chip { font-size: 0.62rem; }
        }
      `}</style>

      <div className="page">
        <header className="header">
          <div className="header-eyebrow">Topeka, KS · Art &amp; Culture</div>
          <h1 className="header-title">Art <em>Galleries</em><br />+ Studios</h1>
          <p className="header-sub">Galleries, museums, and creative studios making Topeka&apos;s art scene.</p>
          {!loading && (
            <div className="header-count">{venues.length} {venues.length === 1 ? 'venue' : 'venues'}</div>
          )}
        </header>

        {loading ? (
          <div className="loading"><div className="loading-dots"><span /><span /><span /></div></div>
        ) : (
          <>
            {/* ── VENUES CAROUSEL ── */}
            <section className="section">
              <div className="section-header">
                <div className="section-title">Spaces</div>
                <div className="section-header-right">
                  <a
                    href="/venues?type=Gallery+%2F+Museum"
                    className="view-all-link"
                  >
                    View all art galleries →
                  </a>
                  <button className="carousel-btn" onClick={() => scroll('left')} aria-label="Scroll left">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button className="carousel-btn" onClick={() => scroll('right')} aria-label="Scroll right">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>

              {venues.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">No venues found</div>
                  <div className="empty-sub">Check back soon.</div>
                </div>
              ) : (
                <div className="venues-carousel-wrap">
                  <div className="venues-carousel" ref={scrollRef}>
                    {venues.map(venue => {
                      const img = venue.image_url || venue.logo
                      const typeLabel = venue.venue_type?.find(t =>
                        ['Gallery / Museum', 'Artist Studio', 'Studio / Classes', 'First Friday ArtWalk'].includes(t)
                      )
                      return (
                        <a
                          key={venue.id}
                          href={venue.slug ? `/venues/${venue.slug}` : '#'}
                          className="venue-card"
                        >
                          <div className="venue-card-img-wrap">
                            {img
                              ? <img src={img} alt={venue.name} loading="lazy" />
                              : <div className="venue-card-img-placeholder">{venue.name[0]}</div>
                            }
                            {typeLabel && (
                              <span className="venue-card-badge">{typeLabel}</span>
                            )}
                          </div>
                          <div className="venue-card-body">
                            <div className="venue-card-name">{venue.name}</div>
                            {(venue.neighborhood || venue.city) && (
                              <div className="venue-card-location">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                                </svg>
                                {venue.neighborhood || venue.city}
                              </div>
                            )}
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* ── EVENTS ── */}
            <section className="events-section">
              <div className="events-section-title">
                Upcoming Events
                {events.length > 0 && (
                  <span className="events-count-chip">{events.length}</span>
                )}
              </div>
              {events.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">No upcoming events</div>
                  <div className="empty-sub">Check back soon for exhibitions, classes, and openings.</div>
                </div>
              ) : (
                Object.entries(eventsByDate).map(([dateStr, dayEvents]) => {
                  const d = new Date(dateStr + 'T00:00:00')
                  const day = d.getDate().toString().padStart(2, '0')
                  const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
                  return (
                    <div key={dateStr} className="date-group">
                      <div className="date-label">{formatDateLabel(dateStr)}</div>
                      {dayEvents.map(event => (
                        <a
                          key={event.id}
                          href={event.slug ? `/events/${event.slug}` : `/events/${event.id}`}
                          className="event-row"
                        >
                          <div className="event-thumb">
                            {event.image_url
                              ? <img src={event.image_url} alt="" loading="lazy" />
                              : <div className="event-thumb-empty" />
                            }
                          </div>
                          <div className="event-info">
                            <div className="event-date-chip">
                              {day} {mon}
                              {formatTime(event.event_start_time) && (
                                <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>
                                  · {formatTime(event.event_start_time)}
                                </span>
                              )}
                            </div>
                            <div className="event-title">{event.title}</div>
                            {event.venues?.name && (
                              <div className="event-meta">{event.venues.name}</div>
                            )}
                            {event.ticket_price != null && event.ticket_price > 0 && (
                              <span className="event-price">${event.ticket_price}</span>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  )
                })
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
