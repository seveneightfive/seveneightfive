'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'

type EventRow = {
  id: string
  title: string
  event_date: string
  slug: string | null
  venue_id: string | null
  venue_name?: string | null
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MyEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data, error } = await supabase
        .from('events')
        .select('id, title, event_date, slug, venue_id, venues(name)')
        .eq('auth_user_id', user.id)
        .order('event_date', { ascending: false })

      if (error) { console.error(error); setLoading(false); return }

      const mapped = (data || []).map((e: any) => ({
        ...e,
        venue_name: Array.isArray(e.venues) ? e.venues[0]?.name : e.venues?.name,
      }))

      setEvents(mapped)
      setLoading(false)
    }
    load()
  }, [router])

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (!error) {
      setEvents(prev => prev.filter(e => e.id !== id))
    }
    setDeleting(null)
  }

  const inputStyle: React.CSSProperties = {
    display: 'none',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #1a1814; color: #fff; font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        @keyframes pulse { 0%,80%,100%{opacity:0.3;transform:scale(0.85)}40%{opacity:1;transform:scale(1)} }
        .event-row { display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; margin-bottom: 8px; }
        .event-row:hover { background: rgba(255,255,255,0.06); }
        .event-date { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(200,6,80,0.8); white-space: nowrap; }
        .event-title { font-family: 'Oswald', sans-serif; font-size: 1rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
        .event-venue { font-size: 0.78rem; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .btn-edit { padding: '6px 14px'; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: rgba(255,255,255,0.6); font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500; cursor: pointer; white-space: nowrap; text-decoration: none; display: inline-block; transition: all 0.15s; }
        .btn-edit:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .btn-delete { padding: 6px 12px; background: transparent; border: 1px solid rgba(200,6,80,0.2); border-radius: 6px; color: rgba(200,6,80,0.5); font-family: 'DM Sans', sans-serif; font-size: 0.78rem; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
        .btn-delete:hover { border-color: rgba(200,6,80,0.5); color: rgba(200,6,80,0.9); }
      `}</style>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px 80px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 32 }}>
          <a href="/dashboard" style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
            ← Dashboard
          </a>
          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
            My Events
          </span>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              My Events
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
              Events you've added to the directory
            </p>
          </div>
          <a
            href="/dashboard/events/edit"
            style={{
              padding: '10px 18px',
              background: 'rgba(200,6,80,0.15)',
              border: '1.5px solid rgba(200,6,80,0.4)',
              borderRadius: 8,
              color: '#ff9ab0',
              fontFamily: "'Oswald', sans-serif",
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            + Add Event
          </a>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'block', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)' }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', textTransform: 'uppercase', marginBottom: 8 }}>No Events Yet</div>
            <p style={{ fontSize: '0.85rem' }}>Add your first event to get started.</p>
          </div>
        ) : (
          <div>
            {events.map(event => (
              <div key={event.id} className="event-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="event-date">{formatDate(event.event_date)}</div>
                  <div className="event-title">{event.title}</div>
                  {event.venue_name && <div className="event-venue">{event.venue_name}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {event.slug && (
                    <a
                      href={`/events/${event.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem', textDecoration: 'none' }}
                    >
                      ↗
                    </a>
                  )}
                  <a href={`/dashboard/events/edit?id=${event.id}`} className="btn-edit">Edit</a>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(event.id, event.title)}
                    disabled={deleting === event.id}
                  >
                    {deleting === event.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
