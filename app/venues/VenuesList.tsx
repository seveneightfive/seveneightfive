'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import BrowseHeader from '../components/BrowseHeader'
import SearchFilterSheet from '../components/SearchFilterSheet'

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
  website: string | null
  venue_type: string[] | null
}

// Matches the neighborhood_enum values on venues.neighborhood exactly.
const NEIGHBORHOODS = [
  'Downtown', 'NOTO', 'North Topeka', 'Oakland', 'Westboro Mart',
  'College Hill', 'Lake Shawnee', 'Golden Mile', 'A Short Drive',
  'South Topeka', 'Midtown', 'West Topeka', 'East Topeka',
]

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
      const { data, error } = await supabase
        .from('venues')
        .select('id, name, slug, address, neighborhood, city, state, image_url, logo, website, venue_type')
        .order('name')

      if (error) { console.error('venues error:', error.message, error.details); setLoading(false); return }
      setVenues(data || [])
      setFiltered(data || [])
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

        /* ── GRID ── */
        .grid-section { padding: 24px 0 80px; }
        .venues-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }

        /* ── VENUE CARD ── */
        .venue-card { text-decoration: none; color: var(--ink); display: flex; flex-direction: column; border-radius: 10px; overflow: hidden; border: 1.5px solid var(--border); transition: border-color 0.15s, box-shadow 0.15s; -webkit-tap-highlight-color: transparent; }
        .venue-card:hover { border-color: var(--ink); box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .venue-card-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: var(--off); }
        .venue-card-img-placeholder { width: 100%; aspect-ratio: 4/3; background: linear-gradient(135deg, #2a2620, #1a1814); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 3.5rem; font-weight: 700; color: rgba(255,255,255,0.06); text-transform: uppercase; letter-spacing: -0.02em; }
        .venue-card-body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .venue-card-type { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
        .venue-card-name { font-family: var(--serif); font-size: 1.1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.15; }
        .venue-card-location { font-size: 0.78rem; color: var(--ink-soft); display: flex; align-items: center; gap: 4px; }
        .venue-card-arrow { margin-top: auto; padding-top: 12px; display: flex; align-items: center; justify-content: space-between; }
        .venue-card-arrow-icon { color: var(--ink-faint); font-size: 0.9rem; transition: transform 0.15s, color 0.15s; }
        .venue-card:hover .venue-card-arrow-icon { transform: translateX(3px); color: var(--accent); }

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
        @media (max-width: 900px) { .venues-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) {
          .venues-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
          .page { padding: 0 16px; }
          .venue-card-name { font-size: 0.95rem; }
          .venue-card-body { padding: 12px; }
        }
        @media (max-width: 380px) { .venues-grid { grid-template-columns: 1fr; } }
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
              {filtered.map(venue => (
                <a
                  key={venue.id}
                  href={venue.slug ? `/venues/${venue.slug}` : '#'}
                  className="venue-card"
                  onClick={handleVenueClick}
                >
                  {venue.image_url || venue.logo
                    ? <img src={venue.image_url || venue.logo!} alt={venue.name} className="venue-card-img" />
                    : <div className="venue-card-img-placeholder">{venue.name[0]}</div>
                  }
                  <div className="venue-card-body">
                    {venue.venue_type && venue.venue_type.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                        {venue.venue_type.map(t => <div key={t} className="venue-card-type">{t}</div>)}
                      </div>
                    )}
                    <div className="venue-card-name">{venue.name}</div>
                    {(venue.neighborhood || venue.city) && (
                      <div className="venue-card-location">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
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
          </section>
        )}
      </div>
      </div>
    </>
  )
}
