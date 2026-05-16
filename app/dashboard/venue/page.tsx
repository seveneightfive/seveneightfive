'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import ImageUpload from '@/app/dashboard/edit/ImageUpload'
import { Check, Image as ImageIcon } from 'lucide-react'

type Venue = {
  id: string
  name: string
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  website: string | null
  venue_type: string[] | null
  image_url: string | null
}

const VENUE_TYPES = [
  'Bar / Lounge',
  'Concert Venue',
  'Restaurant',
  'Art Gallery',
  'Outdoor / Park',
  'Theater',
  'Community Space',
  'Brewery / Taproom',
  'Hotel / Event Space',
  'Club / Nightclub',
  'Coffee Shop',
  'Other',
]

export default function VenuePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <VenuePageInner />
    </Suspense>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-pulse rounded-full bg-gray-300 dark:bg-gray-700"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function VenuePageInner() {
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const query = supabase
        .from('venues')
        .select(
          'id, name, address, neighborhood, city, state, website, venue_type, image_url'
        )
        .eq('auth_user_id', user.id)

      const { data } = venueId
        ? await query.eq('id', venueId).single()
        : await query.single()

      if (!data) {
        router.push('/dashboard')
        return
      }

      setVenue(data as Venue)
      setForm(data as Venue)
      setLoading(false)
    }
    load()
  }, [router, venueId])

  const set = (field: keyof Venue, value: string | string[] | null) =>
    setForm((f) => (f ? { ...f, [field]: value } : f))

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

  if (loading || !form) return <LoadingState />

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
          Creator
        </p>
        <h1 className="mb-2 font-display text-3xl font-bold leading-none text-gray-900 dark:text-white">
          {venue?.name}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Edit your venue details. Changes appear on the public venues directory.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Image */}
        <Field label="Venue Image" hint="Full-width image (recommended: landscape, 1200px+ wide)">
          {form.image_url && (
            <img
              src={form.image_url}
              alt=""
              className="mb-2 block aspect-video w-full rounded-lg bg-gray-100 object-cover dark:bg-white/[0.04]"
            />
          )}
          <input
            type="url"
            placeholder="https://… or upload below"
            value={form.image_url || ''}
            onChange={(e) => set('image_url', e.target.value)}
            className={inputCls}
          />
          <div className="mt-2">
            <ImageUpload
              artistId={form.id}
              field="hero"
              currentUrl={form.image_url || ''}
              onUploaded={(url) => set('image_url', url)}
              bucket="venue-images"
            />
          </div>
        </Field>

        <Divider />

        {/* Name */}
        <Field label="Venue Name">
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Divider />

        {/* Venue Type */}
        <Field label="Venue Type" hint="Select all that apply">
          <div className="flex flex-wrap gap-2">
            {VENUE_TYPES.map((t) => {
              const selected = form.venue_type?.includes(t) ?? false
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    const current = form.venue_type || []
                    set(
                      'venue_type',
                      selected ? current.filter((v) => v !== t) : [...current, t]
                    )
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    selected
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:border-gray-600'
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </Field>

        <Divider />

        {/* Address */}
        <Field label="Street Address">
          <input
            type="text"
            value={form.address || ''}
            onChange={(e) => set('address', e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* Neighborhood */}
        <Field label="Neighborhood / Area">
          <input
            type="text"
            value={form.neighborhood || ''}
            onChange={(e) => set('neighborhood', e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* City / State */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="City">
            <input
              type="text"
              value={form.city || ''}
              onChange={(e) => set('city', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="State">
            <input
              type="text"
              value={form.state || ''}
              onChange={(e) => set('state', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {/* Website */}
        <Field label="Website">
          <input
            type="url"
            value={form.website || ''}
            onChange={(e) => set('website', e.target.value)}
            placeholder="https://…"
            className={inputCls}
          />
        </Field>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full rounded-lg px-4 py-3.5 font-display text-sm font-semibold uppercase tracking-wider text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
            saved ? 'bg-success-600 hover:bg-success-700' : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {saving ? (
            'Saving…'
          ) : saved ? (
            <>
              <Check className="mb-0.5 inline mr-1.5 h-4 w-4" />
              Saved
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Bits ────────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </div>
  )
}

function Divider() {
  return <hr className="border-t border-gray-100 dark:border-gray-800" />
}
