'use client'

import { Fragment, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import BrowseHeader, { type BrowseLinkGroup } from '../components/BrowseHeader'
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

type Artist = {
  name: string
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
  // Linked via event_artists — shown as the "featured artist" line on the
  // mobile row (all names, comma-separated) when non-empty.
  artists: Artist[]
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
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')}`
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

type EventsListProps = {
  // Server-rendered seed data (from app/events/page.tsx) so the page has
  // real, crawlable content in the initial HTML instead of an empty shell
  // while this client component's own Supabase fetch is still in flight.
  // The client fetch below still runs after mount to pick up anything that
  // changed since the server render, then replaces this seed.
  initialEvents?: Event[]
  // Passed straight through to BrowseHeader — see its own comment for what
  // this does. Omit entirely (as /artists, /venues do) to get the old
  // plain-title header with no dropdown.
  browseLinks?: BrowseLinkGroup[]
}

export default function EventsList({ initialEvents, browseLinks }: EventsListProps = {}) {
  const [events, setEvents] = useState<Event[]>(initialEvents ?? [])
  const [filtered, setFiltered] = useState<Event[]>(initialEvents ?? [])
  const [loading, setLoading] = useState(!initialEvents || initialEvents.length === 0)
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
  // Distinct from `loading`: `loading` is already false as soon as the SSR
  // seed (initialEvents, capped at 60) is in state, so gating scroll
  // restoration on `loading` alone was restoring against that truncated
  // list — anything scrolled to past event #60 got clamped to the bottom
  // of the short seed list instead of its real position. This only flips
  // true once the client-side fetch (unbounded, the real full list) has
  // actually landed.
  const [freshDataLoaded, setFreshDataLoaded] = useState(false)

  useEffect(() => {
    if (freshDataLoaded && !scrollRestored.current) {
      scrollRestored.current = true
      const saved = sessionStorage.getItem('eventsScrollPos')
      if (saved) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: parseInt(saved), behavior: 'instant' })
            sessionStorage.removeItem('eventsScrollPos')
          })
        })
      }
    }
  }, [freshDataLoaded])

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
          venues (id, name, address, neighborhood, city, slug),
          event_artists ( artists ( name, slug ) )
        `)
        .gte('event_date', showPast ? '2020-01-01' : today)
        .order('event_date', { ascending: true })
        .order('event_start_time', { ascending: true })

      if (error) { console.error(error); setLoading(false); return }
      const mapped = (data || []).map((e: any) => ({
        ...e,
        venue: Array.isArray(e.venues) ? e.venues[0] || null : e.venues || null,
        artists: (e.event_artists || []).map((ea: any) => ea.artists).filter(Boolean),
      }))
      setEvents(mapped)
      setFiltered(mapped)
      setLoading(false)
      setFreshDataLoaded(true)
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
        .events-root { max-width: 100vw; }
        .page { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

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

        /* Compact mobile row (matches EventListRow on the category pages) —
           hidden ≥641px, where .event-card (above) takes over instead. See
           the max-width:640px block below for .event-card-desktop hiding. */
        .event-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--white); text-decoration: none; color: var(--ink); -webkit-tap-highlight-color: transparent; }
        .event-row:active { background: var(--off); }
        .event-row.starred { background: var(--accent-light); }
        .event-row-thumb { width: 44px; height: 44px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: var(--ink); display: flex; align-items: center; justify-content: center; }
        .event-row-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .event-row-thumb span { color: rgba(255,255,255,0.15); font-size: 10px; font-weight: 700; }
        .event-row-body { min-width: 0; flex: 1; }
        .event-row-title { font-size: 0.85rem; margin-bottom: 2px; display: block; -webkit-line-clamp: unset; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .event-row-sub { font-size: 0.75rem; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .event-row-dot { color: var(--ink-faint); margin: 0 2px; }
        .event-row-artist { font-size: 0.72rem; color: var(--accent); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .event-row-chevron { flex-shrink: 0; color: var(--ink-faint); }
        @media (min-width: 641px) {
          .event-row { display: none; }
        }

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
          .event-card-desktop { display: none; }
          .page { padding: 0 16px; }

          /* Day header becomes a full-width bar on mobile instead of the
             badge + plain text treatment desktop keeps. Uses the viewport-
             relative bleed trick (same one SignupForm's .wrap uses) rather
             than a negative margin sized to cancel this component's own
             padding — .page here sits inside another 24px-padded wrapper
             from app/events/page.tsx, so a margin only large enough to
             cancel .page's own padding would still land short of the true
             edge. This version doesn't care how many padded ancestors are
             in between; it's always exactly the viewport width. */
          .day-header {
            width: 100vw;
            margin-left: calc(50% - 50vw);
            margin-right: calc(50% - 50vw);
            margin-bottom: 16px;
            padding: 10px 16px;
            background: var(--ink);
            border-bottom: none;
            gap: 10px;
          }
          .day-label-box { background: transparent; padding: 0; }
          .day-label { font-size: 1rem; }
          .day-sublabel { color: rgba(255,255,255,0.65); font-size: 0.78rem; }
          .day-count { background: var(--yellow); color: var(--ink); border: none; }

          /* Wider, 16:9 thumbnail instead of a 44px square — there was
             spare horizontal room to the left of the text in each row,
             this uses it rather than leaving it blank. Facebook's event
             list is the reference point: a landscape thumbnail, not a
             square avatar-style one. */
          .event-row-thumb { width: 112px; aspect-ratio: 16 / 9; height: auto; }
        }
      `}</style>

      <BrowseHeader
        title="Events"
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFiltersOpen(true)}
        browseLinks={browseLinks}
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

      <div className="events-root">
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
                      const artistNames = (event.artists || []).map(a => a.name).filter(Boolean).join(', ')
                      return (
                        <Fragment key={event.id}>
                          {/* Desktop card — unchanged from before, just hidden ≤640px now */}
                          <a
                            href={href}
                            target={isExternal ? '_blank' : '_self'}
                            rel={isExternal ? 'noopener noreferrer' : undefined}
                            className={`event-card event-card-desktop${event.star ? ' starred' : ''}`}
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

                          {/* Compact mobile row — hidden ≥641px (see .event-row CSS) */}
                          <a
                            href={href}
                            target={isExternal ? '_blank' : '_self'}
                            rel={isExternal ? 'noopener noreferrer' : undefined}
                            className={`event-row${event.star ? ' starred' : ''}`}
                            onClick={() => handleEventClick(isExternal)}
                          >
                            <div className="event-row-thumb">
                              {event.image_url ? (
                                <img src={event.image_url} alt="" />
                              ) : (
                                <span>785</span>
                              )}
                            </div>
                            <div className="event-row-body">
                              <div className="event-title event-row-title">{event.title}</div>
                              <div className="event-row-sub">
                                {event.event_start_time ? formatTime(event.event_start_time) : 'TBA'}
                                {event.venue?.name && (
                                  <>
                                    <span className="event-row-dot">·</span>
                                    {event.venue.name}
                                  </>
                                )}
                              </div>
                              {artistNames && (
                                <div className="event-row-artist">{artistNames}</div>
                              )}
                            </div>
                            <svg className="event-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </a>
                        </Fragment>
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
