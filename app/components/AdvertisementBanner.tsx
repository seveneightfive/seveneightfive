'use client'
'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    async function fetchAd() {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('advertisements')
        .select('id, headline, ad_copy, content, ad_image_url, button_text, button_link, views, clicks')
        .eq('payment_status', 'paid')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        setAd(data)
        // Track view (fire and forget)
        supabase
          .from('advertisements')
          .update({ views: data.views + 1 })
          .eq('id', data.id)
      }
    }
    fetchAd()
  }, [])

  async function handleClick() {
    if (!ad?.button_link) return
    await supabase
      .from('advertisements')
      .update({ clicks: ad.clicks + 1 })
      .eq('id', ad.id)
    window.open(ad.button_link, '_blank', 'noopener,noreferrer')
  }

  if (!ad) return null

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#1a1814',
        display: 'grid',
        gridTemplateColumns: ad.ad_image_url ? '1fr 1fr' : '1fr',
        minHeight: 200,
        border: '1px solid rgba(255,255,255,0.06)',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.005)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <style>{`
        @media (max-width: 640px) {
          .ad-banner-grid { grid-template-columns: 1fr !important; }
          .ad-banner-img { max-height: 200px; }
        }
      `}</style>

      {/* Content side */}
      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
        {/* Sponsored badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
          <span style={{
            background: '#FFCE03', color: '#1a1814',
            fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', padding: '3px 9px', borderRadius: 100,
          }}>
            Sponsored
          </span>
        </div>

        {/* Headline */}
        {ad.headline && (
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(1.3rem, 3vw, 2rem)',
            fontWeight: 700, textTransform: 'uppercase', color: 'white',
            lineHeight: 1.05, letterSpacing: '-0.01em',
          }}>
            {ad.headline}
          </div>
        )}

        {/* Ad copy */}
        {ad.ad_copy && (
          <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', fontWeight: 300, lineHeight: 1.6 }}>
            {ad.ad_copy}
          </div>
        )}

        {/* Additional content */}
        {ad.content && (
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            {ad.content}
          </div>
        )}

        {/* CTA button */}
        {ad.button_text && (
          <div style={{ marginTop: 4 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#C80650', color: 'white',
              fontFamily: "'Oswald', sans-serif", fontSize: '0.82rem',
              fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '10px 20px', borderRadius: 6,
            }}>
              {ad.button_text}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
              </svg>
            </span>
          </div>
        )}
      </div>

      {/* Image side */}
      {ad.ad_image_url && (
        <div style={{ position: 'relative', overflow: 'hidden', minHeight: 200 }}>
          <img
            src={ad.ad_image_url}
            alt={ad.headline || 'Advertisement'}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}
    </div>
  )
}
