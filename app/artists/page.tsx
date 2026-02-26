'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type Artist = {
  id: string
  name: string
  slug: string
  bio: string | null
  tagline: string | null
  image_url: string | null
  avatar_url: string | null
  artist_type: string | null
  verified: boolean
  location_city: string | null
  location_state: string | null
  musician_profile?: { musical_genres: string[] | null }
  visual_profile?: { visual_mediums: string[] | null }
}

const ARTIST_TYPES = ['All', 'Musician', 'Visual', 'Performance', 'Literary']

const TYPE_LABELS: Record<string, string> = {
  Musician: 'Musicians',
  Visual: 'Visual Artists',
  Performance: 'Performers',
  Literary: 'Literary Artists',
}

const MUSICAL_GENRES = [
  'Rock','Pop','Jazz','Classical','Electronic','Hip-Hop','Country',
  'Reggae','Blues','Folk','Singer-Songwriter','Spoken Word','Motown',
  'Funk','Americana','Punk','Grunge','Jam Band','Tejano','Latin',
  'DJ','Bluegrass','Rap'
]

const VISUAL_MEDIUMS = [
  'Photography','Digital / Print','Conceptual','Fiber Arts',
  'Sculpture / Clay','Airbrush / Street / Mural','Painting','Jewelry','Illustration'
]

const PERFORMANCE_TYPES = [
  'Actor / Stage performer','Dancer','Comedian','Spoken word / Slam poet','Theatre director / producer'
]

const LITERARY_GENRES = [
  'Books (fiction/non-fiction)','Poetry collections','Chapbooks / zines','Screenplays / scripts','Journalism / essays'
]

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [filtered, setFiltered] = useState<Artist[]>([])
  const [featured, setFeatured] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState('All')
  const [activeGenre, setActiveGenre] = useState('')

  useEffect(() => {
    async function fetchArtists() {
      const { data, error } = await supabase
        .from('artists')
        .select(`
          id, name, slug, bio, tagline, image_url, avatar_url,
          artist_type, verified, location_city, location_state,
          artist_musician_profiles (musical_genres),
          artist_visual_profiles (visual_mediums)
        `)
        .eq('published', true)
        .order('name')

      if (error) { console.error(error); return }

      const mapped = (data || []).map((a: any) => ({
  ...a,
  musician_profile: Array.isArray(a.artist_musician_profiles)
    ? a.artist_musician_profiles[0] || null
    : a.artist_musician_profiles || null,
  visual_profile: Array.isArray(a.artist_visual_profiles)
    ? a.artist_visual_profiles[0] || null
    : a.artist_visual_profiles || null,
}))

      setArtists(mapped)
      setFiltered(mapped)
      setFeatured(mapped.filter((a: Artist) => a.verified).slice(0, 4))
      console.log('first artist raw:', data?.[0])
console.log('first artist mapped:', mapped[0])
setLoading(false)
    }
    fetchArtists()
  }, [])

    const applyFilters = useCallback(() => {
  console.log('sample artist visual_profile:', artists[0]?.visual_profile)
  let result = [...artists]
    if (activeType !== 'All') {
      result = result.filter(a => a.artist_type === activeType)
    }
    if (activeGenre) {
      result = result.filter(a => {
        const musicGenres = a.musician_profile?.musical_genres || []
        const visualMediums = a.visual_profile?.visual_mediums || []
        return musicGenres.includes(activeGenre) || visualMediums.includes(activeGenre)
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.bio?.toLowerCase().includes(q) ||
        a.tagline?.toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [artists, activeType, activeGenre, search])

  useEffect(() => { applyFilters() }, [applyFilters])

  const getImage = (a: Artist) => a.avatar_url || a.image_url
  const getGenres = (a: Artist) => [
    ...(a.musician_profile?.musical_genres || []),
    ...(a.visual_profile?.visual_mediums || []),
  ].slice(0, 2)

  const getGenreList = () => {
    if (activeType === 'Musician') return MUSICAL_GENRES
    if (activeType === 'Visual') return VISUAL_MEDIUMS
    if (activeType === 'Performance') return PERFORMANCE_TYPES
    return LITERARY_GENRES
  }

  const getGenreLabel = () => {
    if (activeType === 'Musician') return 'Genre'
    if (activeType === 'Visual') return 'Medium'
    return 'Specialty'
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --ink: #1a1814;
          --ink-soft: #6b6560;
          --ink-faint: #b8b3ad;
          --paper: #faf9f7;
          --paper-warm: #f2ede6;
          --accent: #c8502a;
          --border: #e4dfd8;
          --serif: 'Oswald', sans-serif;
          --sans: 'DM Sans', system-ui, sans-serif;
        }

        body { background: var(--paper); color: var(--ink); font-family: var(--sans); }
        .page { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

        .header { padding: 48px 0 32px; border-bottom: 1px solid var(--border); margin-bottom: 48px; }
        .header-inner { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
        .header-title { font-family: var(--serif); font-size: clamp(2.2rem, 5vw, 3.5rem); font-weight: 300; line-height: 1.1; letter-spacing: 0.02em; text-transform: uppercase; }
        .header-title em { font-style: normal; font-weight: 600; color: var(--accent); }
        .header-count { font-size: 0.8rem; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); padding-bottom: 8px; }

        .search-wrap { position: relative; width: 100%; max-width: 420px; }
        .search-input { width: 100%; padding: 12px 16px 12px 44px; background: white; border: 1.5px solid var(--border); border-radius: 100px; font-family: var(--sans); font-size: 0.9rem; color: var(--ink); outline: none; transition: border-color 0.2s; }
        .search-input::placeholder { color: var(--ink-faint); }
        .search-input:focus { border-color: var(--ink); }
        .search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--ink-faint); pointer-events: none; }

        .filters { margin-bottom: 40px; }
        .filter-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .filter-chip { padding: 6px 16px; border-radius: 100px; border: 1.5px solid var(--border); background: transparent; font-family: var(--sans); font-size: 0.82rem; font-weight: 500; color: var(--ink-soft); cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .filter-chip:hover { border-color: var(--ink); color: var(--ink); }
        .filter-chip.active { background: var(--ink); border-color: var(--ink); color: white; }
        .filter-chip.genre-chip.active { background: var(--accent); border-color: var(--accent); color: white; }
        .genre-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .genre-scroll::-webkit-scrollbar { display: none; }
        .filter-label { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 8px; }

        .featured { margin-bottom: 64px; }
        .section-label { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
        .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .featured-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
        .featured-card { position: relative; border-radius: 4px; overflow: hidden; aspect-ratio: 3/4; cursor: pointer; background: var(--paper-warm); text-decoration: none; display: block; }
        .featured-card:nth-child(2) { aspect-ratio: 3/3.5; }
        .featured-card:nth-child(3) { aspect-ratio: 3/4.5; }
        .featured-card:nth-child(4) { aspect-ratio: 3/3.8; }
        .featured-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
        .featured-card:hover .featured-img { transform: scale(1.04); }
        .featured-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(26,24,20,0.85) 0%, transparent 50%); display: flex; flex-direction: column; justify-content: flex-end; padding: 20px; }
        .featured-no-img { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 3rem; color: var(--ink-faint); }
        .featured-name { font-family: var(--serif); font-size: 1.15rem; font-weight: 500; color: white; line-height: 1.2; text-transform: uppercase; letter-spacing: 0.03em; }
        .featured-type { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.65); margin-top: 4px; }
        .verified-dot { display: inline-block; width: 6px; height: 6px; background: var(--accent); border-radius: 50%; margin-left: 6px; vertical-align: middle; }

        .results-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .results-count { font-size: 0.8rem; color: var(--ink-soft); }
        .artists-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px 20px; }
        .artist-card { text-decoration: none; color: inherit; display: block; cursor: pointer; }
        .artist-card:hover .artist-img-wrap img { transform: scale(1.04); }
        .artist-img-wrap { overflow: hidden; border-radius: 3px; background: var(--paper-warm); margin-bottom: 12px; }
        .artist-card:nth-child(3n+1) .artist-img-wrap { aspect-ratio: 3/4; }
        .artist-card:nth-child(3n+2) .artist-img-wrap { aspect-ratio: 1; }
        .artist-card:nth-child(3n) .artist-img-wrap { aspect-ratio: 4/3; }
        .artist-img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; display: block; }
        .artist-no-img { width: 100%; min-height: 200px; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 2.5rem; color: var(--ink-faint); background: var(--paper-warm); }
        .artist-name { font-family: var(--serif); font-size: 0.95rem; font-weight: 500; line-height: 1.3; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
        .artist-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .artist-type-badge { font-size: 0.7rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
        .genre-tag { font-size: 0.7rem; color: var(--ink-faint); background: var(--paper-warm); padding: 2px 8px; border-radius: 100px; }
        .artist-location { font-size: 0.72rem; color: var(--ink-faint); margin-top: 3px; }

        .empty { text-align: center; padding: 80px 24px; color: var(--ink-soft); }
        .empty-title { font-family: var(--serif); font-size: 1.5rem; margin-bottom: 8px; color: var(--ink); }

        .loading { display: flex; align-items: center; justify-content: center; min-height: 400px; }
        .loading-dots { display: flex; gap: 8px; }
        .loading-dots span { width: 8px; height: 8px; background: var(--ink-faint); border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.9); } 40% { opacity: 1; transform: scale(1); } }

        @media (max-width: 640px) {
          .header-inner { flex-direction: column; align-items: flex-start; }
          .search-wrap { max-width: 100%; }
          .featured-grid { grid-template-columns: repeat(2, 1fr); }
          .artists-grid { grid-template-columns: repeat(2, 1fr); gap: 16px 12px; }
          .featured-card, .featured-card:nth-child(n) { aspect-ratio: 3/4; }
        }
      `}</style>

      <div className="page">
        <header className="header">
          <div className="header-inner">
            <div>
              <h1 className="header-title">The <em>785</em><br />Artist Directory</h1>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
              <span className="header-count">{artists.length} Artists</span>
              <div className="search-wrap">
                <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search artists..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </header>

        <div className="filters">
          <div className="filter-label">Type</div>
          <div className="filter-row">
            {ARTIST_TYPES.map(type => (
              <button
                key={type}
                className={`filter-chip ${activeType === type ? 'active' : ''}`}
                onClick={() => { setActiveType(type); setActiveGenre('') }}
              >
                {type === 'All' ? 'All Artists' : TYPE_LABELS[type] || type}
              </button>
            ))}
          </div>

          {activeType !== 'All' && (
            <>
              <div className="filter-label" style={{ marginTop: '16px' }}>{getGenreLabel()}</div>
              <div className="genre-scroll">
                <button
                  className={`filter-chip genre-chip ${activeGenre === '' ? 'active' : ''}`}
                  onClick={() => setActiveGenre('')}
                >
                  All
                </button>
                {getGenreList().map(genre => (
                  <button
                    key={genre}
                    className={`filter-chip genre-chip ${activeGenre === genre ? 'active' : ''}`}
                    onClick={() => setActiveGenre(activeGenre === genre ? '' : genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div className="loading">
            <div className="loading-dots"><span/><span/><span/></div>
          </div>
        ) : (
          <>
            {featured.length > 0 && activeType === 'All' && !search && !activeGenre && (
              <section className="featured">
                <div className="section-label">Featured Artists</div>
                <div className="featured-grid">
                  {featured.map(artist => (
                    <a key={artist.id} href={`/artists/${artist.slug}`} className="featured-card">
                      {getImage(artist) ? (
                        <img src={getImage(artist)!} alt={artist.name} className="featured-img" />
                      ) : (
                        <div className="featured-no-img">{artist.name[0]}</div>
                      )}
                      <div className="featured-overlay">
                        <div className="featured-name">
                          {artist.name}
                          {artist.verified && <span className="verified-dot" />}
                        </div>
                        <div className="featured-type">
                          {TYPE_LABELS[artist.artist_type || ''] || artist.artist_type}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="results-header">
                <div className="section-label" style={{ flex: 1, marginBottom: 0 }}>
                  {activeType === 'All' ? 'All Artists' : TYPE_LABELS[activeType] || activeType}
                </div>
                <span className="results-count">{filtered.length} results</span>
              </div>

              {filtered.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">No artists found</div>
                  <p>Try adjusting your search or filters.</p>
                </div>
              ) : (
                <div className="artists-grid">
                  {filtered.map(artist => (
                    <a key={artist.id} href={`/artists/${artist.slug}`} className="artist-card">
                      <div className="artist-img-wrap">
                        {getImage(artist) ? (
                          <img src={getImage(artist)!} alt={artist.name} loading="lazy" />
                        ) : (
                          <div className="artist-no-img">{artist.name[0]}</div>
                        )}
                      </div>
                      <div className="artist-name">
                        {artist.name}
                        {artist.verified && <span className="verified-dot" />}
                      </div>
                      <div className="artist-meta">
                        <span className="artist-type-badge">
                          {TYPE_LABELS[artist.artist_type || ''] || artist.artist_type || 'Artist'}
                        </span>
                        {getGenres(artist).map(g => (
                          <span key={g} className="genre-tag">{g}</span>
                        ))}
                      </div>
                      {artist.location_city && (
                        <div className="artist-location">
                          {artist.location_city}{artist.location_state ? `, ${artist.location_state}` : ''}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
