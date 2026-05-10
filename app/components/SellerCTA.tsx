'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseBrowser'

/**
 * SellerCTA — drop-in card that nudges users toward Stripe Connect.
 *
 * Renders nothing if the user already has charges/payouts enabled.
 * Shows different copy for: never connected, in-progress, restricted.
 *
 * Use it on:
 *   - /dashboard (top of page) — soft nudge for new sellers
 *   - /dashboard/events/new — gate before they try to list a paid ticket
 *   - end of /onboarding — optional "are you a seller?" upsell
 */
export default function SellerCTA({
  variant = 'card',
}: {
  variant?: 'card' | 'banner'
}) {
  const supabase = createClient()
  const [status, setStatus] = useState<
    'loading' | 'enabled' | 'pending' | 'restricted' | 'none'
  >('loading')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('none'); return }
      const { data } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_account_status')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      if (!data?.stripe_account_id) {
        setStatus('none')
      } else if (data.stripe_account_status === 'enabled') {
        setStatus('enabled')
      } else if (data.stripe_account_status === 'restricted') {
        setStatus('restricted')
      } else {
        setStatus('pending')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (status === 'loading' || status === 'enabled') return null

  const copy =
    status === 'restricted'
      ? {
          title: 'Finish your Stripe setup',
          body: 'Stripe needs a bit more info before payouts can start.',
          cta: 'Continue setup',
        }
      : status === 'pending'
        ? {
            title: 'Pick up where you left off',
            body: 'You started Stripe onboarding — finish to start selling.',
            cta: 'Resume onboarding',
          }
        : {
            title: 'Want to sell tickets?',
            body: 'Connect Stripe in about 3 minutes to list paid events, take donations, and get paid weekly.',
            cta: 'Connect Stripe',
          }

  const accent = status === 'restricted' ? '#e86b1c' : '#ffce03'

  if (variant === 'banner') {
    return (
      <Link
        href="/dashboard/settings/payouts"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          borderRadius: 8,
          background: '#26221d',
          border: `1px solid ${accent}55`,
          color: '#fafafa',
          textDecoration: 'none',
          fontSize: 14,
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0,
        }} />
        <span style={{ flex: 1 }}>
          <strong>{copy.title}.</strong>{' '}
          <span style={{ color: '#bdb6b0' }}>{copy.body}</span>
        </span>
        <span style={{ color: accent, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {copy.cta} →
        </span>
      </Link>
    )
  }

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 12,
        background: '#26221d',
        border: `1px solid ${accent}55`,
        marginBottom: 20,
      }}
    >
      <div style={{
        color: accent, fontSize: 12, textTransform: 'uppercase',
        letterSpacing: 1.2, fontWeight: 700, marginBottom: 6,
      }}>
        {status === 'none' ? 'Sellers' : 'Action needed'}
      </div>
      <div style={{ color: '#fafafa', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        {copy.title}
      </div>
      <div style={{ color: '#bdb6b0', fontSize: 14, marginBottom: 14, lineHeight: 1.5 }}>
        {copy.body}
      </div>
      <Link
        href="/dashboard/settings/payouts"
        style={{
          display: 'inline-block',
          padding: '10px 16px',
          borderRadius: 8,
          background: accent,
          color: '#1a1814',
          fontWeight: 600,
          textDecoration: 'none',
          fontSize: 14,
        }}
      >
        {copy.cta} →
      </Link>
    </div>
  )
}
