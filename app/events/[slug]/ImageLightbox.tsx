'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Standalone clickable image with a fullscreen lightbox on click.
 *
 * Previously this rendered position: absolute; inset: 0 with a dark
 * gradient fade, built for the old full-bleed hero banner where white
 * title text sat on top of it. Now that the image stands on its own next
 * to the details column (nothing overlaid on top of it), both of those
 * are gone:
 *   - No more position: absolute — it just fills its parent normally, so
 *     the parent (.event-image-wrap) controls the size/aspect ratio via
 *     ordinary CSS instead of needing to be a positioned ancestor.
 *   - No more opacity/gradient darkening — the photo shows at full
 *     brightness since there's no text it needs to stay legible under.
 */
export default function ImageLightbox({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        style={{
          cursor: 'zoom-in',
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />

      {/* ── EXPAND HINT ── */}
      <div style={{
        position: 'absolute',
        top: 12, right: 12,
        background: 'rgba(0,0,0,0.4)',
        color: 'white',
        fontSize: '0.65rem',
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '4px 10px',
        borderRadius: 100,
        pointerEvents: 'none',
      }}>⊕ Expand</div>

      {mounted && open && createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.96)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out',
          }}
        >
          <button
            onClick={e => { e.stopPropagation(); setOpen(false) }}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,0.2)', border: 'none',
              color: 'white', fontSize: '1.2rem',
              width: 44, height: 44, borderRadius: '50%',
              cursor: 'pointer', zIndex: 100000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
          <img
            src={src}
            alt={alt}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 4,
              display: 'block',
            }}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
