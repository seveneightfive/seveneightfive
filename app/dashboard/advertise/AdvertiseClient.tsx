'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Megaphone, Plus, Upload, X, ArrowLeft, ArrowUpRight } from 'lucide-react'

type Ad = {
  id: string
  headline: string | null
  ad_copy: string | null
  content: string | null
  ad_image_url: string | null
  button_text: string | null
  button_link: string | null
  start_date: string
  end_date: string
  duration: number
  price: number
  payment_status: string
  status: string
  views: number
  clicks: number
  created_at: string
}

type Props = {
  userId: string
  initialAds: Ad[]
  successParam: boolean
  cancelledAdId: string | null
}

const EMPTY_FORM = {
  headline: '',
  ad_copy: '',
  content: '',
  ad_image_url: '',
  button_text: '',
  button_link: '',
  start_date: new Date().toISOString().split('T')[0],
  duration: 5,
}

function calcEndDate(start: string, duration: number): string {
  const d = new Date(start + 'T12:00:00')
  d.setDate(d.getDate() + duration - 1)
  return d.toISOString().split('T')[0]
}

function formatDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length
}

export default function AdvertiseClient({
  userId,
  initialAds,
  successParam,
  cancelledAdId,
}: Props) {
  const [ads, setAds] = useState<Ad[]>(initialAds)
  const [showForm, setShowForm] = useState(initialAds.length === 0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const price = form.duration === 5 ? '$10' : '$15'
  const endDate = calcEndDate(form.start_date, form.duration)
  const canSubmit =
    form.headline &&
    form.ad_copy &&
    form.button_text &&
    form.button_link &&
    form.start_date &&
    !uploading

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    setUploading(true)
    setError('')
    const ext = file.name.split('.').pop()
    const path = `${userId}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('advertisements')
      .upload(path, file, { upsert: true })
    if (upErr) {
      setError('Upload failed — try again')
      setUploading(false)
      return
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('advertisements').getPublicUrl(path)
    setForm((f) => ({ ...f, ad_image_url: publicUrl }))
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/stripe/advertise/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Something went wrong')
      setSubmitting(false)
      return
    }
    window.location.href = json.url
  }

  async function deleteDraft(adId: string) {
    await supabase
      .from('advertisements')
      .delete()
      .eq('id', adId)
      .eq('payment_status', 'pending')
    setAds((a) => a.filter((x) => x.id !== adId))
  }

  const adStatusInfo = (ad: Ad) => {
    const today = new Date().toISOString().split('T')[0]
    if (ad.payment_status !== 'paid')
      return {
        label: 'Pending Payment',
        classes:
          'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-500/15 dark:text-warning-400 dark:border-warning-500/30',
      }
    if (today < ad.start_date)
      return {
        label: 'Scheduled',
        classes:
          'bg-blue-light-50 text-blue-light-700 border-blue-light-200 dark:bg-blue-light-500/15 dark:text-blue-light-400 dark:border-blue-light-500/30',
      }
    if (today >= ad.start_date && today <= ad.end_date)
      return {
        label: 'Active',
        classes:
          'bg-success-50 text-success-700 border-success-200 dark:bg-success-500/15 dark:text-success-400 dark:border-success-500/30',
      }
    return {
      label: 'Ended',
      classes:
        'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/[0.06] dark:text-gray-400 dark:border-gray-700',
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
            Publisher &amp; Buyer
          </p>
          <h1 className="mb-2 font-display text-3xl font-bold leading-none text-gray-900 dark:text-white">
            Advertise
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Promote your business or event to the Topeka community.
          </p>
        </div>
        {ads.length > 0 && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 font-display text-sm font-semibold uppercase tracking-wider text-gray-900 transition hover:bg-accent-600"
          >
            <Plus className="h-4 w-4" />
            Place New Ad
          </button>
        )}
      </div>

      {/* Success notice */}
      {successParam && (
        <Notice tone="success">
          ✓ Payment confirmed — your ad is now live and will appear on the home
          page and events page.
        </Notice>
      )}

      {/* Cancelled notice */}
      {cancelledAdId && (
        <Notice tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Checkout cancelled — your draft ad was not published.</span>
            <button
              type="button"
              onClick={() => deleteDraft(cancelledAdId)}
              className="text-xs font-semibold underline hover:no-underline"
            >
              Remove draft
            </button>
          </div>
        </Notice>
      )}

      {/* Existing ads */}
      {ads.length > 0 && (
        <div className="grid gap-4">
          {ads.map((ad) => {
            const info = adStatusInfo(ad)
            return (
              <div
                key={ad.id}
                className="grid grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] md:grid-cols-[1fr_auto]"
              >
                <div className="flex flex-col gap-2 p-5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${info.classes}`}
                    >
                      {info.label}
                    </span>
                    {ad.payment_status === 'paid' && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(ad.start_date)} → {formatDate(ad.end_date)}
                      </span>
                    )}
                  </div>
                  {ad.headline && (
                    <div className="font-display text-lg font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                      {ad.headline}
                    </div>
                  )}
                  {ad.ad_copy && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {ad.ad_copy}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                    <span>
                      <strong className="font-semibold text-gray-700 dark:text-gray-200">
                        {ad.views}
                      </strong>{' '}
                      views
                    </span>
                    <span>
                      <strong className="font-semibold text-gray-700 dark:text-gray-200">
                        {ad.clicks}
                      </strong>{' '}
                      clicks
                    </span>
                    {ad.clicks > 0 && ad.views > 0 && (
                      <span>
                        <strong className="font-semibold text-gray-700 dark:text-gray-200">
                          {((ad.clicks / ad.views) * 100).toFixed(1)}%
                        </strong>{' '}
                        CTR
                      </span>
                    )}
                    <span>
                      ${(ad.price / 100).toFixed(0)} · {ad.duration} days
                    </span>
                  </div>
                  {ad.payment_status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => deleteDraft(ad.id)}
                      className="mt-1 self-start text-xs font-semibold text-brand-600 underline hover:no-underline dark:text-brand-400"
                    >
                      Delete draft
                    </button>
                  )}
                </div>
                {ad.ad_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ad.ad_image_url}
                    alt={ad.headline || ''}
                    className="h-32 w-full object-cover md:h-full md:w-36"
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          {/* Form header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5 dark:border-gray-800">
            <span className="font-display text-xl font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
              Create Your Ad
            </span>
            {ads.length > 0 && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                aria-label="Close form"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* ── Fields ── */}
              <div className="flex flex-col gap-5 border-b border-gray-200 p-6 dark:border-gray-800 md:max-h-[80vh] md:overflow-y-auto md:border-b-0 md:border-r">
                <Field
                  label="Headline"
                  required
                  hint={`${form.headline.length}/60 characters`}
                >
                  <input
                    type="text"
                    placeholder="Your business name, event, or tagline"
                    maxLength={60}
                    value={form.headline}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, headline: e.target.value }))
                    }
                    required
                    className={inputCls}
                  />
                </Field>

                <Field
                  label="Ad Copy"
                  required
                  hint={`${wordCount(form.ad_copy)}/20 words`}
                >
                  <textarea
                    rows={3}
                    placeholder="Main message — keep it punchy (max 20 words)"
                    value={form.ad_copy}
                    onChange={(e) => {
                      const w = e.target.value.trim().split(/\s+/).filter(Boolean).length
                      if (w <= 20 || e.target.value.length < form.ad_copy.length) {
                        setForm((f) => ({ ...f, ad_copy: e.target.value }))
                      }
                    }}
                    required
                    className={inputCls}
                  />
                </Field>

                <Field
                  label="Additional Content"
                  optional
                  hint={`${wordCount(form.content)}/40 words`}
                >
                  <textarea
                    rows={2}
                    placeholder="Supporting description (max 40 words)"
                    value={form.content}
                    onChange={(e) => {
                      const w = e.target.value.trim().split(/\s+/).filter(Boolean).length
                      if (w <= 40 || e.target.value.length < form.content.length) {
                        setForm((f) => ({ ...f, content: e.target.value }))
                      }
                    }}
                    className={inputCls}
                  />
                </Field>

                <Field label="Ad Image" optional hint="max 5MB">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {form.ad_image_url ? (
                    <div className="relative overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.ad_image_url}
                        alt="Preview"
                        className="block h-36 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, ad_image_url: '' }))}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700"
                        aria-label="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3.5 text-sm text-gray-500 transition hover:border-accent-500 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-400 dark:hover:border-accent-500"
                    >
                      <Upload className="h-4 w-4" />
                      {uploading ? 'Uploading…' : 'Upload image'}
                    </button>
                  )}
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Button Text" required>
                    <input
                      type="text"
                      placeholder="Learn More"
                      maxLength={30}
                      value={form.button_text}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, button_text: e.target.value }))
                      }
                      required
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Button Link" required>
                    <input
                      type="url"
                      placeholder="https://"
                      value={form.button_link}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, button_link: e.target.value }))
                      }
                      required
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Start Date" required>
                    <input
                      type="date"
                      value={form.start_date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, start_date: e.target.value }))
                      }
                      required
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Package" required>
                    <select
                      value={form.duration}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          duration: parseInt(e.target.value),
                        }))
                      }
                      className={inputCls}
                    >
                      <option value={5}>5 Days — $10</option>
                      <option value={14}>14 Days — $15</option>
                    </select>
                  </Field>
                </div>

                {/* Price strip */}
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
                  <div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Total · {form.duration}-day banner placement
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(form.start_date)} → {formatDate(endDate)}
                    </div>
                  </div>
                  <div className="font-display text-2xl font-bold text-gray-900 dark:text-white">
                    {price}
                  </div>
                </div>

                {error && (
                  <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="w-full rounded-lg bg-brand-600 px-4 py-3.5 font-display text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? 'Redirecting to checkout…'
                    : `Pay ${price} & Go Live`}
                </button>

                <p className="text-center text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                  Secure checkout via Stripe. Your ad activates immediately
                  after payment. Appears on the home page and events page.
                </p>
              </div>

              {/* ── Live Preview ── */}
              <div className="flex flex-col gap-4 bg-gray-50 p-6 dark:bg-white/[0.02] md:sticky md:top-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                  Live Preview
                </div>

                {/*
                  Preview stays dark regardless of dashboard theme — this card
                  is a WYSIWYG of how the ad actually renders on the public
                  site (which is dark). Don't add dark: variants here.
                */}
                <div className="overflow-hidden rounded-xl bg-[#1a1814]">
                  {form.ad_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.ad_image_url}
                      alt="Preview"
                      className="block max-h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-full items-center justify-center bg-white/5 text-xs text-white/20">
                      Image will appear here
                    </div>
                  )}
                  <div className="flex flex-col gap-2.5 px-5 py-5">
                    <span className="inline-block w-fit rounded-full bg-accent-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#1a1814]">
                      Sponsored
                    </span>
                    {form.headline ? (
                      <div className="font-display text-lg font-bold uppercase leading-tight text-white">
                        {form.headline}
                      </div>
                    ) : (
                      <div className="font-display text-lg font-bold uppercase leading-tight text-white/20">
                        Your headline
                      </div>
                    )}
                    {form.ad_copy && (
                      <p className="text-xs leading-relaxed text-white/70">
                        {form.ad_copy}
                      </p>
                    )}
                    {form.content && (
                      <p className="text-[11px] leading-relaxed text-white/45">
                        {form.content}
                      </p>
                    )}
                    {form.button_text && (
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-wide text-white">
                          {form.button_text}
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                  This ad will appear on the{' '}
                  <strong className="font-semibold text-gray-600 dark:text-gray-300">
                    home page
                  </strong>{' '}
                  (below featured events) and the{' '}
                  <strong className="font-semibold text-gray-600 dark:text-gray-300">
                    events page
                  </strong>{' '}
                  (between event groups).
                </p>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Empty state */}
      {ads.length === 0 && !showForm && (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <Megaphone
            className="mx-auto mb-4 h-10 w-10 text-gray-300 dark:text-gray-600"
            strokeWidth={1.5}
          />
          <p className="mb-2 font-display text-xl font-semibold uppercase text-gray-900 dark:text-white">
            No Ads Yet
          </p>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Reach the Topeka community with a banner placement — from $10 for 5
            days.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 font-display text-sm font-semibold uppercase tracking-wider text-gray-900 transition hover:bg-accent-600"
          >
            <Plus className="h-4 w-4" />
            Place Your First Ad
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Bits ────────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500'

function Field({
  label,
  required,
  optional,
  hint,
  children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600 dark:text-gray-300">
        {label}
        {required && (
          <span className="ml-1 text-brand-600 dark:text-brand-400">*</span>
        )}
        {optional && (
          <span className="ml-1 font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">
            (optional)
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </div>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: 'success' | 'warning'
  children: React.ReactNode
}) {
  const cls =
    tone === 'success'
      ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400'
      : 'border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400'
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${cls}`}>
      {children}
    </div>
  )
}
