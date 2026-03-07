'use client'

import { useEffect, useState } from 'react'
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
  venue_type: string | null
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

export default function ArtGalleriesClient() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data: venueData } = await supabase
        .from('venues')
        .select('id, name, slug, address, neighborhood, city, state, image_url, venue_type')
        .in('venue_type', ['Studio / Classes', 'Gallery / Museum'])
        .order('name')

      const venues = venueData || []
      setVenues(venues)

      if (venues.length > 0) {
        const venueIds = venues.map((v: Venue) => v.id)
        const today = new Date().toLocaleDateString('en-CA')
        const { data: eventData } = await supabase
          .from('events')
          .select('id, title, slug, event_date, event_start_time, image_url, ticket_price, venues(id, name, slug)')
          .in('venue_id', venueIds)
          .gte('event_date', today)
          .order('event_date', { ascending: true })

        setEvents((eventData || []) as Event[])
      }

      setLoading(false)
    }
    fetchData()
  }, [])

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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #b8b3ad;
          --white: #ffffff; --off: #f7f6f4; --warm: #f2ede6;
          --accent: #C80650; --accent-light: #fdf1ec; --border: #ece8e2;
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

        /* ── VENUE GRID ── */
        .section { padding: 40px 0; }
        .section-title { font-family: var(--serif); font-size: 1.1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-faint); margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
        .section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .venues-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }

        /* ── VENUE CARD ── */
        .venue-card { text-decoration: none; color: var(--ink); display: flex; flex-direction: column; border-radius: 10px; overflow: hidden; border: 1.5px solid var(--border); transition: border-color 0.15s, box-shadow 0.15s; -webkit-tap-highlight-color: transparent; }
        .venue-card:hover { border-color: var(--ink); box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .venue-card-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: var(--off); }
        .venue-card-img-placeholder { width: 100%; aspect-ratio: 4/3; background: linear-gradient(135deg, #2a2620, #1a1814); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 3.5rem; font-weight: 700; color: rgba(255,255,255,0.06); text-transform: uppercase; }
        .venue-card-body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .venue-card-type { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
        .venue-card-name { font-family: var(--serif); font-size: 1.1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; line-height: 1.15; }
        .venue-card-location { font-size: 0.78rem; color: var(--ink-soft); display: flex; align-items: center; gap: 4px; }
        .venue-card-arrow { margin-top: auto; padding-top: 12px; display: flex; align-items: center; justify-content: space-between; }
        .venue-card-arrow-icon { color: var(--ink-faint); font-size: 0.9rem; transition: transform 0.15s, color 0.15s; }
        .venue-card:hover .venue-card-arrow-icon { transform: translateX(3px); color: var(--accent); }

        /* ── EVENTS LIST ── */
        .events-section { padding: 0 0 80px; }
        .date-group { margin-bottom: 32px; }
        .date-label { font-family: var(--serif); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-soft); padding: 10px 0; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
        .event-row { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--border); text-decoration: none; color: var(--ink); transition: opacity 0.15s; -webkit-tap-highlight-color: transparent; }
        .event-row:last-child { border-bottom: none; }
        .event-row:hover { opacity: 0.65; }
        .event-date-block { min-width: 48px; background: var(--ink); color: var(--white); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px 6px; font-family: var(--serif); flex-shrink: 0; }
        .event-day { font-size: 1.5rem; font-weight: 700; line-height: 1; }
        .event-mon { font-size: 0.6rem; font-weight: 400; letter-spacing: 0.15em; text-transform: uppercase; color: #FFCE03; }
        .event-info { flex: 1; min-width: 0; }
        .event-title { font-family: var(--serif); font-size: 1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; line-height: 1.2; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .event-meta { font-size: 0.78rem; color: var(--ink-soft); }
        .event-thumb { width: 64px; height: 64px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: var(--off); }
        .event-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .event-thumb-empty { width: 100%; height: 100%; background: linear-gradient(135deg, #2a2620, #1a1814); }

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
        @media (max-width: 900px) { .venues-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) {
          .header { padding: 32px 0 24px; }
          .page { padding: 0 16px; }
          .venues-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
          .venue-card-name { font-size: 0.95rem; }
          .venue-card-body { padding: 12px; }
          .event-title { font-size: 0.9rem; }
        }
        @media (max-width: 380px) { .venues-grid { grid-template-columns: 1fr; } }
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
            {/* Venue Grid */}
            <section className="section">
              <div className="section-title">Spaces</div>
              {venues.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">No venues found</div>
                  <div className="empty-sub">Check back soon.</div>
                </div>
              ) : (
                <div className="venues-grid">
                  {venues.map(venue => (
                    <a
                      key={venue.id}
                      href={venue.slug ? `/venues/${venue.slug}` : '#'}
                      className="venue-card"
                    >
                      {venue.image_url
                        ? <img src={venue.image_url} alt={venue.name} className="venue-card-img" />
                        : <div className="venue-card-img-placeholder">{venue.name[0]}</div>
                      }
                      <div className="venue-card-body">
                        {venue.venue_type && <div className="venue-card-type">{venue.venue_type}</div>}
                        <div className="venue-card-name">{venue.name}</div>
                        {(venue.neighborhood || venue.city) && (
                          <div className="venue-card-location">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                            </svg>
                            {venue.neighborhood || venue.city}
                          </div>
                        )}
                        <div className="venue-card-arrow">
                          <span style={{ fontSize: '0.72rem', color: 'var(--ink-faint)' }}>{venue.address?.split(',')[0]}</span>
                          <span className="venue-card-arrow-icon">→</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>

            {/* Events List */}
            <section className="events-section">
              <div className="section-title">
                Upcoming Events {events.length > 0 && `· ${events.length}`}
              </div>
              {events.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">No upcoming events</div>
                  <div className="empty-sub">Check back soon for exhibitions, classes, and openings.</div>
                </div>
              ) : (
                Object.entries(eventsByDate).map(([dateStr, dayEvents]) => (
                  <div key={dateStr} className="date-group">
                    <div className="date-label">{formatDateLabel(dateStr)}</div>
                    {dayEvents.map(event => {
                      const d = new Date(event.event_date + 'T00:00:00')
                      const day = d.getDate().toString().padStart(2, '0')
                      const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
                      return (
                        <a
                          key={event.id}
                          href={event.slug ? `/events/${event.slug}` : `/events/${event.id}`}
                          className="event-row"
                        >
                          <div className="event-date-block">
                            <span className="event-day">{day}</span>
                            <span className="event-mon">{mon}</span>
                          </div>
                          <div className="event-info">
                            <div className="event-title">{event.title}</div>
                            <div className="event-meta">
                              {event.venues?.name}
                              {event.event_start_time && ` · ${event.event_start_time}`}
                              {event.ticket_price != null && event.ticket_price > 0 && ` · $${event.ticket_price}`}
                            </div>
                          </div>
                          <div className="event-thumb">
                            {event.image_url
                              ? <img src={event.image_url} alt="" />
                              : <div className="event-thumb-empty" />
                            }
                          </div>
                        </a>
                      )
                    })}
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
