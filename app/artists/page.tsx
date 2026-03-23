'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useNavState } from '../components/NavContext'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  upcoming_event_count?: number
  musician_profile?: { musical_genres: string[] | null }
  visual_profile?: { visual_mediums: string[] | null }
}

type Exhibition = {
  id: string
  title: string
  slug: string | null
  image_url: string | null
  venue_name: string | null
  closing_date: string | null
  gallery_hours: string | null
  admission: string | null
  exhibition_type: string | null
  artist_count: number | null
  opening_reception: boolean
}

type Production = {
  id: string
  title: string
  slug: string | null
  image_url: string | null
  venue_name: string | null
  end_date: string | null
  next_performance_date: string | null
  next_performance_time: string | null
}

type Opportunity = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  type_slug: string | null
  type_label: string | null
  compensation_slug: string | null
  compensation_label: string | null
  is_paid: boolean
  organization_name: string | null
  deadline_date: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ARTIST_TYPES = ['All', 'Musician', 'Visual', 'Performance', 'Literary']

const TYPE_LABELS: Record<string, string> = {
  All: 'All Artists',
  Musician: 'Musician',
  Visual: 'Visual Artist',
  Performance: 'Performer',
  Literary: 'Literary Artist',
}

const TYPE_FILTER_LABELS: Record<string, string> = {
  All: 'All Artists',
  Musician: 'Musicians',
  Visual: 'Visual Artists',
  Performance: 'Performers',
  Literary: 'Literary Artists',
}

const EXHIBITION_TYPE_LABELS: Record<string, string> = {
  group: 'Group Show',
  solo: 'Solo Exhibition',
  juried: 'Juried',
  permanent: 'Permanent',
  pop_up: 'Pop-Up',
}

const MUSICAL_GENRES = [
  'Rock','Pop','Jazz','Classical','Electronic','Hip-Hop','Country',
  'Reggae','Blues','Folk','Singer-Songwriter','Spoken Word','Motown',
  'Funk','Americana','Punk','Grunge','Jam Band','Tejano','Latin',
  'DJ','Bluegrass','Rap',
]
const VISUAL_MEDIUMS = [
  'Photography','Digital / Print','Conceptual','Fiber Arts',
  'Sculpture / Clay','Airbrush / Street / Mural','Painting','Jewelry','Illustration',
]
const PERFORMANCE_TYPES = [
  'Actor / Stage performer','Dancer','Comedian','Spoken word / Slam poet','Theatre director / producer',
]
const LITERARY_GENRES = [
  'Books (fiction/non-fiction)','Poetry collections','Chapbooks / zines','Screenplays / scripts','Journalism / essays',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtShortDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDeadline(d: string): { label: string; urgent: boolean; closed: boolean } {
  const diff = Math.ceil((new Date(d + 'T23:59:59').getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: 'Closed', urgent: false, closed: true }
  if (diff === 0) return { label: 'Today', urgent: true, closed: false }
  if (diff <= 7) return { label: `${diff}d left`, urgent: true, closed: false }
  return { label: fmtShortDate(d), urgent: false, closed: false }
}

// ─── Exhibition Sidebar ───────────────────────────────────────────────────────

function ExhibitionSidebar({
  exhibitions,
  productions,
}: {
  exhibitions: Exhibition[]
  productions: Production[]
}) {
  const [exIdx, setExIdx] = useState(0)

  useEffect(() => {
    if (exhibitions.length <= 1) return
    const t = setInterval(() => setExIdx(i => (i + 1) % exhibitions.length), 6000)
    return () => clearInterval(t)
  }, [exhibitions.length])

  const hasSidebar = exhibitions.length > 0 || productions.length > 0
  if (!hasSidebar) return null

  return (
    <aside className="adir-sidebar">

      {exhibitions.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-eyebrow">
            <span className="sidebar-live sidebar-live--red" />
            On View Now
          </div>
          {exhibitions.map((ex, i) => (
            <a
              key={ex.id}
              href={ex.slug ? `/events/${ex.slug}` : '#'}
              className={`excard${i === exIdx ? ' excard--on' : ''}`}
              onClick={() => setExIdx(i)}
            >
              {ex.image_url && (
                <div className="excard-img-wrap">
                  <img src={ex.image_url} alt={ex.title} className="excard-img" />
                  {ex.exhibition_type && (
                    <span className="excard-badge">
                      {EXHIBITION_TYPE_LABELS[ex.exhibition_type] ?? ex.exhibition_type}
                    </span>
                  )}
                </div>
              )}
              <div className="excard-body">
                <p className="excard-title">{ex.title}</p>
                {ex.venue_name && <p className="excard-venue">{ex.venue_name}</p>}
                <div className="excard-metas">
                  {ex.closing_date && <span>Through {fmtShortDate(ex.closing_date)}</span>}
                  {(ex.artist_count ?? 0) > 1 && <span>{ex.artist_count} artists</span>}
                </div>
                {ex.opening_reception && (
                  <span className="excard-reception">Opening Reception</span>
                )}
                {ex.gallery_hours && <p className="excard-detail">{ex.gallery_hours}</p>}
                {ex.admission && <p className="excard-detail">{ex.admission}</p>}
              </div>
            </a>
          ))}
          {exhibitions.length > 1 && (
            <div className="sidebar-dots">
              {exhibitions.map((_, i) => (
                <button
                  key={i}
                  className={`sidebar-dot${i === exIdx ? ' sidebar-dot--on' : ''}`}
                  onClick={() => setExIdx(i)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {productions.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-eyebrow">
            <span className="sidebar-live sidebar-live--gold" />
            Now Playing
          </div>
          {productions.map(p => (
            <a key={p.id} href={p.slug ? `/events/${p.slug}` : '#'} className="procard">
              {p.image_url && (
                <div className="procard-img">
                  <img src={p.image_url} alt={p.title} />
                </div>
              )}
              <div className="procard-body">
                <p className="procard-title">{p.title}</p>
                {p.venue_name && <p className="procard-venue">{p.venue_name}</p>}
                {p.next_performance_date && (
                  <p className="procard-next">
                    Next: {fmtShortDate(p.next_performance_date)}
                    {p.next_performance_time ? ` · ${p.next_performance_time}` : ''}
                  </p>
                )}
                {p.end_date && <p className="procard-through">Through {fmtShortDate(p.end_date)}</p>}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Galleries page cross-link */}
      <a href="/topeka-art-galleries" className="sidebar-galleries-link">
        <span className="sidebar-galleries-icon">🖼</span>
        <div>
          <p className="sidebar-galleries-title">Art Galleries + Studios</p>
          <p className="sidebar-galleries-sub">Topeka's gallery & studio guide →</p>
        </div>
      </a>

      {/* Submit CTA */}
      <a href="/events/submit" className="sidebar-submit">
        Submit Your Exhibition or Show →
      </a>
    </aside>
  )
}

// ─── Opportunity Board ────────────────────────────────────────────────────────

function OpportunityBoard({ opportunities }: { opportunities: Opportunity[] }) {
  const [expanded, setExpanded] = useState(false)
  if (!opportunities.length) return null
  const visible = expanded ? opportunities : opportunities.slice(0, 4)

  return (
    <section className="opp-section">
      <div className="opp-header">
        <div>
          <h2 className="opp-heading">OPPORTUNITIES</h2>
          <p className="opp-sub">Gigs, grants, residencies &amp; open calls for Topeka artists</p>
        </div>
        <a href="/opportunities/submit" className="opp-post-btn">+ Post Opportunity</a>
      </div>
      <div className="opp-list">
        {visible.map(o => {
          const dl = o.deadline_date ? fmtDeadline(o.deadline_date) : null
          return (
            <a key={o.id} href={`/opportunities/${o.slug}`} className="opp-item">
              <div className="opp-item-left">
                <div className="opp-tags">
                  {o.type_label && <span className="opp-type">{o.type_label}</span>}
                  {o.compensation_slug && o.compensation_slug !== 'unknown' && (
                    <span className={`opp-comp${o.is_paid ? ' opp-comp--paid' : ''}`}>
                      {o.compensation_label}
                    </span>
                  )}
                </div>
                <p className="opp-title">{o.title}</p>
                {o.organization_name && <p className="opp-org">{o.organization_name}</p>}
                {o.excerpt && <p className="opp-excerpt">{o.excerpt}</p>}
              </div>
              <div className="opp-item-right">
                {dl && (
                  <div className="opp-dl">
                    <span className="opp-dl-label">Deadline</span>
                    <span className={`opp-dl-val${dl.urgent ? ' urgent' : ''}${dl.closed ? ' closed' : ''}`}>
                      {dl.label}
                    </span>
                  </div>
                )}
                <span className="opp-arrow">→</span>
              </div>
            </a>
          )
        })}
      </div>
      {opportunities.length > 4 && (
        <button className="opp-more" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : `Show all ${opportunities.length} opportunities`}
        </button>
      )}
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [filtered, setFiltered] = useState<Artist[]>([])
  const [featured, setFeatured] = useState<Artist[]>([])
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [productions, setProductions] = useState<Production[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [myArtistIds, setMyArtistIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState('All')
  const [activeGenre, setActiveGenre] = useState('')
  const [showMine, setShowMine] = useState(false)
  const { setLogoSuffix, setRightText } = useNavState()

  useEffect(() => {
    setLogoSuffix('ARTISTS')
    return () => { setLogoSuffix('MAGAZINE'); setRightText('') }
  }, [setLogoSuffix, setRightText])

  useEffect(() => {
    if (!loading) setRightText(`${artists.length} Artists`)
  }, [loading, artists.length, setRightText])

  // ── Fetch everything ────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      // Artists with upcoming event counts
      const { data: artistData, error: artistErr } = await supabase
        .from('artists')
        .select(`
          id, name, slug, bio, tagline, image_url, avatar_url,
          artist_type, verified, location_city, location_state,
          artist_musician_profiles (musical_genres),
          artist_visual_profiles (visual_mediums)
        `)
        .eq('published', true)
        .order('name')

      if (artistErr) { console.error(artistErr); return }

      // Upcoming event counts via event_artists join
      const { data: eventCounts } = await supabase
        .from('event_artists')
        .select('artist_id, events!inner(event_date)')
        .gte('events.event_date', new Date().toISOString().split('T')[0])

      const countMap: Record<string, number> = {}
      ;(eventCounts || []).forEach((row: any) => {
        countMap[row.artist_id] = (countMap[row.artist_id] || 0) + 1
      })

      const mapped = (artistData || []).map((a: any) => ({
        ...a,
        upcoming_event_count: countMap[a.id] || 0,
        musician_profile: Array.isArray(a.artist_musician_profiles)
          ? a.artist_musician_profiles[0] || null
          : a.artist_musician_profiles || null,
        visual_profile: Array.isArray(a.artist_visual_profiles)
          ? a.artist_visual_profiles[0] || null
          : a.artist_visual_profiles || null,
      }))

      setArtists(mapped)
      setFiltered(mapped)
      // Featured = verified artists, sorted by upcoming events desc
      const feat = mapped
        .filter((a: Artist) => a.verified)
        .sort((a: Artist, b: Artist) => (b.upcoming_event_count ?? 0) - (a.upcoming_event_count ?? 0))
        .slice(0, 5)
      setFeatured(feat)

      // Exhibitions on view now
      const { data: exData } = await supabase
        .from('events')
        .select(`
          id, title, slug, image_url,
          exhibition_details!inner (
            closing_date, gallery_hours, admission, exhibition_type, artist_count, opening_reception
          ),
          venues (name)
        `)
        .contains('event_types', ['Exhibition'])
        .or(`closing_date.gte.${new Date().toISOString().split('T')[0]},closing_date.is.null`, { foreignTable: 'exhibition_details' })
        .order('event_date', { ascending: false })
        .limit(6)

      if (exData) {
        setExhibitions(exData.map((e: any) => ({
          id: e.id,
          title: e.title,
          slug: e.slug,
          image_url: e.image_url,
          venue_name: e.venues?.name ?? null,
          closing_date: e.exhibition_details?.closing_date ?? null,
          gallery_hours: e.exhibition_details?.gallery_hours ?? null,
          admission: e.exhibition_details?.admission ?? null,
          exhibition_type: e.exhibition_details?.exhibition_type ?? null,
          artist_count: e.exhibition_details?.artist_count ?? null,
          opening_reception: e.exhibition_details?.opening_reception ?? false,
        })))
      }

      // Productions / long-run theatre
      const { data: prodData } = await supabase
        .from('events')
        .select(`
          id, title, slug, image_url, end_date,
          event_performances (performance_date, performance_time),
          venues (name)
        `)
        .eq('event_format', 'production')
        .gte('end_date', new Date().toISOString())
        .order('event_date', { ascending: false })
        .limit(4)

      if (prodData) {
        setProductions(prodData.map((p: any) => {
          const upcoming = (p.event_performances || [])
            .filter((perf: any) => perf.performance_date >= new Date().toISOString().split('T')[0])
            .sort((a: any, b: any) => a.performance_date.localeCompare(b.performance_date))
          const next = upcoming[0]
          return {
            id: p.id,
            title: p.title,
            slug: p.slug,
            image_url: p.image_url,
            venue_name: p.venues?.name ?? null,
            end_date: p.end_date ? p.end_date.split('T')[0] : null,
            next_performance_date: next?.performance_date ?? null,
            next_performance_time: next?.performance_time ?? null,
          }
        }))
      }

      // Opportunities
      const { data: oppData } = await supabase
        .from('opportunities')
        .select(`
          id, slug, title, excerpt, type_slug, compensation_slug,
          organization_name, deadline_date, is_featured,
          opportunity_types (label),
          compensation_types (label, is_paid)
        `)
        .eq('status', 'active')
        .eq('is_public', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20)

      if (oppData) {
        setOpportunities(oppData.map((o: any) => ({
          id: o.id,
          slug: o.slug,
          title: o.title,
          excerpt: o.excerpt,
          type_slug: o.type_slug,
          type_label: o.opportunity_types?.label ?? o.type_slug,
          compensation_slug: o.compensation_slug,
          compensation_label: o.compensation_types?.label ?? null,
          is_paid: o.compensation_types?.is_paid ?? false,
          organization_name: o.organization_name,
          deadline_date: o.deadline_date,
        })))
      }

      // My artists (logged-in user)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: myArtists } = await supabase
          .from('artist_users')
          .select('artist_id')
          .eq('user_id', user.id)
          .in('role', ['creator', 'admin', 'editor'])
        setMyArtistIds((myArtists || []).map((r: any) => r.artist_id))
      }

      setLoading(false)
    }
    fetchAll()
  }, [])

  // ── Filtering ────────────────────────────────────────────────────────────────
  const applyFilters = useCallback(() => {
    let result = [...artists]
    if (showMine) {
      result = result.filter(a => myArtistIds.includes(a.id))
    } else if (activeType !== 'All') {
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
  }, [artists, activeType, activeGenre, search, showMine, myArtistIds])

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

  const hasSidebar = (exhibitions.length > 0 || productions.length > 0)
  const isFiltered = !!(search.trim() || activeType !== 'All' || activeGenre || showMine)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --ink: #1a1814;
          --ink-soft: #6b6560;
          --ink-faint: #b8b3ad;
          --paper: #faf9f7;
          --paper-warm: #f2ede6;
          --accent: #C80650;
          --accent-light: #fff0f4;
          --gold: #FFCE03;
          --border: #e4dfd8;
          --serif: 'Oswald', sans-serif;
          --sans: 'DM Sans', system-ui, sans-serif;
        }

        body { background: #fff; color: var(--ink); font-family: var(--sans); }

        /* ── Page shell ── */
        .adir-wrap { max-width: 1280px; margin: 0 auto; padding: 0 32px 80px; }

        /* ── Partnership tagline ── */
        .adir-tagline {
          background: var(--paper);
          border-bottom: 1px solid var(--border);
          padding: 9px 32px;
          text-align: center;
          font-size: 11px;
          color: var(--ink-soft);
          letter-spacing: 0.04em;
        }
        .adir-tagline strong { color: var(--ink); font-weight: 600; }

        /* ── Heading ── */
        .adir-heading {
          font-family: var(--serif);
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 300;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--ink);
          margin: 36px 0 24px;
          line-height: 1.1;
        }
        .adir-heading em { font-style: normal; font-weight: 600; color: var(--accent); }

        /* ── Controls: search + filters inline ── */
        .adir-controls {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .adir-search-wrap {
          position: relative;
          flex: 0 0 280px;
        }
        .adir-search-icon {
          position: absolute; left: 13px; top: 50%;
          transform: translateY(-50%);
          color: var(--ink-faint); pointer-events: none;
        }
        .adir-search {
          width: 100%;
          padding: 10px 36px 10px 38px;
          border: 1.5px solid var(--border);
          border-radius: 100px;
          font-family: var(--sans);
          font-size: 14px; color: var(--ink);
          background: #fff; outline: none;
          transition: border-color 0.2s;
        }
        .adir-search:focus { border-color: var(--ink); }
        .adir-search::placeholder { color: var(--ink-faint); }
        .adir-search-clear {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          font-size: 18px; line-height: 1;
          color: var(--ink-faint); cursor: pointer; padding: 0 2px;
        }
        .adir-search-clear:hover { color: var(--ink); }

        .adir-divider { width: 1px; height: 26px; background: var(--border); flex-shrink: 0; }

        .adir-filters { display: flex; gap: 7px; flex-wrap: wrap; }
        .adir-chip {
          padding: 7px 16px;
          border-radius: 100px;
          border: 1.5px solid var(--border);
          background: transparent;
          font-family: var(--sans);
          font-size: 13px; font-weight: 500;
          color: var(--ink-soft); cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .adir-chip:hover { border-color: var(--ink); color: var(--ink); }
        .adir-chip.active { background: var(--ink); border-color: var(--ink); color: #fff; }
        .adir-chip.mine.active { background: var(--accent); border-color: var(--accent); }

        /* Sub-filters (genre/medium) */
        .adir-subfilters { margin-bottom: 32px; }
        .adir-subfilter-label {
          font-size: 11px; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--ink-faint); margin: 14px 0 8px;
        }
        .adir-genre-scroll {
          display: flex; gap: 7px; overflow-x: auto;
          padding-bottom: 4px; scrollbar-width: none;
        }
        .adir-genre-scroll::-webkit-scrollbar { display: none; }
        .genre-chip { font-size: 12px; }
        .genre-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }

        /* ── Layout ── */
        .adir-layout { display: block; }
        .adir-layout.has-sidebar {
          display: grid;
          grid-template-columns: 1fr 272px;
          gap: 40px;
          align-items: start;
        }
        .adir-main { min-width: 0; }

        /* ── Section headers ── */
        .adir-section { margin-bottom: 48px; }
        .adir-section-head {
          display: flex; align-items: center;
          gap: 12px; margin-bottom: 16px;
        }
        .adir-section-label {
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--ink-faint); white-space: nowrap;
        }
        .adir-section-rule { flex: 1; height: 1px; background: var(--border); }
        .adir-section-count {
          font-size: 11px; font-weight: 500;
          color: var(--ink-faint);
        }

        /* ── Featured grid ── */
        .adir-featured-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .has-sidebar .adir-featured-grid { grid-template-columns: repeat(3, 1fr); }

        /* ── Featured card ── */
        .feat-card {
          position: relative; border-radius: 6px;
          overflow: hidden; aspect-ratio: 3/4;
          background: var(--paper-warm);
          text-decoration: none; display: block;
          cursor: pointer;
        }
        .feat-card:hover .feat-img { transform: scale(1.04); }
        .feat-img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.5s ease; display: block;
        }
        .feat-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(26,24,20,0.88) 0%, transparent 55%);
          display: flex; flex-direction: column;
          justify-content: flex-end; padding: 14px;
        }
        .feat-no-img {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--serif); font-size: 3rem; color: var(--ink-faint);
        }
        .feat-name {
          font-family: var(--serif); font-size: 1rem;
          font-weight: 500; color: #fff;
          text-transform: uppercase; letter-spacing: 0.03em;
          line-height: 1.2; margin-bottom: 3px;
        }
        .feat-type { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.6); }
        .feat-events {
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--accent); margin-top: 4px;
        }
        .feat-verified {
          display: inline-block; width: 6px; height: 6px;
          background: var(--accent); border-radius: 50%;
          margin-left: 6px; vertical-align: middle;
        }

        /* ── CTA card ── */
        .feat-cta {
          position: relative; border-radius: 6px;
          overflow: hidden; aspect-ratio: 3/4;
          border: 2px dashed var(--border);
          background: var(--paper);
          text-decoration: none; display: flex;
          flex-direction: column; align-items: center;
          justify-content: center; text-align: center;
          padding: 20px; gap: 8px;
          transition: border-color 0.2s, background 0.2s;
        }
        .feat-cta:hover { border-color: var(--accent); background: var(--accent-light); }
        .feat-cta-icon {
          width: 36px; height: 36px; border-radius: 50%;
          border: 1.5px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; color: var(--ink-faint);
          transition: border-color 0.2s, color 0.2s;
        }
        .feat-cta:hover .feat-cta-icon { border-color: var(--accent); color: var(--accent); }
        .feat-cta-title {
          font-family: var(--serif); font-size: 13px;
          font-weight: 500; color: var(--ink-soft);
          text-transform: uppercase; letter-spacing: 0.04em;
          line-height: 1.3;
        }
        .feat-cta-sub { font-size: 11px; color: var(--ink-faint); }

        /* ── All artists grid ── */
        .artists-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 20px 16px;
        }
        .artist-card { text-decoration: none; color: inherit; display: block; }
        .artist-card:hover .artist-img-inner { transform: scale(1.04); }
        .artist-img-wrap {
          overflow: hidden; border-radius: 4px;
          background: var(--paper-warm); margin-bottom: 10px;
          aspect-ratio: 3/4;
        }
        .artist-img-inner {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.4s ease; display: block;
        }
        .artist-no-img {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--serif); font-size: 2.5rem;
          color: var(--ink-faint);
        }
        .artist-name {
          font-family: var(--serif); font-size: 13px;
          font-weight: 500; line-height: 1.3; margin-bottom: 3px;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .artist-type { font-size: 11px; color: var(--ink-soft); margin-bottom: 2px; }
        .artist-events {
          font-size: 11px; font-weight: 700;
          color: var(--accent); letter-spacing: 0.02em;
        }
        .artist-genres { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 3px; }
        .artist-genre-tag {
          font-size: 10px; color: var(--ink-faint);
          background: var(--paper-warm);
          padding: 2px 8px; border-radius: 100px;
        }
        .verified-dot {
          display: inline-block; width: 5px; height: 5px;
          background: var(--accent); border-radius: 50%;
          margin-left: 5px; vertical-align: middle;
        }
        .mine-badge {
          display: inline-block;
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: #fff; background: var(--accent);
          padding: 2px 6px; border-radius: 3px; margin-left: 6px;
          vertical-align: middle;
        }

        /* ── Empty state ── */
        .adir-empty { text-align: center; padding: 60px 20px; color: var(--ink-soft); }
        .adir-empty-title { font-family: var(--serif); font-size: 1.2rem; font-weight: 500; text-transform: uppercase; margin-bottom: 6px; }
        .adir-empty p { font-size: 14px; }
        .adir-empty-clear {
          margin-top: 12px;
          background: none; border: 1px solid var(--border);
          border-radius: 4px; padding: 7px 16px;
          font-size: 13px; cursor: pointer; color: var(--ink-soft);
          font-family: var(--sans);
        }
        .adir-empty-clear:hover { border-color: var(--accent); color: var(--accent); }

        /* ── Sidebar ── */
        .adir-sidebar {
          display: flex; flex-direction: column; gap: 14px;
          position: sticky; top: 24px;
        }
        .sidebar-section {
          border: 1.5px solid var(--border); border-radius: 10px;
          overflow: hidden; background: #fff;
        }
        .sidebar-eyebrow {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 14px;
          font-family: var(--serif);
          font-size: 9px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--ink-soft); background: var(--paper);
          border-bottom: 1px solid var(--border);
        }
        .sidebar-live {
          width: 7px; height: 7px; border-radius: 50%;
          flex-shrink: 0;
          animation: sib-pulse 2s infinite;
        }
        .sidebar-live--red { background: var(--accent); }
        .sidebar-live--gold { background: var(--gold); }
        @keyframes sib-pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }

        .excard {
          display: block; text-decoration: none;
          border-bottom: 1px solid var(--paper-warm);
          opacity: 0.55; transition: opacity 0.2s, background 0.15s;
        }
        .excard:last-of-type { border-bottom: none; }
        .excard--on, .excard:hover { opacity: 1; background: var(--paper); }
        .excard-img-wrap { position: relative; height: 108px; overflow: hidden; }
        .excard-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .excard-badge {
          position: absolute; top: 7px; left: 7px;
          background: rgba(26,24,20,0.8); color: var(--gold);
          font-size: 8px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding: 3px 7px; border-radius: 3px;
          font-family: var(--serif);
        }
        .excard-body { padding: 10px 13px 12px; }
        .excard-title {
          font-family: var(--serif); font-size: 12px;
          font-weight: 500; color: var(--ink);
          margin: 0 0 3px; text-transform: uppercase;
          letter-spacing: 0.03em; line-height: 1.25;
        }
        .excard-venue { font-size: 10px; color: var(--accent); font-weight: 600; margin: 0 0 3px; }
        .excard-metas { display: flex; gap: 0; flex-wrap: wrap; margin-bottom: 3px; }
        .excard-metas span { font-size: 10px; color: var(--ink-soft); font-family: var(--sans); }
        .excard-metas span:not(:last-child)::after { content: ' · '; white-space: pre; }
        .excard-reception {
          display: inline-block; font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--accent); background: var(--accent-light);
          padding: 2px 7px; border-radius: 3px; margin-bottom: 3px;
        }
        .excard-detail { font-size: 10px; color: var(--ink-faint); margin: 1px 0 0; }

        .sidebar-dots {
          display: flex; gap: 5px; justify-content: center;
          padding: 7px 14px 9px;
          background: var(--paper); border-top: 1px solid var(--paper-warm);
        }
        .sidebar-dot {
          width: 5px; height: 5px; border-radius: 50%;
          border: none; background: var(--border); cursor: pointer; padding: 0;
          transition: background 0.2s;
        }
        .sidebar-dot--on { background: var(--accent); }

        .procard {
          display: flex; gap: 10px;
          text-decoration: none;
          padding: 10px 13px 12px;
          border-bottom: 1px solid var(--paper-warm);
          transition: background 0.15s;
        }
        .procard:last-child { border-bottom: none; }
        .procard:hover { background: var(--paper); }
        .procard-img { width: 48px; height: 64px; border-radius: 4px; overflow: hidden; flex-shrink: 0; background: var(--paper-warm); }
        .procard-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .procard-body { flex: 1; min-width: 0; }
        .procard-title { font-family: var(--serif); font-size: 12px; font-weight: 500; color: var(--ink); margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.03em; line-height: 1.2; }
        .procard-venue { font-size: 10px; color: var(--accent); font-weight: 600; margin: 0 0 3px; }
        .procard-next { font-size: 10px; color: var(--ink-soft); margin: 0 0 1px; font-weight: 600; }
        .procard-through { font-size: 10px; color: var(--ink-faint); margin: 0; }

        /* Galleries link */
        .sidebar-galleries-link {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px;
          border: 1.5px solid var(--border); border-radius: 10px;
          background: #fff; text-decoration: none;
          transition: border-color 0.2s, background 0.15s;
        }
        .sidebar-galleries-link:hover { border-color: var(--accent); background: var(--accent-light); }
        .sidebar-galleries-icon { font-size: 1.4rem; flex-shrink: 0; }
        .sidebar-galleries-title {
          font-family: var(--serif); font-size: 12px;
          font-weight: 600; color: var(--ink);
          text-transform: uppercase; letter-spacing: 0.04em;
          margin: 0 0 2px; line-height: 1.2;
        }
        .sidebar-galleries-sub { font-size: 11px; color: var(--accent); margin: 0; }

        .sidebar-submit {
          display: block; text-align: center;
          padding: 10px 16px;
          border: 1.5px solid var(--border); border-radius: 8px;
          font-family: var(--serif);
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--ink-soft); text-decoration: none;
          transition: border-color 0.2s, color 0.2s;
        }
        .sidebar-submit:hover { border-color: var(--accent); color: var(--accent); }

        /* ── Opportunities ── */
        .opp-section { border-top: 1.5px solid var(--border); padding-top: 40px; }
        .opp-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .opp-heading { font-family: var(--serif); font-size: clamp(1.3rem, 2.5vw, 1.8rem); font-weight: 600; letter-spacing: 0.06em; margin: 0 0 3px; color: var(--ink); text-transform: uppercase; }
        .opp-sub { font-size: 13px; color: var(--ink-soft); margin: 0; }
        .opp-post-btn {
          display: inline-block; padding: 9px 18px;
          background: var(--ink); color: #fff;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          text-decoration: none; border-radius: 4px;
          white-space: nowrap; transition: background 0.2s;
          font-family: var(--serif);
        }
        .opp-post-btn:hover { background: var(--accent); }
        .opp-list { border: 1.5px solid var(--border); border-radius: 8px; overflow: hidden; }
        .opp-item {
          display: flex; align-items: center; justify-content: space-between;
          gap: 20px; padding: 14px 18px; background: #fff;
          text-decoration: none; border-bottom: 1px solid var(--paper-warm);
          transition: background 0.15s;
        }
        .opp-item:last-child { border-bottom: none; }
        .opp-item:hover { background: var(--paper); }
        .opp-item-left { flex: 1; min-width: 0; }
        .opp-tags { display: flex; gap: 8px; margin-bottom: 4px; align-items: center; }
        .opp-type { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
        .opp-comp { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 3px; background: var(--paper-warm); color: var(--ink-soft); }
        .opp-comp--paid { background: #dcfce7; color: #166534; }
        .opp-title { font-family: var(--serif); font-size: 14px; font-weight: 500; color: var(--ink); margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .opp-org { font-size: 11px; color: var(--ink-soft); margin: 0 0 2px; }
        .opp-excerpt { font-size: 11px; color: var(--ink-faint); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .opp-item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .opp-dl { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
        .opp-dl-label { font-size: 9px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.08em; }
        .opp-dl-val { font-size: 12px; font-weight: 700; color: var(--ink-soft); }
        .opp-dl-val.urgent { color: var(--accent); }
        .opp-dl-val.closed { color: var(--ink-faint); }
        .opp-arrow { font-size: 14px; color: var(--border); transition: color 0.15s; }
        .opp-item:hover .opp-arrow { color: var(--accent); }
        .opp-more {
          display: block; width: 100%; margin-top: 10px;
          background: none; border: 1.5px solid var(--border);
          border-radius: 6px; padding: 10px;
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--ink-soft); cursor: pointer;
          font-family: var(--serif);
          transition: border-color 0.2s, color 0.2s;
        }
        .opp-more:hover { border-color: var(--accent); color: var(--accent); }

        /* ── Footer tagline ── */
        .adir-footer {
          margin-top: 60px; padding: 20px 0;
          border-top: 1px solid var(--border);
          text-align: center; font-size: 12px;
          color: var(--ink-faint); line-height: 1.7;
        }
        .adir-footer strong { color: var(--ink-soft); }
        .adir-footer a { color: var(--accent); text-decoration: none; }

        /* ── Loading ── */
        .adir-loading { display: flex; align-items: center; justify-content: center; min-height: 400px; }
        .loading-dots { display: flex; gap: 8px; }
        .loading-dots span { width: 8px; height: 8px; background: var(--ink-faint); border-radius: 50%; animation: ldot 1.2s ease-in-out infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes ldot { 0%,80%,100% { opacity:0.3; transform:scale(0.85); } 40% { opacity:1; transform:scale(1); } }

        /* ── Responsive ── */
        @media (max-width: 1100px) {
          .adir-layout.has-sidebar { grid-template-columns: 1fr 240px; gap: 28px; }
          .has-sidebar .adir-featured-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 900px) {
          .adir-featured-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 768px) {
          .adir-wrap { padding: 0 20px 60px; }
          .adir-layout.has-sidebar { grid-template-columns: 1fr; }
          .adir-sidebar { position: static; flex-direction: row; overflow-x: auto; gap: 12px; padding-bottom: 4px; scrollbar-width: none; }
          .adir-sidebar::-webkit-scrollbar { display: none; }
          .sidebar-section { flex: 0 0 230px; }
          .sidebar-galleries-link { flex: 0 0 180px; }
          .sidebar-submit { flex: 0 0 auto; white-space: nowrap; align-self: center; }
          .adir-controls { flex-direction: column; align-items: stretch; }
          .adir-search-wrap { flex: 1; }
          .adir-divider { display: none; }
          .adir-featured-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .artists-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .opp-item { flex-direction: column; align-items: flex-start; }
          .opp-item-right { flex-direction: row; align-items: center; gap: 12px; }
        }
      `}</style>

      {/* ── Partnership tagline ── */}
      <div className="adir-tagline">
        Topeka Artist Directory · presented in partnership between{' '}
        <strong>seveneightfive magazine</strong> and <strong>ArtsConnect</strong>
      </div>

      <div className="adir-wrap">
        <h1 className="adir-heading">785 <em>Artists</em></h1>

        {/* ── Controls: search inline with type filters ── */}
        <div className="adir-controls">
          <div className="adir-search-wrap">
            <svg className="adir-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="adir-search"
              type="text"
              placeholder="Search artists…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="adir-search-clear" onClick={() => setSearch('')} aria-label="Clear">×</button>
            )}
          </div>

          <div className="adir-divider" />

          <div className="adir-filters">
            {ARTIST_TYPES.map(type => (
              <button
                key={type}
                className={`adir-chip${activeType === type && !showMine ? ' active' : ''}`}
                onClick={() => { setActiveType(type); setActiveGenre(''); setShowMine(false) }}
              >
                {TYPE_FILTER_LABELS[type]}
              </button>
            ))}
            {myArtistIds.length > 0 && (
              <button
                className={`adir-chip mine${showMine ? ' active' : ''}`}
                onClick={() => { setShowMine(v => !v); setActiveType('All'); setActiveGenre('') }}
              >
                My Artists ({myArtistIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Sub-genre filter */}
        {activeType !== 'All' && !showMine && (
          <div className="adir-subfilters">
            <div className="adir-subfilter-label">{getGenreLabel()}</div>
            <div className="adir-genre-scroll">
              <button
                className={`adir-chip genre-chip${activeGenre === '' ? ' active' : ''}`}
                onClick={() => setActiveGenre('')}
              >
                All
              </button>
              {getGenreList().map(g => (
                <button
                  key={g}
                  className={`adir-chip genre-chip${activeGenre === g ? ' active' : ''}`}
                  onClick={() => setActiveGenre(activeGenre === g ? '' : g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading ? (
          <div className="adir-loading">
            <div className="loading-dots"><span /><span /><span /></div>
          </div>
        ) : (
          <div className={`adir-layout${hasSidebar && !isFiltered ? ' has-sidebar' : ''}`}>

            {/* ── Main column ── */}
            <div className="adir-main">

              {/* Featured artists — verified, sorted by upcoming events */}
              {!isFiltered && featured.length > 0 && (
                <section className="adir-section">
                  <div className="adir-section-head">
                    <span className="adir-section-label">Featured Artists</span>
                    <div className="adir-section-rule" />
                  </div>
                  <div className="adir-featured-grid">
                    {featured.map(a => (
                      <a key={a.id} href={`/artists/${a.slug}`} className="feat-card">
                        {getImage(a)
                          ? <img src={getImage(a)!} alt={a.name} className="feat-img" />
                          : <div className="feat-no-img">{a.name[0]}</div>
                        }
                        <div className="feat-overlay">
                          <div className="feat-name">
                            {a.name}
                            {a.verified && <span className="feat-verified" />}
                          </div>
                          <div className="feat-type">{TYPE_LABELS[a.artist_type || ''] || a.artist_type}</div>
                          {(a.upcoming_event_count ?? 0) > 0 && (
                            <div className="feat-events">
                              {a.upcoming_event_count} upcoming event{a.upcoming_event_count !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </a>
                    ))}
                    {/* Create profile CTA */}
                    <a href="/dashboard/artist/new" className="feat-cta">
                      <div className="feat-cta-icon">+</div>
                      <p className="feat-cta-title">Create Your Artist Profile</p>
                      <p className="feat-cta-sub">Join the Topeka Artist Directory</p>
                    </a>
                  </div>
                </section>
              )}

              {/* All / filtered artists */}
              <section className="adir-section">
                <div className="adir-section-head">
                  <span className="adir-section-label">
                    {showMine ? 'My Artists'
                      : activeType !== 'All' ? TYPE_FILTER_LABELS[activeType]
                      : 'All Artists'}
                  </span>
                  <div className="adir-section-rule" />
                  <span className="adir-section-count">{filtered.length}</span>
                </div>

                {filtered.length === 0 ? (
                  <div className="adir-empty">
                    <div className="adir-empty-title">No artists found</div>
                    <p>{search ? `No results for "${search}"` : 'Try adjusting your filters.'}</p>
                    {search && (
                      <button className="adir-empty-clear" onClick={() => setSearch('')}>
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="artists-grid">
                    {filtered.map(a => (
                      <a key={a.id} href={`/artists/${a.slug}`} className="artist-card">
                        <div className="artist-img-wrap">
                          {getImage(a)
                            ? <img src={getImage(a)!} alt={a.name} className="artist-img-inner" loading="lazy" />
                            : <div className="artist-no-img">{a.name[0]}</div>
                          }
                        </div>
                        <div className="artist-name">
                          {a.name}
                          {a.verified && <span className="verified-dot" />}
                          {myArtistIds.includes(a.id) && <span className="mine-badge">Mine</span>}
                        </div>
                        <div className="artist-type">{TYPE_LABELS[a.artist_type || ''] || a.artist_type || 'Artist'}</div>
                        {(a.upcoming_event_count ?? 0) > 0 && (
                          <div className="artist-events">
                            {a.upcoming_event_count} upcoming event{a.upcoming_event_count !== 1 ? 's' : ''}
                          </div>
                        )}
                        {getGenres(a).length > 0 && (
                          <div className="artist-genres">
                            {getGenres(a).map(g => (
                              <span key={g} className="artist-genre-tag">{g}</span>
                            ))}
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </section>

              {/* Opportunities */}
              {!isFiltered && <OpportunityBoard opportunities={opportunities} />}
            </div>

            {/* ── Sidebar: exhibitions + productions + galleries link ── */}
            {hasSidebar && !isFiltered && (
              <ExhibitionSidebar exhibitions={exhibitions} productions={productions} />
            )}
          </div>
        )}

        {/* ── Partnership footer ── */}
        <div className="adir-footer">
          <strong>Topeka Artist Directory</strong> · A partnership between{' '}
          <a href="https://seveneightfive.com">seveneightfive magazine</a> and <strong>ArtsConnect</strong>
          {' '}· Celebrating creative voices in Topeka, Kansas
        </div>
      </div>
    </>
  )
}
