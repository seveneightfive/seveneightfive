'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import DateFilter from './DateFilter'
import { useNavState } from '../components/NavContext'
import FilloutEmbed from '../components/FilloutEmbed'

type Venue = {
  id: string
  name: string
  address: string | null
  neighborhood: string | null
  city: string | null
  slug: string | null
}

type Event = {
  id: string
  title: string
  description: string | null
  event_date: string
  start_date: string | null
  end_date: string | null
  event_start_time: string | null
  event_end_time: string | null
  image_url: string | null
  ticket_price: number | null
  ticket_url: string | null
  learnmore_link: string | null
  event_types: string[] | null
  star: boolean | null
  slug: string | null
  venue: Venue | null
}

type DayGroup = {
  dateKey: string
  label: string
  sublabel: string
  events: Event[]
}

const EVENT_TYPES = [
  'All', 'Live Music', 'Art', 'Entertainment', 'Lifestyle',
  'Local Flavor', 'Community / Cultural', 'Party For A Cause',
  'Shop Local', 'Holiday', 'Exhibition',
  'Comedy Night', 'Open Mic', 'Poetry Reading', 'Trivia Night',
  'Bingo', 'Workshop / Class', 'Film / Screening', 'Dance', 'Theater',
]

function formatTime(t: string | null): string {
  if (!t || t.trim() === ':') return ''
  
  // Already has am/pm (e.g. "06:30 pm") — just clean it up
  const ampmMatch = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i)
  if (ampmMatch) {
    const h = parseInt(ampmMatch[1], 10)
    const m = parseInt(ampmMatch[2], 10)
    const ampm = ampmMatch[3].toUpperCase() === 'PM' ? 'P' : 'A'
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
  }
  
  // Fallback: 24-hour format (e.g. "18:30")
  const match = t.match(/(\d{1,2}):(\d{2})/)
  if (!match) return ''
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ampm = h >= 12 ? 'P' : 'A'
  const hour = h % 12 || 12
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatTimeShort(t: string | null): string {
  if (!t || t.trim() === ':') return ''
  const ampmMatch = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i)
  if (ampmMatch) {
    const h = parseInt(ampmMatch[1], 10)
    const m = parseInt(ampmMatch[2], 10)
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return m === 0 ? `${hour}` : `${hour}:${m.toString().padStart(2, '0')}`
  }
  return ''
}

function getDayGroups(events: Event[]): DayGroup[] {
  const map = new Map<string, Event[]>()
  events.forEach(e => {
    const key = e.event_date
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  })
  return Array.from(map.entries()).map(([key, evts]) => {
    const d = new Date(key + 'T12:00:00')
    const today = new Date(); today.setHours(12, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    let label = d.toLocaleDateString('en-US', { weekday: 'long' })
    const sublabel = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    if (d.toDateString() === today.toDateString()) label = 'Today'
    if (d.toDateString() === tomorrow.toDateString()) label = 'Tomorrow'
    return { dateKey: key, label, sublabel, events: evts }
  }).sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

export default function EventsList() {
  const [events, setEvents] = useState<Event[]>([])
  const [filtered, setFiltered] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState('All')
  const [search, setSearch] = useState('')
  const [showPast, setShowPast] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)  // ← ADD THIS
  const scrollRestored = useRef(false)
  const { setRightText } = useNavState()

  useEffect(() => {
    return () => { setRightText('') }
  }, [setRightText])

  useEffect(() => {
    if (!loading) setRightText(`${filtered.length} ${filtered.length === 1 ? 'Event' : 'Events'}`)
  }, [loading, filtered.length, setRightText])

  // ── Restore scroll position after events load ──────────────────────────────
  useEffect(() => {
    if (!loading && !scrollRestored.current) {
      const saved = sessionStorage.getItem('eventsScrollPos')
      if (saved) {
        scrollRestored.current = true
        // rAF ensures DOM is fully painted before scrolling
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: parseInt(saved), behavior: 'instant' })
            sessionStorage.removeItem('eventsScrollPos')
          })
        })
      }
    }
  }, [loading])

  // ── Save scroll position before navigating to event ───────────────────────
  const handleEventClick = useCallback((isExternal: boolean) => {
    if (!isExternal) {
      sessionStorage.setItem('eventsScrollPos', window.scrollY.toString())
    }
  }, [])

  useEffect(() => {
    async function fetchEvents() {
      const today = new Date().toLocaleDateString('en-CA')
      const { data, error } = await supabase
        .from('events')
        .select(`
          id, title, description, event_date, start_date, end_date,
          event_start_time, event_end_time, image_url, ticket_price,
          ticket_url, learnmore_link, event_types, star, slug,
          venues (id, name, address, neighborhood, city, slug)
        `)
        .gte('event_date', showPast ? '2020-01-01' : today)
        .order('event_date', { ascending: true })
        .order('event_start_time', { ascending: true })

      if (error) { console.error(error); setLoading(false); return }
      const mapped = (data || []).map((e: any) => ({
        ...e,
        venue: Array.isArray(e.venues) ? e.venues[0] || null : e.venues || null,
      }))
      setEvents(mapped)
      setFiltered(mapped)
      setLoading(false)
    }
    fetchEvents()
  }, [showPast])

  const applyFilters = useCallback(() => {
  let result = [...events]
  if (activeType !== 'All') result = result.filter(e => e.event_types?.includes(activeType))
  if (selectedDate) result = result.filter(e => e.event_date === selectedDate)
  if (search.trim()) {
    const q = search.toLowerCase()
    result = result.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.venue?.name.toLowerCase().includes(q)
    )
  }
  setFiltered(result)
}, [events, activeType, search, selectedDate])

  useEffect(() => { applyFilters() }, [applyFilters])

  const dayGroups = getDayGroups(filtered)
  const featuredEvents = events.filter(e => e.star).slice(0, 3)
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #b8b3ad;
          --white: #ffffff; --off: #f7f6f4; --warm: #f2ede6;
          --accent: #c8502a; --accent-light: #fdf1ec; --border: #ece8e2;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
          html, body { 
  overflow-x: hidden; 
  max-width: 100vw; 
}
        html, body { background: var(--white); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
        .page { max-width: 1100px; margin: 0 auto; padding: 0 24px; overflow:hidden; }
        .header { padding: 48px 0 36px; border-bottom: 1px solid var(--border); }
        .header-inner { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .header-date { font-size: 0.68rem; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
        .header-title { font-family: var(--serif); font-size: clamp(2.4rem, 6vw, 4rem); font-weight: 700; text-transform: uppercase; line-height: 0.95; letter-spacing: -0.01em; }
        .header-title em { font-style: normal; color: var(--accent); }
        .header-count { font-size: 0.75rem; color: var(--ink-faint); margin-top: 10px; }
        .search-wrap { position: relative; width: 100%; max-width: 340px; }
        .search-input { width: 100%; padding: 11px 16px 11px 42px; background: var(--off); border: 1.5px solid var(--border); border-radius: 100px; font-family: var(--sans); font-size: 0.88rem; color: var(--ink); outline: none; transition: border-color 0.15s, background 0.15s; }
        .search-input:focus { border-color: var(--ink); background: var(--white); }
        .search-input::placeholder { color: var(--ink-faint); }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--ink-faint); pointer-events: none; }
        .filters-bar { position: sticky; top: 0; z-index: 100; background: var(--white); border-bottom: 1px solid var(--border); padding: 12px 0; }
        .filters-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; gap: 12px; }
        .filter-scroll { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; flex: 1; }
        .filter-scroll::-webkit-scrollbar { display: none; }
        .filter-chip { padding: 6px 14px; border-radius: 100px; border: 1.5px solid var(--border); background: transparent; font-family: var(--sans); font-size: 0.78rem; font-weight: 500; color: var(--ink-soft); cursor: pointer; transition: all 0.15s; white-space: nowrap; flex-shrink: 0; }
        .filter-chip:hover { border-color: var(--ink); color: var(--ink); }
        .filter-chip.active { background: var(--ink); border-color: var(--ink); color: white; }
        .past-toggle { font-size: 0.72rem; font-weight: 500; color: var(--ink-faint); background: none; border: none; cursor: pointer; white-space: nowrap; padding: 6px 0; flex-shrink: 0; transition: color 0.15s; }
        .past-toggle:hover { color: var(--ink); }
        .past-toggle.active { color: var(--accent); }
        .featured-section { padding: 40px 0 0; }
        .section-eyebrow { font-size: 0.65rem; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
        .section-eyebrow::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .featured-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .featured-card { position: relative; border-radius: 8px; overflow: hidden; aspect-ratio: 4/3; text-decoration: none; display: block; background: var(--ink); }
        .featured-card:first-child { grid-column: span 2; aspect-ratio: 16/9; }
        .featured-img { width: 100%; height: 100%; object-fit: cover; opacity: 0.75; transition: transform 0.5s ease, opacity 0.3s; }
        .featured-card:hover .featured-img { transform: scale(1.04); opacity: 0.65; }
        .featured-no-img { width: 100%; height: 100%; background: linear-gradient(135deg, #2a2620, #1a1814); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 3rem; color: rgba(255,255,255,0.06); text-transform: uppercase; }
        .featured-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(26,24,20,0.9) 0%, transparent 55%); padding: 16px; display: flex; flex-direction: column; justify-content: flex-end; }
        .featured-type { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); margin-bottom: 5px; }
        .featured-title { font-family: var(--serif); font-size: 1rem; font-weight: 600; color: white; line-height: 1.2; text-transform: uppercase; letter-spacing: 0.02em; }
        .featured-card:first-child .featured-title { font-size: 1.3rem; }
        .featured-meta { font-size: 0.72rem; color: rgba(255,255,255,0.55); margin-top: 5px; }
        .star-badge { position: absolute; top: 12px; right: 12px; background: var(--accent); color: white; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border-radius: 100px; }
        .calendar { padding: 40px 0 80px; }
        .day-group { margin-bottom: 48px; }
        .day-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid var(--ink); }
        .day-label { font-family: var(--serif); font-size: 1.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em; line-height: 1; }
        .day-label.today { color: var(--accent); }
        .day-sublabel { font-size: 0.78rem; color: var(--ink-faint); }
        .day-count { margin-left: auto; font-size: 0.68rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); }
        .events-list { display: flex; flex-direction: column; gap: 1px; background: var(--border); border-radius: 8px; overflow: hidden; }
        .event-card { display: grid; grid-template-columns: 80px 1fr auto; background: var(--white); text-decoration: none; color: var(--ink); transition: background 0.12s; -webkit-tap-highlight-color: transparent; }
        .event-card:hover { background: var(--off); }
        .event-card.starred { background: var(--accent-light); }
        .event-card.starred:hover { background: #fae8e0; }
        .event-time-col { padding: 16px 12px 16px 16px; display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; border-right: 1px solid var(--border); flex-shrink: 0; }
        .event-time { font-family: var(--serif); font-size: 0.85rem; font-weight: 600; color: var(--ink); text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.2; white-space: nowrap; }
        .event-time-end { font-size: 0.68rem; color: var(--ink-faint); margin-top: 2px; }
        .event-time-tba { font-size: 0.7rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); }
        .event-body { padding: 14px 16px; min-width: 0; }
        .event-types-row { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 5px; }
        .event-type-tag { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); }
        .event-type-tag + .event-type-tag::before { content: '·'; margin-right: 5px; color: var(--ink-faint); }
        .event-title { font-family: var(--serif); font-size: 1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.2; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .event-venue { font-size: 0.78rem; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .event-venue-name { font-weight: 500; }
        .event-venue-neighborhood { color: var(--ink-faint); font-size: 0.72rem; }
        .event-description { font-size: 0.8rem; color: var(--ink-faint); line-height: 1.4; margin-top: 5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .event-right { padding: 14px 16px 14px 8px; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; flex-shrink: 0; gap: 8px; }
        .event-img-thumb { width: auto; height: 80px; border-radius: 6px; object-fit: cover; }
        .event-price { font-family: var(--serif); font-size: 0.85rem; font-weight: 600; color: var(--ink); white-space: nowrap; }
        .event-price.free { color: #2d7a2d; }
        .event-arrow { color: var(--ink-faint); font-size: 0.9rem; transition: transform 0.15s, color 0.15s; }
        .event-card:hover .event-arrow { transform: translateX(3px); color: var(--accent); }
        .empty { padding: 80px 24px; text-align: center; color: var(--ink-soft); }
        .empty-title { font-family: var(--serif); font-size: 1.4rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
        .empty-sub { font-size: 0.88rem; color: var(--ink-faint); }
        .loading { display: flex; align-items: center; justify-content: center; min-height: 320px; }
        .loading-dots { display: flex; gap: 8px; }
        .loading-dots span { width: 7px; height: 7px; background: var(--ink-faint); border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse { 0%,80%,100%{opacity:0.3;transform:scale(0.85)}40%{opacity:1;transform:scale(1)} }
        @media (max-width: 640px) {
          .header { padding: 32px 0 24px; }
          .header-inner { flex-direction: column; align-items: flex-start; gap: 16px; }
          .search-wrap { max-width: 100%; }
          .featured-grid { grid-template-columns: 1fr; }
          .featured-card:first-child { grid-column: span 1; aspect-ratio: 16/9; }
          .event-card { grid-template-columns: 68px 1fr auto; }
          .event-time-col { padding: 14px 10px 14px 14px; }
          .event-img-thumb { width: 48px; height: 48px; }
          .event-title { font-size: 0.9rem; }
          .page { padding: 0 16px; }
          .filters-inner { padding: 0 16px; }
          .day-label { font-size: 1.3rem; }
          .event-description { display: none; }
        }
        @media (max-width: 480px) {
          .event-right { padding: 12px 12px 12px 4px; }
          .event-img-thumb { display: none; }
        }
      `}</style>

      <div className="page">
        <header className="header">
          <div className="header-inner">
            <div>
              <div className="header-date">{todayStr}</div>
            </div>
            <div className="search-wrap">
              <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input className="search-input" type="text" placeholder="Search events, venues..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </header>
      </div>

      <div className="filters-bar">
        <div className="filters-inner">
          <div className="filter-scroll">
            {EVENT_TYPES.map(type => (
              <button key={type} className={`filter-chip ${activeType === type ? 'active' : ''}`} onClick={() => setActiveType(type)}>{type}</button>
            ))}
          </div>
          <DateFilter selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>
      </div>

      <div className="page">
        {loading ? (
          <div className="loading"><div className="loading-dots"><span/><span/><span/></div></div>
        ) : (
          <>
            {featuredEvents.length > 0 && activeType === 'All' && !search && (
              <section className="featured-section">
                <div className="section-eyebrow">Featured Events</div>
                <div className="featured-grid">
                  {featuredEvents.map(event => {
                    const href = event.slug ? `/events/${event.slug}` : event.ticket_url || event.learnmore_link || '#'
                    const isExternal = !event.slug
                    const d = new Date(event.event_date + 'T12:00:00')
                    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    return (
                      <a
                        key={event.id}
                        href={href}
                        target={isExternal ? '_blank' : '_self'}
                        rel={isExternal ? 'noopener noreferrer' : undefined}
                        className="featured-card"
                        onClick={() => handleEventClick(isExternal)}
                      >
                        {event.image_url ? <img src={event.image_url} alt={event.title} className="featured-img" /> : <div className="featured-no-img">{event.title[0]}</div>}
                        <div className="featured-overlay">
                          {event.event_types?.[0] && <div className="featured-type">{event.event_types[0]}</div>}
                          <div className="featured-title">{event.title}</div>
                          <div className="featured-meta">{dateStr}{event.event_start_time && ` · ${formatTime(event.event_start_time)}`}{event.venue && ` · ${event.venue.name}`}</div>
                        </div>
                        <div className="star-badge">★ Featured</div>
                      </a>
                    )
                  })}
                </div>
              </section>
            )}

            <section className="calendar">
              {dayGroups.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">No events found</div>
                  <div className="empty-sub">Try adjusting your filters or check back soon.</div>
                </div>
              ) : (
                dayGroups.map(group => (
                  <div key={group.dateKey} className="day-group">
                    <div className="day-header">
                      <span className={`day-label ${group.label === 'Today' ? 'today' : ''}`}>{group.label}</span>
                      <span className="day-sublabel">{group.sublabel}</span>
                      <span className="day-count">{group.events.length} {group.events.length === 1 ? 'event' : 'events'}</span>
                    </div>
                    <div className="events-list">
                      {group.events.map(event => {
                        const href = event.slug ? `/events/${event.slug}` : event.ticket_url || event.learnmore_link || '#'
                        const isExternal = !event.slug
                        return (
                          <a
                            key={event.id}
                            href={href}
                            target={isExternal ? '_blank' : '_self'}
                            rel={isExternal ? 'noopener noreferrer' : undefined}
                            className={`event-card${event.star ? ' starred' : ''}`}
                            onClick={() => handleEventClick(isExternal)}
                          >
                            <div className="event-time-col">
                              {event.event_start_time ? (
                                <>
                                  <span className="event-time">{formatTime(event.event_start_time)}</span>
                                  {event.event_end_time && <span className="event-time-end">→ {formatTimeShort(event.event_end_time)}</span>}
                                </>
                              ) : <span className="event-time-tba">TBA</span>}
                            </div>
                            <div className="event-body">
                              {event.event_types && event.event_types.length > 0 && (
                                <div className="event-types-row">{event.event_types.slice(0, 2).map(t => <span key={t} className="event-type-tag">{t}</span>)}</div>
                              )}
                              <div className="event-title">{event.title}</div>
                              {event.venue && (
                                <div className="event-venue">
                                  <span className="event-venue-name">{event.venue.name}</span>
                                  {(event.venue.neighborhood || event.venue.city) && (
                                    <span className="event-venue-neighborhood"> · {event.venue.neighborhood || event.venue.city}</span>
                                  )}
                                </div>
                              )}
                              {event.description && <div className="event-description">{event.description}</div>}
                            </div>
                            <div className="event-right">
                              {event.image_url && <img src={event.image_url} alt={event.title} className="event-img-thumb" />}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                {event.ticket_price !== null && (
                                  <span className={`event-price ${event.ticket_price === 0 ? 'free' : ''}`}>
                                    {event.ticket_price === 0 ? 'Free' : `$${event.ticket_price}`}
                                  </span>
                                )}
                                <span className="event-arrow">→</span>
                              </div>
                            </div>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
      <FilloutEmbed />
    </>
  )
}
