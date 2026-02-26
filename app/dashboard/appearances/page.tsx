'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'

type AppearanceEvent = {
  id: string
  title: string
  event_date: string
  slug: string | null
  venue_name: string | null
}

type SearchEvent = {
  id: string
  title: string
  event_date: string
  slug: string | null
  venue_name: string | null
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function AppearancesPage() {
  const router = useRouter()
  const [artistId, setArtistId] = useState<string | null>(null)
  const [appearances, setAppearances] = useState<AppearanceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  // Search to add
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<SearchEvent[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: artist } = await supabase
        .from('artists')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!artist) { router.push('/dashboard'); return }
      setArtistId(artist.id)

      const today = new Date().toLocaleDateString('en-CA')
      const { data: links } = await supabase
        .from('event_artists')
        .select('event_id, events(id, title, event_date, slug, venues(name))')
        .eq('artist_id', artist.id)
        .gte('events.event_date', today)

      const mapped = (links || [])
        .map((l: any) => {
          const e = Array.isArray(l.events) ? l.events[0] : l.events
          if (!e) return null
          const v = Array.isArray(e.venues) ? e.venues[0] : e.venues
          return {
            id: e.id,
            title: e.title,
            event_date: e.event_date,
            slug: e.slug,
            venue_name: v?.name || null,
          }
        })
        .filter(Boolean) as AppearanceEvent[]

      mapped.sort((a, b) => a.event_date.localeCompare(b.event_date))
      setAppearances(mapped)
      setAddedIds(new Set(mapped.map(a => a.id)))
      setLoading(false)
    }
    load()
  }, [router])

  // Search upcoming events
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([])
      return
    }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setSearching(true)
      const supabase = createClient()
      const today = new Date().toLocaleDateString('en-CA')

      const { data } = await supabase
        .from('events')
        .select('id, title, event_date, slug, venues(name)')
        .gte('event_date', today)
        .ilike('title', `%${search}%`)
        .order('event_date', { ascending: true })
        .limit(10)

      const mapped = (data || []).map((e: any) => {
        const v = Array.isArray(e.venues) ? e.venues[0] : e.venues
        return {
          id: e.id,
          title: e.title,
          event_date: e.event_date,
          slug: e.slug,
          venue_name: v?.name || null,
        }
      })

      setSearchResults(mapped)
      setSearching(false)
    }, 300)
  }, [search])

  const handleAdd = async (event: SearchEvent) => {
    if (!artistId) return
    setAdding(event.id)
    const res = await fetch('/api/event/artist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event.id, artistId }),
    })
    if (res.ok) {
      setAppearances(prev => [...prev, event].sort((a, b) => a.event_date.localeCompare(b.event_date)))
      setAddedIds(prev => new Set([...prev, event.id]))
    }
    setAdding(null)
  }

  const handleRemove = async (eventId: string, title: string) => {
    if (!artistId) return
    if (!confirm(`Remove yourself from "${title}"?`)) return
    setRemoving(eventId)
    const res = await fetch('/api/event/artist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, artistId }),
    })
    if (res.ok) {
      setAppearances(prev => prev.filter(a => a.id !== eventId))
      setAddedIds(prev => { const s = new Set(prev); s.delete(eventId); return s })
    }
    setRemoving(null)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#fff',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: '0.9rem',
    outline: 'none',
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1814', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'block', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #1a1814; color: #fff; font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        @keyframes pulse { 0%,80%,100%{opacity:0.3;transform:scale(0.85)}40%{opacity:1;transform:scale(1)} }
        input:focus { border-color: rgba(200,6,80,0.6) !important; }
        .event-row { display: flex; align-items: center; gap: 16px; padding: 14px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; margin-bottom: 8px; }
        .event-date-badge { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(200,6,80,0.8); white-space: nowrap; }
        .event-title-text { font-family: 'Oswald', sans-serif; font-size: 0.95rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
        .event-venue-text { font-size: 0.76rem; color: rgba(255,255,255,0.3); margin-top: 2px; }
        .btn-remove { padding: 5px 12px; background: transparent; border: 1px solid rgba(200,6,80,0.2); border-radius: 6px; color: rgba(200,6,80,0.4); font-family: 'DM Sans', sans-serif; font-size: 0.76rem; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
        .btn-remove:hover { border-color: rgba(200,6,80,0.5); color: rgba(200,6,80,0.9); }
        .section-head { font-family: 'Oswald', sans-serif; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin: 36px 0 16px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .search-result { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 6px; background: rgba(255,255,255,0.02); }
        .btn-add { padding: 6px 14px; background: rgba(200,6,80,0.1); border: 1px solid rgba(200,6,80,0.3); border-radius: 6px; color: #ff9ab0; font-family: 'DM Sans', sans-serif; font-size: 0.76rem; font-weight: 500; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
        .btn-add:hover { background: rgba(200,6,80,0.18); border-color: rgba(200,6,80,0.5); }
        .btn-add:disabled { opacity: 0.4; cursor: default; }
        .already-added { font-size: 0.72rem; color: rgba(255,255,255,0.25); white-space: nowrap; }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 80px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 32 }}>
          <a href="/dashboard" style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
            ← Dashboard
          </a>
          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
            Appearances
          </span>
        </div>

        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
          Your Appearances
        </h1>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)', marginBottom: 36 }}>
          Upcoming events you're featured in. Search below to add yourself to any event.
        </p>

        {/* Upcoming appearances */}
        <div className="section-head">Upcoming Events You're Featured In</div>

        {appearances.length === 0 ? (
          <div style={{ padding: '32px 0', color: 'rgba(255,255,255,0.2)', fontSize: '0.88rem' }}>
            You're not connected to any upcoming events yet. Search below to add yourself.
          </div>
        ) : (
          appearances.map(event => (
            <div key={event.id} className="event-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="event-date-badge">{formatDate(event.event_date)}</div>
                <div className="event-title-text">{event.title}</div>
                {event.venue_name && <div className="event-venue-text">{event.venue_name}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {event.slug && (
                  <a
                    href={`/events/${event.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', textDecoration: 'none' }}
                  >
                    ↗
                  </a>
                )}
                <button
                  className="btn-remove"
                  onClick={() => handleRemove(event.id, event.title)}
                  disabled={removing === event.id}
                >
                  {removing === event.id ? '…' : 'Remove'}
                </button>
              </div>
            </div>
          ))
        )}

        {/* Search to add */}
        <div className="section-head">Find & Add Yourself to an Event</div>

        <div style={{ marginBottom: 20 }}>
          <input
            style={inputStyle}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search upcoming events by title..."
          />
        </div>

        {searching && (
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem', marginBottom: 12 }}>Searching…</div>
        )}

        {!searching && search && searchResults.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem' }}>No upcoming events found for "{search}"</div>
        )}

        {searchResults.map(event => (
          <div key={event.id} className="search-result">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(200,6,80,0.7)', marginBottom: 2 }}>{formatDate(event.event_date)}</div>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.95rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{event.title}</div>
              {event.venue_name && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{event.venue_name}</div>}
            </div>
            {addedIds.has(event.id) ? (
              <span className="already-added">Already added ✓</span>
            ) : (
              <button
                className="btn-add"
                onClick={() => handleAdd(event)}
                disabled={adding === event.id}
              >
                {adding === event.id ? '…' : '+ Add me'}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
