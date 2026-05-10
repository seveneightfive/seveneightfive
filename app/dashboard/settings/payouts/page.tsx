'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import { SETTINGS_CSS } from '../settingsStyles'

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  stripe_account_id: string | null
  stripe_account_status: 'pending' | 'restricted' | 'enabled' | null
  is_seller: boolean
  seller_business_name: string | null
  seller_support_email: string | null
  seller_activated_at: string | null
}

export default function PayoutsSettingsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#1a1814' }} />}>
      <PayoutsSettings />
    </Suspense>
  )
}

function PayoutsSettings() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  // ... rest of component (everything else stays the same)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [error, setError] = useState('')

  // Seller profile form
  const [businessName, setBusinessName] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)

  // Banners from Stripe redirect (?stripe_connected=1, ?stripe_pending=1, ?stripe_error=1, ?stripe_refresh=1)
  const stripeConnected = searchParams.get('stripe_connected') === '1'
  const stripePending = searchParams.get('stripe_pending') === '1'
  const stripeError = searchParams.get('stripe_error')
  const stripeRefresh = searchParams.get('stripe_refresh') === '1'

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?next=/dashboard/settings/payouts')
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select(`
          id, full_name, email,
          stripe_account_id, stripe_account_status,
          is_seller, seller_business_name, seller_support_email, seller_activated_at
        `)
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
  }, [router])

  // If we just came back from a refresh redirect, immediately re-launch onboarding
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
        body: JSON.stringify({ returnPath: '/dashboard/settings/payouts' }),
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
      setProfile(p => p ? {
        ...p,
        seller_business_name: businessName || null,
        seller_support_email: supportEmail || null,
      } : p)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#1a1814' }} />
  }

  const status = profile?.stripe_account_status
  const hasAccount = !!profile?.stripe_account_id
  const isEnabled = status === 'enabled'
  const isRestricted = status === 'restricted'
  const isPending = status === 'pending'

  // Status pill styling
  const statusLabel = isEnabled
    ? 'Active'
    : isRestricted
      ? 'Action needed'
      : isPending
        ? 'In progress'
        : 'Not connected'

  const statusColor = isEnabled
    ? '#19a974'
    : isRestricted
      ? '#e86b1c'
      : isPending
        ? '#caa400'
        : '#888'

  return (
    <>
      <style>{SETTINGS_CSS}</style>

      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <a href="/dashboard/settings" className="back-btn">
            <span className="back-arrow">←</span>
            Settings
          </a>
        </div>
        <a href="/" className="wordmark">seven<em>eight</em>five</a>
      </div>

      <div className="page">
        <div className="page-header">
          <div className="page-eyebrow">Account Settings</div>
          <div className="page-title">Payouts &amp; Selling</div>
          <div className="page-sub">
            Connect your bank to sell tickets, accept donations, and receive payouts.
          </div>
        </div>

        {/* Return banners from the connect flow */}
        {stripeConnected && (
          <div className="success-banner">
            ✓ &nbsp;Your Stripe account is connected. You're ready to sell.
          </div>
        )}
        {stripePending && (
          <div
            className="success-banner"
            style={{ background: '#3a2f1a', color: '#ffce03', borderColor: '#5a4828' }}
          >
            Almost there — Stripe still needs a bit more info before you can take payments.
          </div>
        )}
        {stripeError && (
          <div
            className="success-banner"
            style={{ background: '#3a1a1a', color: '#ff7777', borderColor: '#5a2828' }}
          >
            Something went wrong returning from Stripe. Please try connecting again.
          </div>
        )}

        {/* Status card */}
        <div className="settings-section">
          <div className="section-title">Stripe Connect</div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '14px 16px',
              background: '#26221d',
              border: '1px solid #3a3530',
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: statusColor,
                  boxShadow: `0 0 0 3px ${statusColor}22`,
                }}
              />
              <div>
                <div style={{ color: '#fafafa', fontWeight: 600, fontSize: 15 }}>
                  {statusLabel}
                </div>
                <div style={{ color: '#9b9590', fontSize: 13 }}>
                  {isEnabled && 'Charges and payouts are enabled.'}
                  {isRestricted && 'Stripe needs additional info — finish onboarding to start selling.'}
                  {isPending && 'Onboarding started — finish to enable payouts.'}
                  {!hasAccount && 'You haven\'t connected a Stripe account yet.'}
                </div>
              </div>
            </div>

            {profile?.seller_activated_at && isEnabled && (
              <div style={{ color: '#9b9590', fontSize: 12, textAlign: 'right' }}>
                Active since
                <br />
                {new Date(profile.seller_activated_at).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </div>
            )}
          </div>

          {/* Action: connect / continue / manage */}
          {!isEnabled && (
            <>
              <p
                className="field-hint"
                style={{ marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}
              >
                We use Stripe Connect so payouts go straight to your bank. seveneightfive
                takes a small platform fee per ticket — Stripe handles their card processing
                fees separately. You'll need a U.S. bank account, your legal name, date of
                birth, and the last 4 of your SSN. It usually takes 3–5 minutes.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting
                  ? 'Opening Stripe…'
                  : hasAccount
                    ? 'Continue setup'
                    : 'Connect Stripe to start selling'}
              </button>
            </>
          )}

          {isEnabled && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href="https://dashboard.stripe.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
              >
                Open Stripe dashboard →
              </a>
              <button
                className="btn btn-ghost"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? 'Loading…' : 'Update banking info'}
              </button>
            </div>
          )}

          {error && (
            <p className="field-error" style={{ marginTop: 12 }}>{error}</p>
          )}
        </div>

        {/* Seller display info — only useful once connected */}
        {hasAccount && (
          <form className="settings-section" onSubmit={handleSaveSellerProfile}>
            <div className="section-title">Seller details</div>
            <p className="field-hint" style={{ marginTop: 0, marginBottom: 14 }}>
              Shown to buyers on receipts and ticket pages. Optional — defaults to your name and email.
            </p>

            <div className="field">
              <label className="field-label" htmlFor="biz-name">Business or organizer name</label>
              <input
                id="biz-name"
                type="text"
                className="field-input"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder={profile?.full_name || 'e.g. Topeka Live Events'}
                disabled={savingProfile}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="support-email">Customer support email</label>
              <input
                id="support-email"
                type="email"
                className="field-input"
                value={supportEmail}
                onChange={e => setSupportEmail(e.target.value)}
                placeholder={profile?.email || 'support@yourdomain.com'}
                disabled={savingProfile}
              />
              <p className="field-hint">Buyers contact this email for refunds and questions.</p>
            </div>

            <div className="btn-row" style={{ marginTop: 4 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingProfile}
              >
                {savingProfile ? 'Saving…' : 'Save seller details'}
              </button>
              {profileSaved && (
                <span style={{ color: '#19a974', fontSize: 14, alignSelf: 'center' }}>
                  ✓ Saved
                </span>
              )}
            </div>
          </form>
        )}

        {/* Help / what next */}
        <div className="settings-section">
          <div className="section-title">What can I do once I'm connected?</div>
          <ul style={{
            margin: 0, paddingLeft: 18, color: '#bdb6b0', fontSize: 14, lineHeight: 1.7
          }}>
            <li>Sell tickets to your events with payouts to your bank</li>
            <li>Accept donations</li>
            <li>List merchandise for events</li>
            <li>Run paid promotions and ads on seveneightfive.com</li>
          </ul>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/dashboard/events" className="btn btn-ghost">Manage your events</a>
            <a href="/dashboard/advertise" className="btn btn-ghost">Advertise</a>
          </div>
        </div>
      </div>
    </>
  )
}
