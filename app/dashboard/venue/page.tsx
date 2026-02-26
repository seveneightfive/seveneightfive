'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import ImageUpload from '@/app/dashboard/edit/ImageUpload'

type Venue = {
  id: string
  name: string
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  website: string | null
  venue_type: string | null
  image_url: string | null
}

const VENUE_TYPES = [
  'Bar / Lounge', 'Concert Venue', 'Restaurant', 'Art Gallery',
  'Outdoor / Park', 'Theater', 'Community Space', 'Brewery / Taproom',
  'Hotel / Event Space', 'Club / Nightclub', 'Coffee Shop', 'Other',
]

export default function VenueDashboard() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#1a1814' }} />}>
      <VenueDashboardInner />
    </Suspense>
  )
}

function VenueDashboardInner() {
  const router = useRouter()
  const params = useSearchParams()
  const venueId = params.get('id')
  const [venue, setVenue] = useState<Venue | null>(null)
  const [form, setForm] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const query = supabase
        .from('venues')
        .select('id, name, address, neighborhood, city, state, website, venue_type, image_url')
        .eq('auth_user_id', user.id)

      const { data } = venueId
        ? await query.eq('id', venueId).single()
        : await query.single()

      if (!data) { router.push('/dashboard'); return }

      setVenue(data as Venue)
      setForm(data as Venue)
      setLoading(false)
    }
    load()
  }, [router])

  const set = (field: keyof Venue, value: string) =>
    setForm(f => f ? { ...f, [field]: value } : f)

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    setError('')

    const res = await fetch('/api/venue/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId: form.id, updates: form }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(json.error || 'Save failed')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (loading || !form) {
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

  const fieldStyle: React.CSSProperties = { marginBottom: 20 }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #1a1814; color: #fff; font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        @keyframes pulse { 0%,80%,100%{opacity:0.3;transform:scale(0.85)}40%{opacity:1;transform:scale(1)} }
        input:focus, select:focus, textarea:focus { border-color: rgba(200,6,80,0.6) !important; }
        select option { background: #2a2420; }
      `}</style>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px 80px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 32 }}>
          <a href="/dashboard" style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
            ← Dashboard
          </a>
          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
            Venue Editor
          </span>
        </div>

        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
          {venue?.name}
        </h1>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)', marginBottom: 40 }}>
          Edit your venue details. Changes appear on the public venues directory.
        </p>

        {/* Image */}
        <div style={fieldStyle}>
          <span style={labelStyle}>Venue Image</span>
          {form.image_url && (
            <img src={form.image_url} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, marginBottom: 8, opacity: 0.8 }} />
          )}
          <input
            style={{ ...inputStyle, marginBottom: 6 }}
            placeholder="https://... or upload below"
            value={form.image_url || ''}
            onChange={e => set('image_url', e.target.value)}
          />
          <ImageUpload
            artistId={form.id}
            field="hero"
            currentUrl={form.image_url || ''}
            onUploaded={url => set('image_url', url)}
            bucket="venue-images"
          />
        </div>

        {/* Name */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Venue Name</label>
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} />
        </div>

        {/* Venue Type */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Venue Type</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={form.venue_type || ''}
            onChange={e => set('venue_type', e.target.value)}
          >
            <option value="">Select type...</option>
            {VENUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Address */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Street Address</label>
          <input style={inputStyle} value={form.address || ''} onChange={e => set('address', e.target.value)} />
        </div>

        {/* Neighborhood */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Neighborhood / Area</label>
          <input style={inputStyle} value={form.neighborhood || ''} onChange={e => set('neighborhood', e.target.value)} />
        </div>

        {/* City / State */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>City</label>
            <input style={inputStyle} value={form.city || ''} onChange={e => set('city', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>State</label>
            <input style={inputStyle} value={form.state || ''} onChange={e => set('state', e.target.value)} />
          </div>
        </div>

        {/* Website */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Website</label>
          <input style={inputStyle} type="url" value={form.website || ''} onChange={e => set('website', e.target.value)} placeholder="https://..." />
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(200,6,80,0.12)', border: '1px solid rgba(200,6,80,0.3)', borderRadius: 8, color: '#ff9ab0', fontSize: '0.85rem', marginBottom: 20 }}>
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
            color: saved ? '#7ecf7e' : '#ff9ab0',
            fontFamily: "'Oswald', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>
    </>
  )
}
