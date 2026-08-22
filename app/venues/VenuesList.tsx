'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import BrowseHeader from '../components/BrowseHeader'
import SearchFilterSheet from '../components/SearchFilterSheet'
import FollowFavoriteButtons from '../components/FollowFavoriteButtons'

type Venue = {
  id: string
  name: string
  slug: string | null
  description: string | null
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  image_url: string | null
  logo: string | null
  website: string | null
  venue_type: string[] | null
  upcoming_events_count?: number
}

// Matches the neighborhood_enum values on venues.neighborhood exactly.
const NEIGHBORHOODS = [
  'Downtown', 'NOTO', 'North Topeka', 'Oakland', 'Westboro Mart',
  'College Hill', 'Lake Shawnee', 'Golden Mile', 'A Short Drive',
  'South Topeka', 'Midtown', 'West Topeka', 'East Topeka',
]

// Counts upcoming events per venue in one query, rather than N+1-ing it
// per card. Keyed by venue_id -> count.
async function fetchUpcomingEventCounts(): Promise<Record<string, number>> {
  const today = new Date().toLocaleDateString('en-CA')
  const { data, error } = await supabase
    .from('events')
    .select('venue_id')
    .gte('event_date', today)
    .not('venue_id', 'is', null)

  if (error) { console.error('event counts error:', error.message); return {} }

  const counts: Record<string, number> = {}
  for (const row of data || []) {
    const vid = (row as { venue_id: string }).venue_id
    counts[vid] = (counts[vid] || 0) + 1
  }
  return counts
}

export default function VenuesList({ initialNeighborhood, initialVenues = [] }: { initialNeighborhood?: string; initialVenues?: Venue[] }) {
  const [venues, setVenues] = useState<Venue[]>(initialVenues)
  const [filtered, setFiltered] = useState<Venue[]>(initialVenues)
  const [loading, setLoading] = useState(initialVenues.length === 0)
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Multi-select now (was single "All"/one-value before) — seeded from the
  // ?neighborhood= deep link if present, same as before.
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>(
    initialNeighborhood ? [initialNeighborhood] : []
  )
  const scrollRestored = useRef(false)

  useEffect(() => {
    if (!loading && !scrollRestored.current) {
      const saved = sessionStorage.getItem('venuesScrollPos')
      if (saved) {
        scrollRestored.current = true
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: parseInt(saved), behavior: 'instant' })
            sessionStorage.removeItem('venuesScrollPos')
          })
        })
      }
    }
  }, [loading])

  const handleVenueClick = useCallback(() => {
    sessionStorage.setItem('venuesScrollPos', window.scrollY.toString())
  }, [])

  useEffect(() => {
    if (initialVenues.length > 0) return // already have server-fetched data
    async function fetchVenues() {
      const [{ data, error }, counts] = await Promise.all([
        supabase
          .from('venues')
          .select('id, name, slug, description, address, neighborhood, city, state, image_url, logo, website, venue_type')
          .order('name'),
        fetchUpcomingEventCounts(),
      ])

      if (error) { console.error('venues error:', error.message, error.details); setLoading(false); return }
      const withCounts = (data || []).map(v => ({ ...v, upcoming_events_count: counts[v.id] || 0 }))
      setVenues(withCounts)
      setFiltered(withCounts)
      setLoading(false)
    }
    fetchVenues()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = useCallback(() => {
    let result = [...venues]
    if (selectedNeighborhoods.length > 0) {
      result = result.filter(v => v.neighborhood && selectedNeighborhoods.includes(v.neighborhood))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.neighborhood?.toLowerCase().includes(q) ||
        v.address?.toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [venues, selectedNeighborhoods, search])

  useEffect(() => { applyFilters() }, [applyFilters])

  const toggleNeighborhood = (n: string) => {
    setSelectedNeighborhoods(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])
  }
  const clearAllFilters = () => {
    setSelectedNeighborhoods([])
    setSearch('')
  }
  const activeFilterCount = selectedNeighborhoods.length

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #b8b3ad;
          --white: #ffffff; --off: #f7f6f4; --warm: #f2ede6;
          --accent: #C80650; --accent-light: #fdf1ec; --border: #ece8e2;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--white); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
        .venues-root { overflow-x: hidden; max-width: 100vw; }
        .page { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

        /* ── LIST ── */
        .grid-section { padding: 24px 0 80px; }
        .venues-grid { display: flex; flex-direction: column; gap: 16px; }

        /* ── VENUE CARD ── */
        .venue-card { text-decoration: none; color: var(--ink); display: flex; align-items: stretch; border-radius: 12px; overflow: hidden; border: 1.5px solid var(--border); background: var(--white); transition: border-color 0.15s, box-shadow 0.15s; -webkit-tap-highlight-color: transparent; }
        .venue-card:hover { border-color: var(--ink); box-shadow: 0 4px 20px rgba(0,0,0,0.08); }

        .venue-card-media { position: relative; width: 260px; flex-shrink: 0; }
        .venue-card-img { width: 100%; height: 100%; object-fit: cover; display: block; background: var(--off); }
        .venue-card-img-placeholder { width: 100%; height: 100%; min-height: 200px; background: linear-gradient(135deg, #2a2620, #1a1814); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 3rem; font-weight: 700; color: rgba(255,255,255,0.08); text-transform: uppercase; }
        .venue-card-heart-wrap { position: absolute; top: 12px; right: 12px; z-index: 2; }

        .venue-card-center { flex: 1 1 auto; min-width: 0; padding: 22px 24px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
        .venue-card-neighborhood-pill { align-self: flex-start; background: var(--accent); color: #fff; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 14px; border-radius: 6px; margin-bottom: 2px; }
        .venue-card-name { font-family: var(--serif); font-size: 1.35rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.15; }
        .venue-card-address { font-size: 0.82rem; color: var(--ink-soft); display: flex; align-items: center; gap: 6px; }
        .venue-card-desc { font-size: 0.85rem; color: var(--ink-soft); line-height: 1.55; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        .venue-card-right { width: 240px; flex-shrink: 0; padding: 22px 24px; display: flex; flex-direction: column; gap: 14px; }
        /* Hours will be populated from the Google Places sync in a future
           update — intentionally left blank for now, no placeholder copy. */
        .venue-card-type-pills { display: flex; flex-wrap: wrap; gap: 6px; }
        .venue-card-type-pill { background: var(--accent-light); color: var(--accent); font-size: 0.65rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; padding: 5px 11px; border-radius: 100px; }
        .venue-card-cta { margin-top: auto; background: var(--accent); color: #fff; text-align: center; font-size: 0.76rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 12px 16px; border-radius: 8px; transition: background 0.15s; }
        .venue-card:hover .venue-card-cta { background: #a20441; }

        /* ── EMPTY / LOADING ── */
        .empty { padding: 80px 24px; text-align: center; color: var(--ink-soft); }
        .empty-title { font-family: var(--serif); font-size: 1.4rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
        .empty-sub { font-size: 0.88rem; color: var(--ink-faint); }
        .loading { display: flex; align-items: center; justify-content: center; min-height: 320px; }
        .loading-dots { display: flex; gap: 8px; }
        .loading-dots span { width: 7px; height: 7px; background: var(--ink-faint); border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse { 0%,80%,100%{opacity:0.3;transform:scale(0.85)}40%{opacity:1;transform:scale(1)} }

        /* ── RESPONSIVE ── */
        @media (max-width: 860px) {
          .venue-card { flex-direction: column; }
          .venue-card-media { width: 100%; height: 200px; }
          .venue-card-center { border-right: none; border-bottom: 1px solid var(--border); }
          .venue-card-right { width: 100%; flex-direction: row; flex-wrap: wrap; align-items: center; }
          .venue-card-type-pills { flex: 1 1 auto; }
          .venue-card-cta { margin-top: 0; flex: 1 1 100%; }
        }
        @media (max-width: 640px) {
          .page { padding: 0 16px; }
          .venue-card-name { font-size: 1.1rem; }
          .venue-card-center { padding: 16px; }
          .venue-card-right { padding: 16px; }
        }
      `}</style>

      <BrowseHeader
        title="Venues"
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <SearchFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search venues..."
        categories={NEIGHBORHOODS}
        categoriesLabel="Neighborhood"
        selectedCategories={selectedNeighborhoods}
        onToggleCategory={toggleNeighborhood}
        showDateFilters={false}
        resultCount={filtered.length}
        resultLabel="Venues"
        onClearAll={clearAllFilters}
      />

      <div className="venues-root">
      <div className="page">
        {loading ? (
          <div className="loading"><div className="loading-dots"><span/><span/><span/></div></div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No venues found</div>
            <div className="empty-sub">Try adjusting your filters or search.</div>
          </div>
        ) : (
          <section className="grid-section">
            <div className="venues-grid">
              {filtered.map(venue => {
                const street = venue.address?.split(',')[0]
                const eventCount = venue.upcoming_events_count || 0
                return (
                  <a
                    key={venue.id}
                    href={venue.slug ? `/venues/${venue.slug}` : '#'}
                    className="venue-card"
                    onClick={handleVenueClick}
                  >
                    <div className="venue-card-media">
                      {venue.image_url || venue.logo
                        ? <img src={venue.image_url || venue.logo!} alt={venue.name} className="venue-card-img" />
                        : <div className="venue-card-img-placeholder">{venue.name[0]}</div>
                      }
                      <div
                        className="venue-card-heart-wrap"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                      >
                        <FollowFavoriteButtons entityType="venue" entityId={venue.id} heartOnly />
                      </div>
                    </div>

                    <div className="venue-card-center">
                      {venue.neighborhood && (
                        <span className="venue-card-neighborhood-pill">{venue.neighborhood}</span>
                      )}
                      <div className="venue-card-name">{venue.name}</div>
                      {street && (
                        <div className="venue-card-address">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                          {street}
                        </div>
                      )}
                      {venue.description && (
                        <p className="venue-card-desc">{venue.description}</p>
                      )}
                    </div>

                    <div className="venue-card-right">
                      {/* Hours — will be pulled in via the Google Places sync;
                          intentionally left blank until that's wired up. */}
                      {venue.venue_type && venue.venue_type.length > 0 && (
                        <div className="venue-card-type-pills">
                          {venue.venue_type.map(t => <span key={t} className="venue-card-type-pill">{t}</span>)}
                        </div>
                      )}
                      <div className="venue-card-cta">
                        {eventCount} Upcoming Event{eventCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          </section>
        )}
      </div>
      </div>
    </>
  )
}
