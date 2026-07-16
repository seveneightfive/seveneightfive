'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Ad = {
  id: string
  headline: string | null
  ad_copy: string | null
  content: string | null
  ad_image_url: string | null
  button_text: string | null
  button_link: string | null
  views: number
  clicks: number
}

/**
 * Sponsored ad banner.
 *
 * Layout: full width of its parent, always (no more 700px-collapsed /
 * full-expanded scroll-driven resizing). Image is a fixed 16:9 — full
 * width on its own on mobile, left column on desktop — with text in a
 * column to the right on desktop. On mobile it stacks: image on top,
 * text below (previously the image was hidden entirely on mobile;
 * now it always shows).
 *
 * Dropped from the previous version: the scroll-triggered "expand" resize
 * and parallax image shift. Those were built around the old flexible-height
 * card and don't have a clean equivalent once the image is a fixed aspect
 * ratio — a subtle fade/slide-in on first scroll into view replaces them.
 * Ping me if you want a fancier entrance/scroll effect added back in a way
 * that fits the fixed-aspect layout.
 */
export default function AdvertisementBanner() {
  const [ad, setAd] = useState<Ad | null>(null)
  const [revealed, setRevealed] = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)
  const viewTracked = useRef(false)

  // ── Fetch the active ad and track the view ───────────────────────────────
  useEffect(() => {
    async function fetchAd() {
      const { data, error } = await supabase
        .rpc('get_random_active_ad')
        .maybeSingle<Ad>()

      if (error) {
        console.error('[ad fetch] failed:', error)
        return
      }
      if (!data) return
      setAd(data)

      if (!viewTracked.current) {
        viewTracked.current = true
        supabase.rpc('increment_ad_view', { ad_id: data.id }).then(({ error }) => {
          if (error) console.error('[ad view] tracking failed:', error)
        })
      }
    }
    fetchAd()
  }, [])

  // ── Entry reveal (one-shot fade/slide-in when first scrolled into view) ──
  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const revealObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setRevealed(true)
            revealObs.unobserve(e.target)
          }
        }
      },
      { threshold: 0.15 }
    )
    revealObs.observe(el)

    return () => revealObs.disconnect()
  }, [ad])

  // ── Click tracking ───────────────────────────────────────────────────────
  function handleClick() {
    if (!ad?.button_link) return
    supabase.rpc('increment_ad_click', { ad_id: ad.id }).then(({ error }) => {
      if (error) console.error('[ad click] tracking failed:', error)
    })
    window.open(ad.button_link, '_blank', 'noopener,noreferrer')
  }

  if (!ad) return null

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      className={`grid w-full cursor-pointer grid-cols-1 overflow-hidden rounded-xl border border-white/10 bg-[#1a1814] shadow-[0_16px_50px_rgba(0,0,0,0.2)] transition-all duration-700 motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        ad.ad_image_url ? 'lg:grid-cols-2' : ''
      } ${revealed ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
    >
      {/* Image — fixed 16:9, full width. Left column on desktop, stacked
          on top on mobile (comes first in DOM either way). */}
      {ad.ad_image_url && (
        <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-[#2a1f1f] to-[#1a1814]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.ad_image_url}
            alt={ad.headline || 'Advertisement'}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}

      {/* Text side */}
      <div className="flex flex-col justify-center gap-3 px-6 py-7 sm:px-8 sm:py-8 lg:px-10">
        <span className="inline-flex w-fit items-center rounded-full bg-accent-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a1814]">
          Sponsored
        </span>

        {ad.headline && (
          <h3 className="font-display text-2xl font-bold uppercase leading-[1.05] tracking-tight text-white sm:text-3xl">
            {ad.headline}
          </h3>
        )}

        {ad.ad_copy && (
          <p className="text-sm font-light leading-relaxed text-white/75 sm:text-base">
            {ad.ad_copy}
          </p>
        )}

        {ad.content && (
          <p className="text-[13px] leading-relaxed text-white/50">{ad.content}</p>
        )}

        {ad.button_text && (
          <div className="mt-1">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-5 py-2.5 font-display text-[13px] font-semibold uppercase tracking-wide text-white">
              {ad.button_text}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
