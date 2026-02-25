'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ImageLightbox({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        style={{
          cursor: 'zoom-in',
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.75,
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, transparent 30%, rgba(26,24,20,0.95) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {/* ── EXPAND HINT ── */}
      <div style={{
        position: 'absolute',
        top: 12, right: 12,
        zIndex: 2,
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
    </>
  )
}