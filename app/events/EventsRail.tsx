'use client'

// Desktop-only right rail for /events (shown ≥1200px, see EventsList CSS).
// Fills the space to the right of the list with the same three things the
// home page's CTA row carries: a sponsored ad, the "sell tickets" announcement,
// and the Weekender signup. Compact, vertical versions of each, since the
// full-width AdvertisementBanner / SignupForm don't fit a 300px column.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { handleSignup } from '../actions/signup'

type Ad = {
  id: string
  headline: string | null
  ad_copy: string | null
  ad_image_url: string | null
  button_text: string | null
  button_link: string | null
}

function RailAd() {
  const [ad, setAd] = useState<Ad | null>(null)
  const [loaded, setLoaded] = useState(false)
  const viewTracked = useRef(false)

  useEffect(() => {
    // Only fetch when the rail is actually on screen (≥1200px). Below that the
    // rail is display:none, and the inline AdvertisementBanner in the list is
    // the one that counts the view — this avoids double-counting impressions.
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1200px)').matches) {
      setLoaded(true)
      return
    }
    supabase
      .rpc('get_random_active_ad')
      .maybeSingle<Ad>()
      .then(({ data, error }) => {
        setLoaded(true)
        if (error || !data) return
        setAd(data)
        if (!viewTracked.current) {
          viewTracked.current = true
          supabase.rpc('increment_ad_view', { ad_id: data.id }).then(() => {})
        }
      })
  }, [])

  function handleClick() {
    if (!ad?.button_link) return
    supabase.rpc('increment_ad_click', { ad_id: ad.id }).then(() => {})
    window.open(ad.button_link, '_blank', 'noopener,noreferrer')
  }

  if (!loaded) return <div className="rail-ad rail-ad-skeleton" aria-hidden="true" />

  // No active paid ad → house ad for the $10/week product, so the slot
  // still sells itself instead of collapsing.
  if (!ad) {
    return (
      <Link href="/dashboard/advertise" className="rail-house-ad">
        <span className="rail-tag rail-tag-dark">Sponsored</span>
        <span className="rail-house-title">Your ad here</span>
        <span className="rail-house-copy">
          $10 a week puts your event, business or service in front of everyone browsing Topeka events.
          Locally owned businesses only.
        </span>
        <span className="rail-btn rail-btn-dark">Promote</span>
      </Link>
    )
  }

  return (
    <button type="button" className="rail-ad" onClick={handleClick}>
      {ad.ad_image_url && (
        <span className="rail-ad-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ad.ad_image_url} alt={ad.headline || 'Advertisement'} />
        </span>
      )}
      <span className="rail-ad-body">
        <span className="rail-tag">Sponsored</span>
        {ad.headline && <span className="rail-ad-title">{ad.headline}</span>}
        {ad.ad_copy && <span className="rail-ad-copy">{ad.ad_copy}</span>}
        {ad.button_text && <span className="rail-btn">{ad.button_text}</span>}
      </span>
    </button>
  )
}

function RailSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<{ success?: boolean; message?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [renderedAt] = useState(() => Date.now())

  async function clientAction(formData: FormData) {
    setLoading(true)
    setStatus(null)
    formData.append('subscribeEmail', 'true')
    formData.append('subscribeSMS', 'false')
    formData.append('renderedAt', String(renderedAt))
    const result = await handleSignup(formData)
    setLoading(false)
    if (result.success) {
      setStatus({ success: true, message: result.message })
      setEmail('')
    } else {
      setStatus({ success: false, message: result.error })
    }
  }

  return (
    <div className="rail-signup">
      <div className="rail-signup-title">Most emails suck. Ours don&rsquo;t.</div>
      <p className="rail-signup-copy">Get the 785 Weekender and stay in the know on upcoming events.</p>
      <form action={clientAction} className="rail-signup-form">
        <input
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          aria-label="Email address"
        />
        {/* Honeypot — same as SignupForm */}
        <div className="rail-hp" aria-hidden="true">
          <label htmlFor="rail-company">Company</label>
          <input type="text" id="rail-company" name="company" tabIndex={-1} autoComplete="off" />
        </div>
        <button type="submit" disabled={loading}>{loading ? '…' : 'Go'}</button>
      </form>
      {status && (
        <div className={`rail-signup-status ${status.success ? 'ok' : 'err'}`}>{status.message}</div>
      )}
    </div>
  )
}

export default function EventsRail() {
  return (
    <div className="rail-inner">
      <RailAd />

      <div className="rail-announce">
        <span className="rail-announce-legend">Announcement</span>
        <div className="rail-announce-title">Sell event tickets on 785</div>
        <p className="rail-announce-copy">
          Local ticketing that keeps money in Topeka and pays you out faster. Onboarding takes about 10 minutes.
        </p>
        <Link href="/shop" className="rail-link">Learn more</Link>
      </div>

      <RailSignup />
    </div>
  )
}
