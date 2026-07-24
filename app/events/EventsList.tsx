'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import BrowseHeader from '../components/BrowseHeader'
import SearchFilterSheet, { getActiveFilterCount } from '../components/SearchFilterSheet'
import AdvertisementBanner from '../components/AdvertisementBanner'

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
  tags: string[] | null
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

// Must match the check constraint on events.event_types exactly — anything
// listed here that isn't one of these 9 values will always return zero
// results, since the column can't contain it.
const EVENT_TYPES = [
  'Art', 'Entertainment', 'Lifestyle', 'Local Flavor', 'Live Music',
  'Party For A Cause', 'Community / Cultural', 'Shop Local', 'Family',
]

// Descriptive sub-category tags from events.tags — additive to event_types,
// not a replacement (per the column's own schema comment). Kept as a
// separate hardcoded list (rather than an enum) since the DB column is
// plain text[], not constrained — update this list if new tags get used.
const EVENT_TAGS = [
  'Theater', 'Sports', 'Karaoke', 'Class', 'Dance', 'Trivia Night',
  'Bingo', 'Literary', 'Comedy Night', 'Exhibition', 'Open Mic',
  'Film Screening', 'Auditions', 'All Ages', 'Free', 'A Short Drive',
]

// One flat pill list in the Category section — the person filtering
// doesn't need to know or care which DB column a given value lives in.
const CATEGORY_OPTIONS = [...EVENT_TYPES, ...EVENT_TAGS]

function formatTime(t: string | null): string {
  if (!t || t.trim() === ':') return ''
  const ampmMatch = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i)
  if (ampmMatch) {
    const h = parseInt(ampmMatch[1], 10)
    const m = parseInt(ampmMatch[2], 10)
    const ampm = ampmMatch[3].toUpperCase() === 'PM' ? 'P' : 'A'
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
  }
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

function getDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

function getWeekendRange(): { start: string; end: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = today.getDay()
  const daysToFri = day <= 5 ? 5 - day : 6
  const fri = new Date(today)
  fri.setDate(today.getDate() + daysToFri)
  const sun = new Date(fri)
  sun.setDate(fri.getDate() + 2)
  return { start: getDateKey(fri), end: getDateKey(sun) }
}

export default function EventsList() {
  const [events, setEvents] = useState<Event[]>([])
  const [filtered, setFiltered] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showPast, setShowPast] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Search & Filter sheet state
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [quickDate, setQuickDate] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)

  const scrollRestored = useRef(false)

  useEffect(() => {
    if (!loading && !scrollRestored.current) {
      const saved = sessionStorage.getItem('eventsScrollPos')
      if (saved) {
        scrollRestored.current = true
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: parseInt(saved), behavior: 'instant' })
            sessionStorage.removeItem('eventsScrollPos')
          })
        })
      }
    }
  }, [loading])

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
          ticket_url, learnmore_link, event_types, tags, star, slug,
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

  // Resolve the quick-date radio (from the Search & Filter sheet) into a concrete date/range
  const quickDateRange = useMemo(() => {
    if (!quickDate) return null
    const todayKey = getDateKey(new Date())
    const tomorrowKey = getDateKey(new Date(Date.now() + 86400000))
    if (quickDate === 'today') return { start: todayKey, end: todayKey }
    if (quickDate === 'tomorrow') return { start: tomorrowKey, end: tomorrowKey }
    if (quickDate === 'weekend') return getWeekendRange()
    if (quickDate === 'month') {
      const now = new Date()
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { start: todayKey, end: getDateKey(end) }
    }
    return null
  }, [quickDate])

  const applyFilters = useCallback((source: Event[]) => {
    let result = [...source]

    if (selectedCategories.length > 0) {
      result = result.filter(e => {
        const eventCategories = [...(e.event_types || []), ...(e.tags || [])]
        return selectedCategories.some(cat => eventCategories.includes(cat))
      })
    }

    if (selectedDate) {
      result = result.filter(e => e.event_date === selectedDate)
    }

    if (startDate) result = result.filter(e => e.event_date >= startDate)
    if (endDate) result = result.filter(e => e.event_date <= endDate)

    if (quickDateRange) {
      result = result.filter(e => e.event_date >= quickDateRange.start && e.event_date <= quickDateRange.end)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.venue?.name.toLowerCase().includes(q)
      )
    }

    // Featured (starred) events first, then chronological — no longer user-selectable.
    result.sort((a, b) => {
      if (a.star === b.star) return a.event_date.localeCompare(b.event_date)
      return a.star ? -1 : 1
    })

    return result
  }, [selectedCategories, selectedDate, startDate, endDate, quickDateRange, search])

  useEffect(() => {
    setFiltered(applyFilters(events))
  }, [events, applyFilters])

  const clearAllFilters = () => {
    setSelectedCategories([])
    setSelectedDate(null)
    setQuickDate(null)
    setStartDate(null)
    setEndDate(null)
    setSearch('')
  }

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const activeFilterCount = getActiveFilterCount({ selectedCategories, quickDate, startDate, endDate, selectedDate })

  // The three date mechanisms (When pills, pick-a-day strip, start/end range)
  // are mutually exclusive — choosing one clears the other two so there's
  // never an ambiguous combination of date filters active at once.
  const handleQuickDate = (key: string | null) => {
    setQuickDate(key)
    if (key) {
      setSelectedDate(null)
      setStartDate(null)
      setEndDate(null)
    }
  }
  const handleSelectDate = (date: string | null) => {
    setSelectedDate(date)
    if (date) {
      setQuickDate(null)
      setStartDate(null)
      setEndDate(null)
    }
  }
  const handleStartDate = (v: string | null) => {
    setStartDate(v)
    if (v) {
      setQuickDate(null)
      setSelectedDate(null)
    }
  }
  const handleEndDate = (v: string | null) => {
    setEndDate(v)
    if (v) {
      setQuickDate(null)
      setSelectedDate(null)
    }
  }

  const dayGroups = getDayGroups(filtered)

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #b8b3ad;
          --white: #ffffff; --off: #f7f6f4; --warm: #f2ede6;
          --accent: #C80650; --accent-light: #fdf1ec; --border: #ece8e2;
          --yellow: #FFCE03;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--white); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
        .events-root { overflow-x: hidden; max-width: 100vw; }
        .page { max-width: 1100px; margin: 0 auto; padding: 0 24px; overflow: hidden; }

        .calendar { padding: 24px 0 80px; }
        .day-group { margin-bottom: 48px; }
        .day-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 3px solid var(--ink); }
        .day-label-box { background: var(--ink); padding: 10px 16px; flex-shrink: 0; }
        .day-label { font-family: var(--serif); font-size: 1.3rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1; color: var(--yellow); }
        .day-sublabel { font-size: 0.9rem; font-weight: 700; color: var(--ink); }
        .day-count { margin-left: auto; font-size: 11px; font-weight: 500; color: #111; background: #f0f0f0; padding: 2px 8px; border-radius: 10px; border: 0.5px solid #ddd; text-transform: lowercase; }
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
        .event-title { font-family: var(--serif); font-size: 1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.2; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
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
          .event-card { grid-template-columns: 68px 1fr auto; }
          .event-time-col { padding: 14px 10px 14px 14px; }
          .event-img-thumb { width: 48px; height: 48px; }
          .event-title { font-size: 0.9rem; }
          .page { padding: 0 16px; }
          .day-label { font-size: 1.1rem; }
          .day-label-box { padding: 8px 12px; }
          .event-description { display: none; }
        }
        @media (max-width: 480px) {
          .event-right { padding: 12px 12px 12px 4px; }
          .event-img-thumb { display: none; }
        }
      `}</style>

      <div className="events-root">
      <BrowseHeader
        title="Events"
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <SearchFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search events, artists, venues..."
        categories={CATEGORY_OPTIONS}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        quickDate={quickDate}
        onQuickDate={handleQuickDate}
        startDate={startDate}
        endDate={endDate}
        onStartDate={handleStartDate}
        onEndDate={handleEndDate}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        resultCount={filtered.length}
        resultLabel="Events"
        onClearAll={clearAllFilters}
      />

      <div className="page">
        {loading ? (
          <div className="loading">
            <div className="loading-dots"><span/><span/><span/></div>
          </div>
        ) : (
          <section className="calendar">
            {dayGroups.length === 0 ? (
              <div className="empty">
                <div className="empty-title">No events found</div>
                <div className="empty-sub">Try adjusting your filters or check back soon.</div>
              </div>
            ) : (
              dayGroups.map((group, groupIdx) => (
                <div key={group.dateKey}>
                {groupIdx === 1 && (
                  <div style={{ marginBottom: 48 }}>
                    <AdvertisementBanner />
                  </div>
                )}
                <div className="day-group">
                  <div className="day-header">
                    <div className="day-label-box">
                      <span className="day-label">{group.label.toUpperCase()}</span>
                    </div>
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
                                {event.event_end_time && (
                                  <span className="event-time-end">→ {formatTimeShort(event.event_end_time)}</span>
                                )}
                              </>
                            ) : (
                              <span className="event-time-tba">TBA</span>
                            )}
                          </div>
                          <div className="event-body">
                            {event.event_types && event.event_types.length > 0 && (
                              <div className="event-types-row">
                                {event.event_types.slice(0, 2).map(t => (
                                  <span key={t} className="event-type-tag">{t}</span>
                                ))}
                              </div>
                            )}
                            <div className="event-title">{event.title}</div>
                            {event.venue && (
                              <div className="event-venue">
                                <span className="event-venue-name">{event.venue.name}</span>
                                {(event.venue.neighborhood || event.venue.city) && (
                                  <span className="event-venue-neighborhood">
                                    {' · '}{event.venue.neighborhood || event.venue.city}
                                  </span>
                                )}
                              </div>
                            )}
                            {event.description && (
                              <div className="event-description">{event.description}</div>
                            )}
                          </div>
                          <div className="event-right">
                            {event.image_url && (
                              <img src={event.image_url} alt={event.title} className="event-img-thumb" />
                            )}
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
                </div>
              ))
            )}
          </section>
        )}
      </div>
      </div>
    </>
  )
}
