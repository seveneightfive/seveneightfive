'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import EventImagePicker from '@/app/dashboard/events/edit/EventImagePicker'
import { Loader2, AlertCircle, Sparkles } from 'lucide-react'

type VenueOption = { id: string; name: string; neighborhood: string | null }

export default function NewMenuProclamationPage() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null)

  const [venueSearch, setVenueSearch] = useState('')
  const [venueId, setVenueId] = useState('')
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([])
  const [venueDropOpen, setVenueDropOpen] = useState(false)
  const venueDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?next=${encodeURIComponent('/dashboard/menu-proclamations/new')}`)
        return
      }
      setUserId(session.user.id)
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (!venueSearch.trim() || venueSearch === venueOptions.find(v => v.id === venueId)?.name) {
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
        .overlaps('venue_type', ['Local Flavor', 'Bar/Tavern', 'Brewery / Winery', 'Coffee Shop', 'Catering'])
        .ilike('name', `%${venueSearch}%`)
        .limit(8)
      setVenueOptions(data || [])
      setVenueDropOpen(true)
    }, 250)
  }, [venueSearch, venueId])

  const handleSubmit = async () => {
    setError('')
    if (!venueId) { setError('Search for and select a venue.'); return }
    if (!imageUrl) { setError('Add a photo before submitting.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/menu-proc/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venueId,
          title: title || null,
          content: content || null,
          images: [imageUrl],
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not submit — please try again.')
        setSaving(false)
        return
      }
      setPointsAwarded(json.points_awarded ?? 0)
    } catch {
      setError('Could not submit — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500'

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (pointsAwarded !== null) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-success-200 bg-success-50 p-6 text-center dark:border-success-500/30 dark:bg-success-500/10">
        <Sparkles className="mx-auto h-8 w-8 text-success-600 dark:text-success-400" />
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-success-900 dark:text-success-300">
          Posted!
        </h2>
        <p className="text-sm text-success-800 dark:text-success-300">
          {pointsAwarded > 0
            ? `You earned ${pointsAwarded} points for this submission.`
            : 'Your photo is live on the Local Flavor page.'}
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <a href="/local-flavor" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
            View Local Flavor
          </a>
          <button
            type="button"
            onClick={() => {
              setPointsAwarded(null)
              setTitle('')
              setContent('')
              setImageUrl('')
              setVenueId('')
              setVenueSearch('')
            }}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Post Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="mb-1 font-display text-xl font-bold uppercase tracking-wide text-gray-900 dark:text-white">
          Share a Photo
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Show off what you're eating around Topeka — earn points and help other locals find their next favorite dish.
        </p>
      </div>

      {error && (
        <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-800 dark:text-gray-200">
            Venue *
          </label>
          <div className="relative">
            <input
              type="text"
              value={venueSearch}
              onChange={e => { setVenueSearch(e.target.value); if (!e.target.value) setVenueId('') }}
              placeholder="Search restaurants, bars, coffee shops…"
              autoComplete="off"
              className={inputCls}
            />
            {venueDropOpen && venueOptions.length > 0 && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                {venueOptions.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { setVenueId(v.id); setVenueSearch(v.name); setVenueDropOpen(false) }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/[0.05]"
                  >
                    <span className="font-semibold text-gray-900 dark:text-white">{v.name}</span>
                    {v.neighborhood && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{v.neighborhood}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!venueId && venueSearch.trim() && !venueDropOpen && (
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Can't find it? It may not be tagged as a food &amp; drink venue yet — <a href="https://seveneightfive.fillout.com/new-venue" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 dark:text-brand-400">list it here</a>.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-800 dark:text-gray-200">
            Photo *
          </label>
          <EventImagePicker
            currentUrl={imageUrl}
            userId={userId || 'menu-proc'}
            bucket="menu-proc-images"
            onUploaded={url => setImageUrl(url)}
            onClear={() => setImageUrl('')}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-800 dark:text-gray-200">
            What'd you get? (optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. The brisket tacos"
            className={inputCls}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-800 dark:text-gray-200">
            Notes (optional)
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What made it worth a photo?"
            rows={3}
            className={`${inputCls} resize-y leading-relaxed`}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {saving ? 'Posting…' : 'Post & Earn Points'}
      </button>
    </div>
  )
}
