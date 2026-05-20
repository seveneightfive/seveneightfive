'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

type Props = {
  slug: string
}

export default function EventPageViewLogger({ slug }: Props) {
  useEffect(() => {
    const logPageView = async () => {
      try {
        const supabase = createClient()

        // Get event ID by slug
        const { data: event } = await supabase
          .from('events')
          .select('id')
          .eq('slug', slug)
          .single()

        if (!event) return

        // Detect traffic source from referrer
        const source = getTrafficSource()

        // Log the page view with source attribution
        await supabase.from('event_page_views').insert([
          {
            event_id: event.id,
            source,
          },
        ])
      } catch (err) {
        // Silently fail analytics logging shouldn't break the page
        console.debug('Page view logging error:', err)
      }
    }

    logPageView()
  }, [slug])

  return null
}

/**
 * Detect traffic source from document.referrer
 *
 * Returns:
 * - 'qr': came from QR code scanner
 * - 'social': came from Facebook, Twitter, or LinkedIn
 * - 'direct': direct visit or unknown source
 */
function getTrafficSource(): 'qr' | 'social' | 'direct' {
  if (typeof document === 'undefined') return 'direct'

  const referrer = document.referrer.toLowerCase()

  // Social platforms
  if (referrer.includes('facebook.com')) return 'social'
  if (referrer.includes('twitter.com') || referrer.includes('x.com')) return 'social'
  if (referrer.includes('linkedin.com')) return 'social'
  if (referrer.includes('instagram.com')) return 'social'
  if (referrer.includes('tiktok.com')) return 'social'
  if (referrer.includes('reddit.com')) return 'social'
  if (referrer.includes('pinterest.com')) return 'social'
  if (referrer.includes('mastodon')) return 'social'

  // QR scanner apps and services
  if (referrer.includes('qr.io') || referrer.includes('qrcode')) return 'qr'
  if (referrer.includes('qr-server')) return 'qr'
  if (referrer.includes('qr-scanner')) return 'qr'

  // Everything else is direct (including email clicks, bookmarks, typed URLs)
  return 'direct'
}
