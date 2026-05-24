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

export default function AdvertisementBanner() {
  const [ad, setAd] = useState<Ad | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [parallaxY, setParallaxY] = useState(0)

  const cardRef = useRef<HTMLDivElement>(null)
  const viewTracked = useRef(false)

  // ── Fetch the active ad and track the view ───────────────────────────────
  useEffect(() => {
  async function fetchAd() {
    const { data, error } = await supabase
      .rpc('get_random_active_ad')
      .maybeSingle()

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
  
  // ── Scroll observers + parallax ──────────────────────────────────────────
  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 1. Entry reveal (one-shot, fires when the ad first becomes 15% visible)
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

    // 2. Expand-on-approach. Triggers early — as soon as the ad has 35%
    //    intersection with the middle 80% of the viewport.
    const expandObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          setExpanded(e.intersectionRatio > 0.35)
        }
      },
      {
        rootMargin: '-10% 0px -10% 0px',
        threshold: [0, 0.15, 0.35, 0.6, 0.85],
      }
    )
    expandObs.observe(el)

    // 3. Parallax: image translates inversely to scroll progress.
    //    Skipped entirely if the user prefers reduced motion.
    let scrollListener: (() => void) | null = null
    if (!prefersReducedMotion) {
      let ticking = false
      const PARALLAX_STRENGTH = 60 // px of travel from one end to the other

      const updateParallax = () => {
        const rect = el.getBoundingClientRect()
        const viewportH = window.innerHeight || document.documentElement.clientHeight
        const cardCenter = rect.top + rect.height / 2
        const viewportCenter = viewportH / 2

        // -1 = card center above viewport center, +1 = below
        const progress = (cardCenter - viewportCenter) / (viewportH / 2)
        const clamped = Math.max(-1, Math.min(1, progress))

        // Invert so image rises as user scrolls down
        setParallaxY(-clamped * PARALLAX_STRENGTH)
        ticking = false
      }

      scrollListener = () => {
        if (!ticking) {
          window.requestAnimationFrame(updateParallax)
          ticking = true
        }
      }

      window.addEventListener('scroll', scrollListener, { passive: true })
      window.addEventListener('resize', scrollListener, { passive: true })
      updateParallax()
    }

    return () => {
      revealObs.disconnect()
      expandObs.disconnect()
      if (scrollListener) {
        window.removeEventListener('scroll', scrollListener)
        window.removeEventListener('resize', scrollListener)
      }
    }
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

  // Animation state derived from observer flags
  const contentItemBase: React.CSSProperties = {
    opacity: revealed ? 1 : 0,
    transform: revealed ? 'translateY(0)' : 'translateY(12px)',
    transition: 'opacity 0.55s ease, transform 0.55s ease',
  }

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#1a1814',
        display: 'grid',
        gridTemplateColumns: ad.ad_image_url ? '1fr 1fr' : '1fr',
        // Expand: card grows from ~600px wide / 220px tall to full-width / 400px tall
        maxWidth: expanded ? '100%' : 700,
        minHeight: expanded ? 400 : 220,
        marginLeft: 'auto',
        marginRight: 'auto',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: expanded
          ? '0 24px 70px rgba(0,0,0,0.28)'
          : '0 0 0 rgba(0,0,0,0)',
        transition:
          'max-width 0.7s cubic-bezier(0.22, 1, 0.36, 1), min-height 0.7s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.7s ease',
        willChange: 'max-width, min-height',
      }}
    >
      <style>{`
        @media (max-width: 640px) {
          .ad-banner-card { grid-template-columns: 1fr !important; }
          .ad-banner-img-wrap { display: none !important; }
        }
      `}</style>

      {/* Content side */}
      <div
        style={{
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 12,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            width: 'fit-content',
            ...contentItemBase,
            transitionDelay: '0.1s',
          }}
        >
          <span
            style={{
              background: '#FFCE03',
              color: '#1a1814',
              fontSize: '0.58rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              padding: '3px 9px',
              borderRadius: 100,
            }}
          >
            Sponsored
          </span>
        </div>

        {ad.headline && (
          <div
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: expanded ? 'clamp(2rem, 4vw, 3rem)' : 'clamp(1.3rem, 3vw, 2rem)',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'white',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              ...contentItemBase,
              transitionDelay: '0.2s',
              transition:
                'opacity 0.55s ease 0.2s, transform 0.55s ease 0.2s, font-size 0.7s ease',
            }}
          >
            {ad.headline}
          </div>
        )}

        {ad.ad_copy && (
          <div
            style={{
              fontSize: '0.9rem',
              color: 'rgba(255,255,255,0.75)',
              fontWeight: 300,
              lineHeight: 1.6,
              ...contentItemBase,
              transitionDelay: '0.3s',
            }}
          >
            {ad.ad_copy}
          </div>
        )}

        {ad.content && (
          <div
            style={{
              fontSize: '0.82rem',
              color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.6,
              maxHeight: expanded ? 80 : 0,
              opacity: expanded ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.6s ease 0.35s, opacity 0.6s ease 0.4s',
            }}
          >
            {ad.content}
          </div>
        )}

        {ad.button_text && (
          <div style={{ marginTop: 4, ...contentItemBase, transitionDelay: '0.4s' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#C80650',
                color: 'white',
                fontFamily: "'Oswald', sans-serif",
                fontSize: '0.82rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '10px 20px',
                borderRadius: 6,
              }}
            >
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

      {/* Image side — oversized container with parallax shift */}
      {ad.ad_image_url && (
        <div
          className="ad-banner-img-wrap"
          style={{
            position: 'relative',
            overflow: 'hidden',
            minHeight: 220,
            background: 'linear-gradient(135deg, #2a1f1f 0%, #1a1814 100%)',
          }}
        >
          <img
            src={ad.ad_image_url}
            alt={ad.headline || 'Advertisement'}
            style={{
              position: 'absolute',
              top: '-20%',
              left: 0,
              width: '100%',
              height: '140%',
              objectFit: 'cover',
              transform: expanded
                ? `scale(1) translate3d(0, ${parallaxY.toFixed(1)}px, 0)`
                : `scale(1.06) translate3d(0, 0, 0)`,
              opacity: expanded ? 1 : 0.9,
              transition: 'transform 0.7s ease, opacity 0.6s ease',
              willChange: 'transform',
            }}
          />
        </div>
      )}
    </div>
  )
}
