'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import ImageUpload from '@/app/dashboard/edit/ImageUpload'
import TicketTiersEditor from '@/app/components/TicketTiersEditor'
import { Loader2, AlertCircle, Check, X, Trash2 } from 'lucide-react'

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

  const [venueSearch, setVenueSearch] = useState('')
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([])
  const [selectedVenueName, setSelectedVenueName] = useState('')
  const [venueDropOpen, setVenueDropOpen] = useState(false)
  const venueDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (newEventId) {
      router.push(`/dashboard/events/edit?id=${newEventId}`)
      return
    }
  }
    
  const handleDelete = async () => {
    if (!form.id) return
    if (!confirm(`Delete "${form.title}"? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('events').delete().eq('id', form.id)
    router.push('/dashboard/events')
  }

  if (loading) return <LoadingState />

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Sticky header */}
      <div className="sticky top-[72px] z-30 -mx-4 flex items-center justify-between gap-4 border-b border-gray-200 bg-white/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6 dark:border-gray-800 dark:bg-gray-900/95">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
            Creator
          </p>
          <h1 className="font-display text-2xl font-bold leading-none text-gray-900 dark:text-white">
            {isNew ? 'Add Event' : 'Edit Event'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
          {!isNew && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 font-semibold text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/15"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Page intro */}
      <div>
        <h2 className="mb-1 font-display text-xl font-bold uppercase tracking-wide text-gray-900 dark:text-white">
          {isNew ? 'Create New Event' : form.title || 'Edit Event'}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isNew ? 'Fill in the details. Changes will be live on the public events directory.' : 'Update event details below.'}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Card: Event Details */}
      <Card>
        <h3 className="mb-4 font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
          Event Details
        </h3>

        <Field label="Event Title *">
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Jazz Night at The Gem" className={inputCls} />
        </Field>

        <Field label="Description">
          <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description…" rows={4} className={`${inputCls} resize-y leading-relaxed`} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Date *">
            <input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Start Time">
            <input type="time" value={form.event_start_time} onChange={e => set('event_start_time', e.target.value)} className={inputCls} />
          </Field>
          <Field label="End Time">
            <input type="time" value={form.event_end_time} onChange={e => set('event_end_time', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Venue">
          <div className="relative">
            <input type="text" value={venueSearch} onChange={e => { setVenueSearch(e.target.value); if (!e.target.value) { set('venue_id', ''); setSelectedVenueName('') } }} placeholder="Search venues…" autoComplete="off" className={inputCls} />
            {venueDropOpen && venueOptions.length > 0 && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                {venueOptions.map(v => (
                  <button key={v.id} type="button" onClick={() => { set('venue_id', v.id); setSelectedVenueName(v.name); setVenueSearch(v.name); setVenueDropOpen(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/[0.05]">
                    <span className="font-semibold text-gray-900 dark:text-white">{v.name}</span>
                    {v.neighborhood && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{v.neighborhood}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>
      </Card>

      {/* Card: Event Types */}
      <Card>
        <h3 className="mb-4 font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
          Event Type
        </h3>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map(t => (
            <button key={t} type="button" onClick={() => toggleType(t)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${form.event_types.includes(t) ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:border-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>
      </Card>

      {/* Card: Image */}
      <Card>
        <h3 className="mb-4 font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
          Event Image
        </h3>
        {form.image_url && <img src={form.image_url} alt="" className="mb-3 block aspect-video w-full rounded-lg bg-gray-100 object-cover dark:bg-white/[0.04]" />}
        <input type="url" value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://… or upload below" className={`${inputCls} mb-2`} />
        <ImageUpload artistId={userId || 'event'} field="event" currentUrl={form.image_url} onUploaded={url => set('image_url', url)} bucket="event-images" />
      </Card>

      {/* Card: Tickets & Links */}
      <Card>
        <h3 className="mb-4 font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
          Tickets & Links
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ticket Price ($)">
            <input type="number" min="0" step="0.01" value={form.ticket_price} onChange={e => set('ticket_price', e.target.value)} placeholder="0 = Free" className={inputCls} />
          </Field>
          <Field label="Ticket URL">
            <input type="url" value={form.ticket_url} onChange={e => set('ticket_url', e.target.value)} placeholder="https://…" className={inputCls} />
          </Field>
        </div>
        <Field label="Learn More / Website">
          <input type="url" value={form.learnmore_link} onChange={e => set('learnmore_link', e.target.value)} placeholder="https://…" className={inputCls} />
        </Field>
        <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
          <input type="checkbox" checked={form.star} onChange={e => set('star', e.target.checked)} className="h-4 w-4 accent-brand-600" />
          <div className="flex-1">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Feature this event</span>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Shows in Featured section</span>
          </div>
        </label>
      </Card>

      {/* Card: Featured Artists */}
      <Card>
        <h3 className="mb-4 font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
          Featured Artists
        </h3>
        {linkedArtists.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {linkedArtists.map(a => (
              <span key={a.artist_id} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs dark:border-gray-800 dark:bg-white/[0.03]">
                {a.name}
                <button type="button" onClick={() => removeArtist(a.artist_id)} className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <input type="text" value={artistSearch} onChange={e => setArtistSearch(e.target.value)} placeholder="Search artist name…" autoComplete="off" className={inputCls} />
          {artistDropOpen && artistOptions.length > 0 && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
              {artistOptions.map(a => (
                <button key={a.id} type="button" onClick={() => addArtist(a.id, a.name)} className="w-full px-4 py-2.5 text-left text-sm text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/[0.05]">
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Ticket Tiers — only on existing events */}
      {!isNew && (form.id || eventId) && (
        <Card>
          <h3 className="mb-4 font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
            785 Tickets
          </h3>
          <TicketTiersEditor eventId={form.id || eventId!} stripeAccountStatus={stripeAccountStatus} />
        </Card>
      )}

      {/* Success banner */}
      {saved && !isNew && (
        <div className="rounded-lg border border-success-200 bg-success-50 p-4 dark:border-success-500/30 dark:bg-success-500/10">
          <p className="mb-3 font-semibold text-success-900 dark:text-success-300">✓ Event saved</p>
          <div className="flex flex-wrap gap-2">
            <a href={`/dashboard/events/${form.id || eventId}/tickets`} className="inline-flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400">
              Manage Tickets →
            </a>
            <a href="/dashboard/events" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
              All Events
            </a>
            <button type="button" onClick={() => setSaved(false)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
              Keep Editing
            </button>
          </div>
        </div>
      )}

      {/* Bottom save button */}
      <button onClick={handleSave} disabled={saving} className="w-full rounded-lg bg-brand-600 px-4 py-3.5 font-display text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? 'Saving…' : isNew ? 'Create Event' : 'Save Changes'}
      </button>
    </div>
  )
}

export default function EventEditPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <EventEditInner />
    </Suspense>
  )
}

// ─── Components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
        {label}
      </label>
      {children}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  )
}
