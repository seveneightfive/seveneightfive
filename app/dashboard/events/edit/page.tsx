'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import EventImagePicker from './EventImagePicker'
import TicketTiersEditor from '@/app/components/TicketTiersEditor'
import { Loader2, AlertCircle, Check, X, Trash2, ChevronRight } from 'lucide-react'

const EVENT_TYPES = [
  'Live Music', 'Art', 'Entertainment', 'Lifestyle',
  'Local Flavor', 'Community / Cultural', 'Party For A Cause',
  'Shop Local', 'Holiday', 'Exhibition',
  'Comedy Night', 'Open Mic', 'Poetry Reading', 'Trivia Night',
  'Bingo', 'Workshop / Class', 'Film / Screening', 'Dance', 'Theater',
]

const ARTIST_TYPES = ['Musician', 'Visual', 'Performance', 'Literary'] as const

type TicketMode = 'free' | 'external' | '785'

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
  // `star` is an admin-only "featured" flag. The toggle is hidden from
  // the creator UI but we keep it in state so we don't accidentally null
  // it out on save for events that admins have already starred.
  star: boolean
  venue_id: string
}

type VenueOption = { id: string; name: string; neighborhood: string | null }
type LinkedArtist = { artist_id: string; name: string; slug: string | null }

// Stacked-card flow for NEW events only. Editing an existing event still
// shows every card at once (see isNew checks in render section below) —
// progressive disclosure helps when you're staring at a blank form, not
// when you're revisiting one you already filled out.
const STEP_COUNT = 6 // Basics, Type, Image, Tickets, Learn More, Artists

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
  const [ticketMode, setTicketMode] = useState<TicketMode>('785')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [stripeAccountStatus, setStripeAccountStatus] = useState<string | null>(null)

  // Stacked-card progress (new events only)
  const [step, setStep] = useState(0)

  const [venueSearch, setVenueSearch] = useState('')
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([])
  const [selectedVenueName, setSelectedVenueName] = useState('')
  const [venueDropOpen, setVenueDropOpen] = useState(false)
  const venueDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [linkedArtists, setLinkedArtists] = useState<LinkedArtist[]>([])
  const [artistSearch, setArtistSearch] = useState('')
  const [artistOptions, setArtistOptions] = useState<{ id: string; name: string }[]>([])
  const [artistDropOpen, setArtistDropOpen] = useState(false)
  const [artistSearchedOnce, setArtistSearchedOnce] = useState(false)
  const artistDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Quick-add-a-new-artist (used when the search above turns up nothing)
  const [newArtistType, setNewArtistType] = useState<(typeof ARTIST_TYPES)[number]>('Musician')
  const [creatingArtist, setCreatingArtist] = useState(false)
  const [createArtistError, setCreateArtistError] = useState('')

  const set = <K extends keyof EventForm>(field: K, value: EventForm[K]) =>
    setForm(f => ({ ...f, [field]: value }))

  const toggleType = (t: string) =>
    set('event_types', form.event_types.includes(t)
      ? form.event_types.filter(x => x !== t)
      : [...form.event_types, t])

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      // Reading the session locally (no network round-trip) instead of
      // getUser() (which revalidates against the auth server). getUser()
      // could transiently return null on first mount before the client
      // finished syncing cookies, which was bouncing signed-in users to
      // /login right after clicking "Create New." The route is already
      // gated server-side by middleware, so by the time this component
      // mounts there should be a session — getSession() reads what's
      // already there instead of re-asking the network.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const next = `/dashboard/events/edit${eventId ? `?id=${eventId}` : ''}`
        router.push(`/login?next=${encodeURIComponent(next)}`)
        return
      }
      const user = session.user
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
          // Preserve existing star value so we don't clobber admin choices.
          star: data.star || false,
          venue_id: data.venue_id || '',
        })

        setTicketMode(
          data.ticket_url && String(data.ticket_url).trim() ? 'external' : '785'
        )

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
    setCreateArtistError('')
    if (!artistSearch.trim()) {
      setArtistOptions([])
      setArtistDropOpen(false)
      setArtistSearchedOnce(false)
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
      setArtistSearchedOnce(true)
    }, 250)
  }, [artistSearch, linkedArtists])

  const addArtist = async (artistId: string, artistName: string) => {
    setArtistDropOpen(false)
    setArtistSearch('')
    setArtistSearchedOnce(false)

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

  // Quick-add a brand-new artist right from this form — just a name and a
  // type. Creates a minimal, unclaimed artist record (no auth_user_id yet)
  // so it can be found and formally claimed later, and links it to this
  // event the same way picking an existing artist from search would.
  const quickAddArtist = async () => {
    const name = artistSearch.trim()
    if (!name) return
    setCreatingArtist(true)
    setCreateArtistError('')
    try {
      const res = await fetch('/api/artist/quick-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, artist_type: newArtistType }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCreateArtistError(json.error || 'Could not create artist')
        return
      }
      await addArtist(json.id, json.name || name)
    } catch {
      setCreateArtistError('Could not create artist')
    } finally {
      setCreatingArtist(false)
    }
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

  // Step validation for the stacked-card flow. Only Basics has hard
  // requirements; everything else is optional to fill in, but you still
  // have to pass through it once so nothing gets silently skipped.
  const validateStep = (idx: number): string | null => {
    if (idx === 0) {
      if (!form.title.trim()) return 'Please add an event title.'
      if (!form.event_date) return 'Please choose a date.'
    }
    if (idx === 3 && ticketMode === 'external' && !form.ticket_url.trim()) {
      return 'Add a ticket URL, or choose a different ticket option.'
    }
    return null
  }

  const goToStep = (idx: number) => {
    setError('')
    setStep(idx)
  }

  const handleContinue = (idx: number) => {
    const err = validateStep(idx)
    if (err) { setError(err); return }
    setError('')
    setStep(idx + 1)
  }

  const handleSave = async () => {
    if (!form.title || !form.event_date) {
      setError('Title and date are required.')
      return
    }

    if (ticketMode === 'external' && !form.ticket_url.trim()) {
      setError('Please add a Ticket URL, or switch to a different ticket option.')
      return
    }

    setSaving(true)
    setError('')

    const ticketFields =
      ticketMode === 'free'
        ? { ticket_price: 0, ticket_url: null }
        : ticketMode === 'external'
          ? {
              ticket_price: form.ticket_price !== '' ? Number(form.ticket_price) : null,
              ticket_url: form.ticket_url || null,
            }
          : {
              ticket_price: null,
              ticket_url: null,
            }

    const payload = {
      title: form.title,
      description: form.description || null,
      event_date: form.event_date,
      event_start_time: form.event_start_time || null,
      event_end_time: form.event_end_time || null,
      image_url: form.image_url || null,
      ...ticketFields,
      learnmore_link: form.learnmore_link || null,
      event_types: form.event_types,
      // Preserved from loaded data; not editable in creator UI.
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
      router.push(`/dashboard/events/${form.id || eventId}/tickets`)
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

  // Step summaries shown on collapsed (completed) cards in the new-event flow.
  const stepSummaries = [
    form.title ? `${form.title}${form.event_date ? ` · ${form.event_date}` : ''}` : '',
    form.event_types.length ? form.event_types.join(', ') : 'No types selected',
    form.image_url ? 'Image added' : 'No image added',
    ticketMode === 'free' ? 'Free event' : ticketMode === 'external' ? 'Sold elsewhere' : 'Selling on 785',
    form.learnmore_link || 'No link added',
    linkedArtists.length ? linkedArtists.map(a => a.name).join(', ') : 'None added',
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Sticky action bar — title removed; breadcrumbs/page header above already show "Create Event" / "Edit Event" */}
      <div className="sticky top-[72px] z-30 -mx-4 flex items-center justify-end gap-3 bg-white/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6 dark:bg-gray-900/95">
        {!isNew && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
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

      {/* Page intro */}
      <div>
        <h2 className="mb-1 font-display text-xl font-bold uppercase tracking-wide text-gray-900 dark:text-white">
          {isNew ? 'Create New Event' : form.title || 'Edit Event'}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isNew ? 'Fill in the details. Changes will be live on the public events directory.' : 'Update event details below.'}
        </p>
      </div>

      {/* Progress (new events only) */}
      {isNew && (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
            <span>Step {step + 1} of {STEP_COUNT}</span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-800'}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Card: Event Details */}
      <StepCard index={0} step={step} isNew={isNew} title="Event Details" summary={stepSummaries[0]} onEdit={goToStep} onContinue={() => handleContinue(0)}>
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
      </StepCard>

      {/* Card: Event Types */}
      <StepCard index={1} step={step} isNew={isNew} title="Event Type" summary={stepSummaries[1]} onEdit={goToStep} onContinue={() => handleContinue(1)}>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map(t => (
            <button key={t} type="button" onClick={() => toggleType(t)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${form.event_types.includes(t) ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:border-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>
      </StepCard>

      {/* Card: Image */}
      <StepCard index={2} step={step} isNew={isNew} title="Event Image" summary={stepSummaries[2]} onEdit={goToStep} onContinue={() => handleContinue(2)}>
        <EventImagePicker
          currentUrl={form.image_url}
          userId={userId || 'event'}
          onUploaded={url => set('image_url', url)}
          onClear={() => set('image_url', '')}
        />
      </StepCard>

      {/* Card: Tickets */}
      <StepCard index={3} step={step} isNew={isNew} title="Tickets" summary={stepSummaries[3]} onEdit={goToStep} onContinue={() => handleContinue(3)}>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          How are tickets handled for this event?
        </p>

        {/* Mode selector */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([
            { id: 'free', label: 'Free Event', desc: 'No tickets needed' },
            { id: 'external', label: 'Sold Elsewhere', desc: 'Eventbrite, venue site, etc.' },
            { id: '785', label: 'Sell on 785', desc: 'Built-in ticketing' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTicketMode(opt.id)}
              className={`rounded-lg border p-3 text-left transition ${
                ticketMode === opt.id
                  ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/20 dark:bg-brand-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.03] dark:hover:border-gray-600'
              }`}
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-white">{opt.label}</div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{opt.desc}</div>
            </button>
          ))}
        </div>

        {/* Mode-specific content */}
        {ticketMode === 'external' && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Display Price ($)">
              <input type="number" min="0" step="0.01" value={form.ticket_price} onChange={e => set('ticket_price', e.target.value)} placeholder="Optional" className={inputCls} />
            </Field>
            <Field label="Ticket URL *">
              <input type="url" value={form.ticket_url} onChange={e => set('ticket_url', e.target.value)} placeholder="https://…" className={inputCls} />
            </Field>
          </div>
        )}

        {ticketMode === '785' && (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-white/[0.02]">
            {isNew ? (
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">Save the event first</span> — once it's created, you'll be able to add ticket tiers (General Admission, VIP, etc.) below.
              </p>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                Ticket tiers are managed in the <span className="font-semibold text-gray-900 dark:text-white">785 Ticketing</span> section below.
              </p>
            )}
          </div>
        )}

        {ticketMode === 'free' && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            No ticket fields needed. Attendees can just show up.
          </p>
        )}
      </StepCard>

      {/* Card: Learn More Link */}
      <StepCard index={4} step={step} isNew={isNew} title="Learn More Link" summary={stepSummaries[4]} onEdit={goToStep} onContinue={() => handleContinue(4)}>
        <Field label="Learn More / Website">
          <input type="url" value={form.learnmore_link} onChange={e => set('learnmore_link', e.target.value)} placeholder="https://…" className={inputCls} />
        </Field>
      </StepCard>

      {/* Card: Featured Artists */}
      <StepCard index={5} step={step} isNew={isNew} title="Featured Artists" summary={stepSummaries[5]} onEdit={goToStep} onContinue={handleSave} saving={saving} isLast>
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

        {/* Quick-add — shown once a search has run and turned up nothing */}
        {artistSearchedOnce && artistOptions.length === 0 && artistSearch.trim() && (
          <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-white/[0.02]">
            <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
              Can't find <span className="font-semibold text-gray-900 dark:text-white">"{artistSearch.trim()}"</span>? Add them as a new artist:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={newArtistType}
                onChange={e => setNewArtistType(e.target.value as (typeof ARTIST_TYPES)[number])}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-800 outline-none dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
              >
                {ARTIST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                type="button"
                onClick={quickAddArtist}
                disabled={creatingArtist}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingArtist ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {creatingArtist ? 'Adding…' : `Add "${artistSearch.trim()}"`}
              </button>
            </div>
            {createArtistError && (
              <p className="mt-2 text-xs text-brand-600 dark:text-brand-400">{createArtistError}</p>
            )}
          </div>
        )}
      </StepCard>

      {/* 785 Ticketing — only when the event is saved AND user picked 785 mode */}
      {!isNew && (form.id || eventId) && ticketMode === '785' && (
        <Card>
          <h3 className="mb-1 font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
            785 Ticketing
          </h3>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Set up ticket tiers (General Admission, VIP, etc.) for this event.
          </p>
          <TicketTiersEditor eventId={form.id || eventId!} stripeAccountStatus={stripeAccountStatus} />
        </Card>
      )}

      {/* Success banner */}
      {saved && !isNew && (
        <div className="rounded-lg border border-success-200 bg-success-50 p-4 dark:border-success-500/30 dark:bg-success-500/10">
          <p className="mb-3 font-semibold text-success-900 dark:text-success-300">✓ Event saved</p>
          <div className="flex flex-wrap gap-2">
            {ticketMode === '785' && (
              <a href={`/dashboard/events/${form.id || eventId}/tickets`} className="inline-flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400">
                Manage Tickets →
              </a>
            )}
            <a href="/dashboard/events" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
              All Events
            </a>
            <button type="button" onClick={() => setSaved(false)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
              Keep Editing
            </button>
          </div>
        </div>
      )}

      {/* Bottom save button (edit mode only — new events publish from the Featured Artists card above) */}
      {!isNew && (
        <button onClick={handleSave} disabled={saving} className="w-full rounded-lg bg-brand-600 px-4 py-3.5 font-display text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      )}
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

/**
 * Wraps each form section for the stacked-card flow.
 *
 * - Editing an existing event (isNew === false): always renders fully
 *   expanded, same as before — no gating.
 * - Creating a new event (isNew === true):
 *     - index > step  → not reached yet, not rendered at all
 *     - index < step  → completed, rendered collapsed with a summary and
 *                       an "Edit" affordance that jumps back to it
 *     - index === step → active, fully expanded, with a Continue button
 */
function StepCard({
  index, step, isNew, title, summary, children, onEdit, onContinue, isLast, saving,
}: {
  index: number
  step: number
  isNew: boolean
  title: string
  summary?: string
  children: React.ReactNode
  onEdit: (index: number) => void
  onContinue: () => void
  isLast?: boolean
  saving?: boolean
}) {
  if (!isNew) {
    return (
      <Card>
        <h3 className="mb-4 font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
          {title}
        </h3>
        {children}
      </Card>
    )
  }

  if (index > step) return null

  if (index < step) {
    return (
      <button
        type="button"
        onClick={() => onEdit(index)}
        className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-gray-700"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-success-600 dark:text-success-400">
              Step {index + 1} · Complete
            </p>
            <h3 className="font-display text-base font-bold text-gray-900 dark:text-white">{title}</h3>
            {summary && (
              <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{summary}</p>
            )}
          </div>
          <span className="shrink-0 text-xs font-semibold text-brand-600 dark:text-brand-400">Edit</span>
        </div>
      </button>
    )
  }

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
          {title}
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Step {index + 1} of {STEP_COUNT}</span>
      </div>
      {children}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onContinue}
          disabled={isLast && saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLast ? (
            <>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Publish Event'}
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-800 dark:text-gray-200">
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
