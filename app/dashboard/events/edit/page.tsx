'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import ImageUpload from '@/app/dashboard/edit/ImageUpload'
import { Suspense } from 'react'
import TicketTiersEditor from '@/app/components/TicketTiersEditor'

const EVENT_TYPES = [
  'Live Music', 'Art', 'Entertainment', 'Lifestyle',
  'Local Flavor', 'Community / Cultural', 'Party For A Cause',
  'Shop Local', 'Holiday', 'Exhibition',
  'Comedy Night', 'Open Mic', 'Poetry Reading', 'Trivia Night',
  'Bingo', 'Workshop / Class', 'Film / Screening', 'Dance', 'Theater',
]

type EventForm = {
  id?: string
  title: string
  description: string
  event_date: string
  event_start_time: string
  event_end_time: string
  image_url: string
  ticket_price: string
  ticket_url: string
  learnmore_link: string
  event_types: string[]
  star: boolean
  venue_id: string
}

type VenueOption = { id: string; name: string; neighborhood: string | null }
type LinkedArtist = { artist_id: string; name: string; slug: string | null }

function toInputTime(t: string | null | undefined): string {
  if (!t || t.trim() === ':') return ''
  const ampmMatch = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i)
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10)
    const m = parseInt(ampmMatch[2], 10)
    const isPm = ampmMatch[3].toLowerCase() === 'pm'
    if (isPm && h !== 12) h += 12
    if (!isPm && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const match = t.match(/(\d{1,2}):(\d{2})/)
  if (!match) return ''
  return `${String(parseInt(match[1], 10)).padStart(2, '0')}:${match[2]}`
}

const EMPTY: EventForm = {
  title: '', description: '', event_date: '', event_start_time: '',
  event_end_time: '', image_url: '', ticket_price: '', ticket_url: '',
  learnmore_link: '', event_types: [], star: false, venue_id: '',
}

function EventEditInner() {
  const router = useRouter()
  const params = useSearchParams()
  const eventId = params.get('id')
  const isNew = !eventId

  const [form, setForm] = useState<EventForm>(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [stripeAccountStatus, setStripeAccountStatus] = useState<string | null>(null)

  // Venue picker
  const [venueSearch, setVenueSearch] = useState('')
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([])
  const [selectedVenueName, setSelectedVenueName] = useState('')
  const [venueDropOpen, setVenueDropOpen] = useState(false)
  const venueDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Artist management
  const [linkedArtists, setLinkedArtists] = useState<LinkedArtist[]>([])
  const [artistSearch, setArtistSearch] = useState('')
  const [artistOptions, setArtistOptions] = useState<{ id: string; name: string }[]>([])
  const [artistDropOpen, setArtistDropOpen] = useState(false)
  const artistDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const set = <K extends keyof EventForm>(field: K, value: EventForm[K]) =>
    setForm(f => ({ ...f, [field]: value }))

  const toggleType = (t: string) =>
    set('event_types', form.event_types.includes(t)
      ? form.event_types.filter(x => x !== t)
      : [...form.event_types, t])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Fetch stripe status for ticket tier editor
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_account_status')
        .eq('id', user.id)
        .single()
      setStripeAccountStatus(profile?.stripe_account_status || null)

      if (!isNew && eventId) {
        const { data } = await supabase
          .from('events')
          .select('id, title, description, event_date, event_start_time, event_end_time, image_url, ticket_price, ticket_url, learnmore_link, event_types, star, venue_id, auth_user_id, venues(id, name, neighborhood)')
          .eq('id', eventId)
          .single()

        if (!data) { router.push('/dashboard/events'); return }

        // Check access: creator, venue owner, or featured artist
        let hasAccess = data.auth_user_id === user.id
        if (!hasAccess && data.venue_id) {
          const { data: ownedVenue } = await supabase
            .from('venues').select('id').eq('id', data.venue_id).eq('auth_user_id', user.id).single()
          hasAccess = !!ownedVenue
        }
        if (!hasAccess) {
          const { data: myArtists } = await supabase.from('artists').select('id').eq('auth_user_id', user.id)
          const myArtistIds = (myArtists || []).map((a: any) => a.id)
          if (myArtistIds.length) {
            const { data: link } = await supabase
              .from('event_artists').select('artist_id').eq('event_id', eventId).in('artist_id', myArtistIds).limit(1).maybeSingle()
            hasAccess = !!link
          }
        }
        if (!hasAccess) { router.push('/dashboard/events'); return }

        const v = Array.isArray(data.venues) ? data.venues[0] : data.venues
        setSelectedVenueName(v?.name || '')
        setVenueSearch(v?.name || '')

        setForm({
          id: data.id,
          title: data.title || '',
          description: data.description || '',
          event_date: data.event_date || '',
          event_start_time: toInputTime(data.event_start_time),
          event_end_time: toInputTime(data.event_end_time),
          image_url: data.image_url || '',
          ticket_price: data.ticket_price != null ? String(data.ticket_price) : '',
          ticket_url: data.ticket_url || '',
          learnmore_link: data.learnmore_link || '',
          event_types: data.event_types || [],
          star: data.star || false,
          venue_id: data.venue_id || '',
        })

        // Load linked artists
        const { data: links } = await supabase
          .from('event_artists')
          .select('artist_id, artists(name, slug)')
          .eq('event_id', eventId)

        setLinkedArtists((links || []).map((l: any) => ({
          artist_id: l.artist_id,
          name: Array.isArray(l.artists) ? l.artists[0]?.name : l.artists?.name,
          slug: Array.isArray(l.artists) ? l.artists[0]?.slug : l.artists?.slug,
        })))
      }

      setLoading(false)
    }
    load()
  }, [isNew, eventId, router])

  // Venue search
  useEffect(() => {
    if (!venueSearch.trim() || venueSearch === selectedVenueName) {
      setVenueOptions([])
      setVenueDropOpen(false)
      return
    }
    if (venueDebounce.current) clearTimeout(venueDebounce.current)
    venueDebounce.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('venues')
        .select('id, name, neighborhood')
        .ilike('name', `%${venueSearch}%`)
        .limit(8)
      setVenueOptions(data || [])
      setVenueDropOpen(true)
    }, 250)
  }, [venueSearch, selectedVenueName])

  // Artist search
  useEffect(() => {
    if (!artistSearch.trim()) {
      setArtistOptions([])
      setArtistDropOpen(false)
      return
    }
    if (artistDebounce.current) clearTimeout(artistDebounce.current)
    artistDebounce.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('artists')
        .select('id, name')
        .ilike('name', `%${artistSearch}%`)
        .eq('published', true)
        .limit(8)
      const filtered = (data || []).filter(a => !linkedArtists.find(l => l.artist_id === a.id))
      setArtistOptions(filtered)
      setArtistDropOpen(true)
    }, 250)
  }, [artistSearch, linkedArtists])

  const addArtist = async (artistId: string, artistName: string) => {
    setArtistDropOpen(false)
    setArtistSearch('')

    if (!form.id && isNew) {
      // If event not saved yet, queue to link after save
      setLinkedArtists(prev => [...prev, { artist_id: artistId, name: artistName, slug: null }])
      return
    }

    await fetch('/api/event/artist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: form.id || eventId, artistId }),
    })
    setLinkedArtists(prev => [...prev, { artist_id: artistId, name: artistName, slug: null }])
  }

  const removeArtist = async (artistId: string) => {
    if (form.id || eventId) {
      await fetch('/api/event/artist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: form.id || eventId, artistId }),
      })
    }
    setLinkedArtists(prev => prev.filter(a => a.artist_id !== artistId))
  }

  const handleSave = async () => {
    if (!form.title || !form.event_date) {
      setError('Title and date are required.')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      title: form.title,
      description: form.description || null,
      event_date: form.event_date,
      event_start_time: form.event_start_time || null,
      event_end_time: form.event_end_time || null,
      image_url: form.image_url || null,
      ticket_price: form.ticket_price !== '' ? Number(form.ticket_price) : null,
      ticket_url: form.ticket_url || null,
      learnmore_link: form.learnmore_link || null,
      event_types: form.event_types,
      star: form.star,
      venue_id: form.venue_id || null,
    }

    let newEventId: string | null = null

    if (isNew) {
      const res = await fetch('/api/event/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Save failed'); setSaving(false); return }
      newEventId = json.id
      setForm(f => ({ ...f, id: json.id }))

      // Link queued artists
      for (const a of linkedArtists) {
        await fetch('/api/event/artist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: json.id, artistId: a.artist_id }),
        })
      }
    } else {
      const res = await fetch('/api/event/upsert', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: form.id || eventId, ...payload }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Save failed'); setSaving(false); return }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      if (newEventId) router.push(`/dashboard/events/edit?id=${newEventId}`)
    }, 1500)
  }

  const handleDelete = async () => {
    if (!form.id) return
    if (!confirm(`Delete "${form.title}"? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('events').delete().eq('id', form.id)
    router.push('/dashboard/events')
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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 6,
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
        input:focus, select:focus, textarea:focus { border-color: rgba(200,6,80,0.6) !important; }
        select option { background: #2a2420; }
        .type-chip { padding: 6px 14px; border-radius: 100px; border: 1.5px solid rgba(255,255,255,0.12); background: transparent; font-family: 'DM Sans', sans-serif; font-size: 0.76rem; font-weight: 500; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .type-chip.active { background: rgba(200,6,80,0.15); border-color: rgba(200,6,80,0.5); color: #FFCE03; }
        .dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #2a2420; border: 1.5px solid rgba(255,255,255,0.12); border-radius: 8px; z-index: 50; overflow: hidden; }
        .dropdown-item { padding: 10px 14px; cursor: pointer; font-size: 0.88rem; transition: background 0.1s; }
        .dropdown-item:hover { background: rgba(255,255,255,0.08); }
        .artist-tag { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 100px; font-size: 0.8rem; color: rgba(255,255,255,0.7); margin: 4px; }
        .artist-tag button { background: none; border: none; color: rgba(255,255,255,0.3); cursor: pointer; font-size: 1rem; line-height: 1; padding: 0; }
        .artist-tag button:hover { color: rgba(200,6,80,0.8); }
        .section-head { font-family: 'Oswald', sans-serif; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin: 32px 0 16px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 80px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 32 }}>
          <a href="/dashboard/events" style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
            ← My Events
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
              {isNew ? 'Add Event' : 'Edit Event'}
            </span>
            {!isNew && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '5px 12px',
                  background: 'transparent',
                  border: '1px solid rgba(200,6,80,0.25)',
                  borderRadius: 6,
                  color: 'rgba(200,6,80,0.45)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.72rem',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {deleting ? '…' : 'Delete'}
              </button>
            )}
          </div>
        </div>

        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
          {isNew ? 'Add New Event' : form.title || 'Edit Event'}
        </h1>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)', marginBottom: 36 }}>
          {isNew ? 'Fill in the details below. Changes will be live on the public events directory.' : 'Update event details below.'}
        </p>

        {/* ── BASICS ── */}
        <div className="section-head">Event Details</div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Event Title *</label>
          <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Jazz Night at The Gem" />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, minHeight: 100, resize: 'vertical', lineHeight: 1.5 }}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Short description of the event..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Date *</label>
            <input style={inputStyle} type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Start Time</label>
            <input style={inputStyle} type="time" value={form.event_start_time} onChange={e => set('event_start_time', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>End Time</label>
            <input style={inputStyle} type="time" value={form.event_end_time} onChange={e => set('event_end_time', e.target.value)} />
          </div>
        </div>

        {/* Venue Picker */}
        <div style={{ marginBottom: 20, position: 'relative' }}>
          <label style={labelStyle}>Venue</label>
          <input
            style={inputStyle}
            value={venueSearch}
            onChange={e => { setVenueSearch(e.target.value); if (!e.target.value) { set('venue_id', ''); setSelectedVenueName('') } }}
            placeholder="Search venues..."
            autoComplete="off"
          />
          {venueDropOpen && venueOptions.length > 0 && (
            <div className="dropdown">
              {venueOptions.map(v => (
                <div
                  key={v.id}
                  className="dropdown-item"
                  onClick={() => {
                    set('venue_id', v.id)
                    setSelectedVenueName(v.name)
                    setVenueSearch(v.name)
                    setVenueDropOpen(false)
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{v.name}</span>
                  {v.neighborhood && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', marginLeft: 8 }}>{v.neighborhood}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── EVENT TYPES ── */}
        <div className="section-head">Event Type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {EVENT_TYPES.map(t => (
            <button
              key={t}
              type="button"
              className={`type-chip ${form.event_types.includes(t) ? 'active' : ''}`}
              onClick={() => toggleType(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── IMAGE ── */}
        <div className="section-head">Event Image</div>
        <div style={{ marginBottom: 20 }}>
          {form.image_url && (
            <img src={form.image_url} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, marginBottom: 8, opacity: 0.8 }} />
          )}
          <input
            style={{ ...inputStyle, marginBottom: 6 }}
            placeholder="https://... or upload below"
            value={form.image_url}
            onChange={e => set('image_url', e.target.value)}
          />
          <ImageUpload
            artistId={userId || 'event'}
            field="event"
            currentUrl={form.image_url}
            onUploaded={url => set('image_url', url)}
            bucket="event-images"
          />
        </div>

        {/* ── TICKETS & LINKS ── */}
        <div className="section-head">Tickets & Links</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Ticket Price ($)</label>
            <input
              style={inputStyle}
              type="number"
              min="0"
              step="0.01"
              value={form.ticket_price}
              onChange={e => set('ticket_price', e.target.value)}
              placeholder="0 = Free"
            />
          </div>
          <div>
            <label style={labelStyle}>Ticket URL</label>
            <input style={inputStyle} type="url" value={form.ticket_url} onChange={e => set('ticket_url', e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Learn More / Website Link</label>
          <input style={inputStyle} type="url" value={form.learnmore_link} onChange={e => set('learnmore_link', e.target.value)} placeholder="https://..." />
        </div>

        {/* Star toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
          <input
            type="checkbox"
            id="star"
            checked={form.star}
            onChange={e => set('star', e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#C80650' }}
          />
          <label htmlFor="star" style={{ cursor: 'pointer', fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)' }}>
            <span style={{ fontWeight: 500 }}>Feature this event</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', marginLeft: 8 }}>Shows in the Featured Events section</span>
          </label>
        </div>

        {/* ── ARTISTS ── */}
        <div className="section-head">Featured Artists</div>

        {linkedArtists.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {linkedArtists.map(a => (
              <span key={a.artist_id} className="artist-tag">
                {a.name}
                <button type="button" onClick={() => removeArtist(a.artist_id)}>×</button>
              </span>
            ))}
          </div>
        )}

        <div style={{ position: 'relative', marginBottom: 20 }}>
          <input
            style={inputStyle}
            value={artistSearch}
            onChange={e => setArtistSearch(e.target.value)}
            placeholder="Search artist name to add..."
            autoComplete="off"
          />
          {artistDropOpen && artistOptions.length > 0 && (
            <div className="dropdown">
              {artistOptions.map(a => (
                <div key={a.id} className="dropdown-item" onClick={() => addArtist(a.id, a.name)}>
                  {a.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 785 TICKETS ── only on existing events */}
        {!isNew && (form.id || eventId) && (
          <>
            <div className="section-head">785 Tickets</div>
            <TicketTiersEditor
              eventId={form.id || eventId!}
              stripeAccountStatus={stripeAccountStatus}
            />
          </>
        )}

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(200,6,80,0.12)', border: '1px solid rgba(200,6,80,0.3)', borderRadius: 8, color: '#FFCE03', fontSize: '0.85rem', marginBottom: 20 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '14px',
            background: saved ? 'rgba(45,122,45,0.2)' : 'rgba(200,6,80,0.15)',
            border: `1.5px solid ${saved ? 'rgba(45,122,45,0.4)' : 'rgba(200,6,80,0.4)'}`,
            borderRadius: 10,
            color: saved ? '#7ecf7e' : '#FFCE03',
            fontFamily: "'Oswald', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : isNew ? 'Create Event' : 'Save Changes'}
        </button>
      </div>
    </>
  )
}

export default function EventEditPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#1a1814', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'block' }} />
          ))}
        </div>
      </div>
    }>
      <EventEditInner />
    </Suspense>
  )
}
