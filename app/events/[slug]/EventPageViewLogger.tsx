'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

type Props = {
  slug: string
}

/**
 * EventPageViewLogger
 *
 * Increments view counters on the `event_analytics` table via the
 * `increment_event_view` Postgres function. Counter-only design — no raw
 * page_view rows are written, so this scales without bloating storage.
 *
 * Source detection order:
 *   1. ?ref=qr | facebook | twitter | linkedin | instagram | tiktok  (explicit tagging — most reliable)
 *   2. utm_source=...                                                 (standard UTM)
 *   3. document.referrer match against known social domains
 *   4. Empty referrer or internal referrer → 'direct'
 *
 * Note: most QR scanner apps strip the referrer, so QR codes generated for
 * this site MUST include `?ref=qr` in the URL to be attributed correctly.
 */
export default function EventPageViewLogger({ slug }: Props) {
  useEffect(() => {
    // Guard against double-fire (React strict mode in dev, fast remounts, etc.)
    const dedupeKey = `viewed:${slug}`
    if (typeof window !== 'undefined' && sessionStorage.getItem(dedupeKey)) return
    if (typeof window !== 'undefined') sessionStorage.setItem(dedupeKey, '1')

    const logPageView = async () => {
      try {
        const supabase = createClient()

        const { data: event } = await supabase
          .from('events')
          .select('id')
          .eq('slug', slug)
          .single()

        if (!event) return

        const source = getTrafficSource()

        await supabase.rpc('increment_event_view', {
          p_event_id: event.id,
          p_source: source,
        })
      } catch (err) {
        // Silent fail — analytics must never break the page render.
        console.debug('Page view logging error:', err)
      }
    }

    logPageView()
  }, [slug])

  return null
}

/**
 * Returns one of: 'qr' | 'social' | 'direct' | 'other'
 *
 * Bucket meanings for the dashboard:
 * - qr     → scanned a QR code we generated
 * - social → came from a known social platform (link click or share)
 * - direct → typed URL, bookmark, internal navigation, or unknown empty referrer
 * - other  → external referrer we don't recognize (search engine, blog, etc.)
 */
function getTrafficSource(): 'qr' | 'social' | 'direct' | 'other' {
  if (typeof window === 'undefined') return 'direct'

  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')?.toLowerCase()
  const utmSource = params.get('utm_source')?.toLowerCase()

  // 1. Explicit ?ref= tagging (we control these via QR + share buttons)
  if (ref === 'qr' || utmSource === 'qr') return 'qr'

  const socialTags = ['facebook', 'twitter', 'x', 'linkedin', 'instagram', 'tiktok', 'social']
  if (ref && socialTags.includes(ref)) return 'social'
  if (utmSource && socialTags.includes(utmSource)) return 'social'

  // 2. Referrer-based detection
  const referrer = (typeof document !== 'undefined' ? document.referrer : '').toLowerCase()
  if (!referrer) return 'direct'

  const socialDomains = [
    'facebook.com',
    'fb.com',
    'instagram.com',
    't.co',
    'twitter.com',
    'x.com',
    'linkedin.com',
    'tiktok.com',
    'reddit.com',
    'pinterest.com',
    'mastodon',
  ]
  if (socialDomains.some((d) => referrer.includes(d))) return 'social'

  // Internal referrer (came from another page on our own site) → direct
  if (typeof window !== 'undefined' && referrer.includes(window.location.hostname)) return 'direct'

  // Unknown external referrer (Google, news article, etc.)
  return 'other'
}
