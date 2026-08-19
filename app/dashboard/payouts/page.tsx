'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import {
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Globe,
} from 'lucide-react'

/**
 * Payouts — CSS restyle to match the mockup's cleaner card treatment.
 *
 * NOTE: the mockup shows Available / Pending / Paid Out YTD stat tiles.
 * Those require pulling live numbers from the Stripe Balance API (for
 * Available/Pending) and a transfers/payouts history query (for Paid
 * Out YTD) — data this page doesn't currently fetch. That's flagged as
 * a separate backend task, not included in this pass. Everything else
 * here (connect flow, status card, seller details form, "what you can
 * do" list) is the same logic as before, restyled.
 *
 * ADDED: a "Your public seller page" card once Stripe is enabled and
 * seller_slug exists. seller_slug is generated automatically by
 * lib/stripeSync.ts the moment the account first becomes enabled — see
 * that file for the generation logic. This card is the only place in
 * the app that currently surfaces the /sellers/[slug] URL to the seller
 * themselves.
 */

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  stripe_account_id: string | null
  stripe_account_status: 'pending' | 'restricted' | 'enabled' | null
  is_seller: boolean
  seller_slug: string | null
  seller_slug_changed_at: string | null
  seller_business_name: string | null
  seller_support_email: string | null
  seller_activated_at: string | null
}

const SITE_URL = 'https://seveneightfive.com'

export default function PayoutsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PayoutsPageInner />
    </Suspense>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  )
}

function PayoutsPageInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const [businessName, setBusinessName] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)

  // Slug editing (one-time, with confirmation)
  const [editingSlug, setEditingSlug] = useState(false)
  const [slugDraft, setSlugDraft] = useState('')
  const [confirmingSlug, setConfirmingSlug] = useState(false)
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState('')

  const stripeConnected = searchParams.get('stripe_connected') === '1'
  const stripePending = searchParams.get('stripe_pending') === '1'
  const stripeError = searchParams.get('stripe_error')
  const stripeRefresh = searchParams.get('stripe_refresh') === '1'

  const PROFILE_SELECT = `id, full_name, email,
          stripe_account_id, stripe_account_status,
          is_seller, seller_slug, seller_slug_changed_at, seller_business_name, seller_support_email, seller_activated_at`

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data as Profile)
        setBusinessName(data.seller_business_name || '')
        setSupportEmail(data.seller_support_email || data.email || '')
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // If we just landed back from Stripe as "enabled" but the profile we
  // loaded before the redirect doesn't have a seller_slug yet, re-fetch
  // once — sync runs server-side in the return route just before this
  // page renders, so the slug is normally already there, but this
  // covers any timing edge case.
  useEffect(() => {
    if (!stripeConnected || !profile) return
    if (profile.stripe_account_status === 'enabled' && profile.seller_slug) return

    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', user.id)
        .single()
      if (!cancelled && data) setProfile(data as Profile)
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripeConnected, profile?.stripe_account_status, profile?.seller_slug])

  useEffect(() => {
    if (!profile?.stripe_account_id) return
    if (profile.stripe_account_status === 'enabled') return
    if (syncing) return

    let cancelled = false
    setSyncing(true)
    fetch('/api/stripe/connect/sync', { method: 'POST' })
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        if (json?.status && json.status !== profile.stripe_account_status) {
          setProfile(p => p ? { ...p, stripe_account_status: json.status } : p)
        }
      })
      .catch(() => { /* silent — non-critical */ })
      .finally(() => { if (!cancelled) setSyncing(false) })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.stripe_account_id])

  useEffect(() => {
    if (stripeRefresh && profile && !connecting) {
      handleConnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripeRefresh, profile])

  async function handleConnect() {
    setConnecting(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: '/dashboard/payouts' }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) {
        throw new Error(json.error || 'Could not start Stripe onboarding')
      }
      window.location.href = json.url
    } catch (err: any) {
      setError(err?.message || 'Something went wrong')
      setConnecting(false)
    }
  }

  async function handleManualSync() {
    setSyncing(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/connect/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Sync failed')
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('id', user.id)
          .single()
        if (data) setProfile(data as Profile)
      }
    } catch (err: any) {
      setError(err?.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSaveSellerProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSavingProfile(true)
    setProfileSaved(false)
    setError('')
    const { error: err } = await supabase
      .from('profiles')
      .update({
        seller_business_name: businessName || null,
        seller_support_email: supportEmail || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
    setSavingProfile(false)
    if (err) {
      setError(err.message)
    } else {
      setProfile((p) =>
        p
          ? {
              ...p,
              seller_business_name: businessName || null,
              seller_support_email: supportEmail || null,
            }
          : p
      )
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    }
  }

  function handleCopyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Slug editing (one-time) ───────────────────────────────────────
  function startEditingSlug() {
    setSlugDraft(profile?.seller_slug || '')
    setSlugError('')
    setConfirmingSlug(false)
    setEditingSlug(true)
  }

  function cancelEditingSlug() {
    setEditingSlug(false)
    setConfirmingSlug(false)
    setSlugError('')
  }

  function handleSlugDraftChange(raw: string) {
    // Mirror the server's slugify rules live so what they see typing
    // matches what will actually be saved.
    const formatted = raw
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60)
    setSlugDraft(formatted)
    if (slugError) setSlugError('')
  }

  function requestSlugChange(e: React.FormEvent) {
    e.preventDefault()
    setSlugError('')

    const cleaned = slugDraft.replace(/^-+|-+$/g, '')
    if (cleaned.length < 3) {
      setSlugError('Your URL needs to be at least 3 characters.')
      return
    }
    if (cleaned === profile?.seller_slug) {
      setSlugError("That's already your current URL.")
      return
    }
    // First submit just arms the confirmation step — the actual save
    // happens in confirmSlugChange below.
    setConfirmingSlug(true)
  }

  async function confirmSlugChange() {
    setSlugSaving(true)
    setSlugError('')
    try {
      const res = await fetch('/api/seller/slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slugDraft }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Could not update your URL.')

      setProfile((p) =>
        p
          ? { ...p, seller_slug: json.slug, seller_slug_changed_at: new Date().toISOString() }
          : p
      )
      setEditingSlug(false)
      setConfirmingSlug(false)
    } catch (err: any) {
      setSlugError(err?.message || 'Could not update your URL.')
      setConfirmingSlug(false)
    } finally {
      setSlugSaving(false)
    }
  }

  if (loading) return <LoadingState />

  const status = profile?.stripe_account_status
  const hasAccount = !!profile?.stripe_account_id
  const isEnabled = status === 'enabled'
  const isRestricted = status === 'restricted'
  const isPending = status === 'pending'

  const publicUrl = profile?.seller_slug ? `${SITE_URL}/sellers/${profile.seller_slug}` : null

  const statusLabel = isEnabled
    ? 'Active'
    : isRestricted
      ? 'Action needed'
      : isPending
        ? 'In progress'
        : 'Not connected'

  return (
    <div className="space-y-6">
      {stripeConnected && (
        <div className="flex gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
          <Check className="h-4 w-4 shrink-0" />
          Your Stripe account is connected. You're ready to sell.
        </div>
      )}

      {stripePending && (
        <div className="flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Almost there — Stripe still needs a bit more info before you can take payments.
        </div>
      )}

      {stripeError && (
        <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Something went wrong returning from Stripe. Please try connecting again.
        </div>
      )}

      {/* ── Public seller page — shown as soon as Stripe is enabled ── */}
      {isEnabled && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
              Your Public Seller Page
            </h2>
          </div>
          {publicUrl ? (
            <>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                This is your live ticketing page — share it directly, or link to it from your
                own website. It lists your upcoming events, past events, and refund policy.
              </p>

              {!editingSlug && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="flex-1 min-w-[220px] truncate rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-300">
                      {publicUrl.replace('https://', '')}
                    </code>
                    <button
                      onClick={() => handleCopyLink(publicUrl)}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
                    >
                      <Copy className="h-4 w-4" />
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2.5 font-semibold text-white transition hover:bg-gray-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View page
                    </a>
                  </div>

                  <div className="mt-3">
                    {profile?.seller_slug_changed_at ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        You've already used your one-time URL change. Need it changed again?
                        Email <a href="mailto:support@seveneightfive.com" className="underline">support@seveneightfive.com</a>.
                      </p>
                    ) : (
                      <button
                        onClick={startEditingSlug}
                        className="text-xs font-semibold text-brand-600 underline decoration-dotted underline-offset-2 hover:text-brand-700 dark:text-brand-400"
                      >
                        Change your URL (one-time)
                      </button>
                    )}
                  </div>
                </>
              )}

              {editingSlug && !confirmingSlug && (
                <form onSubmit={requestSlugChange} className="space-y-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                    New URL
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-1 min-w-[220px] items-center rounded-lg border border-gray-200 bg-white pl-3.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03]">
                      <span className="shrink-0 text-sm text-gray-400 dark:text-gray-500">
                        seveneightfive.com/sellers/
                      </span>
                      <input
                        autoFocus
                        type="text"
                        value={slugDraft}
                        onChange={(e) => handleSlugDraftChange(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent py-2.5 pr-3.5 text-sm text-gray-800 outline-none dark:text-white/90"
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2.5 font-semibold text-white transition hover:bg-gray-800"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditingSlug}
                      className="rounded-lg px-3 py-2.5 font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                  {slugError && (
                    <p className="text-xs font-medium text-brand-600 dark:text-brand-400">{slugError}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Lowercase letters, numbers, and dashes only. You can only do this once, so
                    double-check it before continuing.
                  </p>
                </form>
              )}

              {editingSlug && confirmingSlug && (
                <div className="rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-500/30 dark:bg-warning-500/10">
                  <div className="mb-2 flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-700 dark:text-warning-400" />
                    <p className="text-sm font-semibold text-warning-900 dark:text-warning-300">
                      This will break your current link
                    </p>
                  </div>
                  <p className="mb-1 text-sm text-warning-800 dark:text-warning-300">
                    <code className="rounded bg-white/60 px-1 dark:bg-black/20">
                      /sellers/{profile?.seller_slug}
                    </code>{' '}
                    will stop working. Anything pointing to it — your website, a QR code, a
                    text you've already sent — will 404.
                  </p>
                  <p className="mb-3 text-sm text-warning-800 dark:text-warning-300">
                    Your new page will be{' '}
                    <code className="rounded bg-white/60 px-1 dark:bg-black/20">
                      /sellers/{slugDraft}
                    </code>
                    . This can't be undone without contacting support.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={confirmSlugChange}
                      disabled={slugSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-warning-600 px-4 py-2.5 font-semibold text-white transition hover:bg-warning-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {slugSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : ''}
                      {slugSaving ? 'Updating…' : 'Yes, change my URL'}
                    </button>
                    <button
                      onClick={() => setConfirmingSlug(false)}
                      disabled={slugSaving}
                      className="rounded-lg px-3 py-2.5 font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Go back
                    </button>
                  </div>
                  {slugError && (
                    <p className="mt-2 text-xs font-medium text-brand-600 dark:text-brand-400">{slugError}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting up your page — refresh in a moment if this doesn't update.
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
              Stripe Connect
            </h2>
            {hasAccount && (
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.08]"
                title="Re-check status with Stripe"
              >
                <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Checking…' : 'Re-check status'}
              </button>
            )}
          </div>

          <div className="mb-6 flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
            <div
              className={`h-3 w-3 shrink-0 rounded-full ${
                isEnabled
                  ? 'bg-success-600'
                  : isRestricted || isPending
                    ? 'bg-warning-600'
                    : 'bg-gray-400'
              }`}
            />
            <div className="flex-1">
              <p
                className={`font-semibold ${
                  isEnabled
                    ? 'text-success-900 dark:text-success-300'
                    : isRestricted || isPending
                      ? 'text-warning-900 dark:text-warning-300'
                      : 'text-gray-900 dark:text-gray-300'
                }`}
              >
                {statusLabel}
              </p>
              <p
                className={`mt-1 text-xs ${
                  isEnabled
                    ? 'text-success-700 dark:text-success-400'
                    : isRestricted || isPending
                      ? 'text-warning-700 dark:text-warning-400'
                      : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {isEnabled && 'Charges and payouts are enabled.'}
                {isRestricted && 'Stripe needs additional info — finish onboarding to start selling.'}
                {isPending && 'Onboarding started — finish to enable payouts.'}
                {!hasAccount && "You haven't connected a Stripe account yet."}
              </p>
            </div>
            {profile?.seller_activated_at && isEnabled && (
              <div className="text-right text-xs text-gray-600 dark:text-gray-400">
                Active since
                <br />
                {new Date(profile.seller_activated_at).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </div>
            )}
          </div>

          {!isEnabled && (
            <>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                We use Stripe Connect so payouts go straight to your bank.
                seveneightfive takes a small platform fee per ticket — Stripe handles their card
                processing fees separately. You'll need a U.S. bank account, your legal name,
                date of birth, and the last 4 of your SSN. It usually takes 3–5 minutes.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : ''}
                {connecting ? 'Opening Stripe…' : hasAccount ? 'Continue setup' : 'Connect Stripe'}
              </button>
            </>
          )}

          {isEnabled && (
            <div className="flex flex-wrap gap-2">
              <a
                href="https://dashboard.stripe.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
              >
                <ExternalLink className="h-4 w-4" />
                Open Stripe dashboard
              </a>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : ''}
                {connecting ? 'Loading…' : 'Update banking info'}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <hr className="my-6 border-t border-gray-200 dark:border-gray-800" />

        {hasAccount && (
          <form className="space-y-4" onSubmit={handleSaveSellerProfile}>
            <h3 className="font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
              Seller Details
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Shown to buyers on receipts and ticket pages. Optional — defaults to your name and email.
            </p>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                Business or organizer name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={profile?.full_name || 'e.g. Topeka Live Events'}
                disabled={savingProfile}
                className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              {isEnabled && (
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  This updates the name shown on your public page, not its URL. You can change
                  your URL separately (one time) from the card above.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                Customer support email
              </label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder={profile?.email || 'support@yourdomain.com'}
                disabled={savingProfile}
                className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                Buyers contact this email for refunds and questions.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : ''}
                {savingProfile ? 'Saving…' : 'Save seller details'}
              </button>
              {profileSaved && (
                <span className="text-sm font-semibold text-success-600 dark:text-success-400">✓ Saved</span>
              )}
            </div>
          </form>
        )}

        {hasAccount && (
          <>
            <hr className="my-6 border-t border-gray-200 dark:border-gray-800" />

            <div>
              <h3 className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                What can I do once I'm connected?
              </h3>
              <ul className="mb-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-success-600 dark:text-success-400 mt-0.5" />
                  <span>Sell tickets to your events with payouts to your bank</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-success-600 dark:text-success-400 mt-0.5" />
                  <span>Accept donations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-success-600 dark:text-success-400 mt-0.5" />
                  <span>List merchandise for events</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-success-600 dark:text-success-400 mt-0.5" />
                  <span>Run paid promotions and ads on seveneightfive.com</span>
                </li>
              </ul>

              <div className="flex flex-wrap gap-2">
                <a
                  href="/dashboard/events"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
                >
                  Manage your events
                </a>
                <a
                  href="/dashboard/advertise"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
                >
                  Advertise
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
