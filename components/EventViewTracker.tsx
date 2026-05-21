'use client'

import { useEffect } from 'react'

type Props = { eventId: string }

export default function EventViewTracker({ eventId }: Props) {
  useEffect(() => {
    // Avoid double-fire on React strict mode in dev / quick remounts
    const key = `viewed:${eventId}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')

    const source = detectSource()

    fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, source }),
      keepalive: true,
    }).catch(() => {
      // Silent fail — analytics should never break the page
    })
  }, [eventId])

  return null
}

function detectSource(): 'qr' | 'social' | 'direct' | 'other' {
  if (typeof window === 'undefined') return 'other'

  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')?.toLowerCase()
  const utmSource = params.get('utm_source')?.toLowerCase()

  // Explicit tagging wins
  if (ref === 'qr' || utmSource === 'qr') return 'qr'
  if (
    ref && ['facebook', 'twitter', 'x', 'linkedin', 'instagram', 'tiktok', 'social'].includes(ref)
  ) return 'social'
  if (
    utmSource &&
    ['facebook', 'twitter', 'x', 'linkedin', 'instagram', 'tiktok'].includes(utmSource)
  ) return 'social'

  // Fall back to referrer
  const referrer = document.referrer.toLowerCase()
  if (!referrer) return 'direct'

  const socialDomains = [
    'facebook.com', 'fb.com', 'instagram.com', 't.co', 'twitter.com',
    'x.com', 'linkedin.com', 'tiktok.com', 'reddit.com', 'pinterest.com',
  ]
  if (socialDomains.some((d) => referrer.includes(d))) return 'social'

  // Internal referrer = direct (came from another page on your site)
  if (referrer.includes(window.location.hostname)) return 'direct'

  return 'other'
}
