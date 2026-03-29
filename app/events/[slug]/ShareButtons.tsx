'use client'

import { useState } from 'react'

type Props = {
  title: string
  description: string | null
}

export default function ShareButtons({ title, description }: Props) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const shareText = description
    ? `${title} — ${description.substring(0, 100)}${description.length > 100 ? '…' : ''}`
    : title

  async function handleShare() {
    const url = window.location.href
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url })
        return
      } catch {
        // User cancelled or not supported — fall through to dropdown
      }
    }
    setOpen(o => !o)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea')
      el.value = window.location.href
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    setOpen(false)
  }

  function shareToX() {
    const url = window.location.href
    const text = encodeURIComponent(`${title}\n${url}`)
    window.open(`https://x.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  function shareToFacebook() {
    const url = encodeURIComponent(window.location.href)
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  const itemBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '11px 16px',
    fontSize: '0.84rem',
    color: 'var(--ink)',
    textDecoration: 'none',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    width: '100%',
    cursor: 'pointer',
    fontFamily: 'var(--sans)',
    textAlign: 'left',
    transition: 'background 0.1s',
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleShare}
        aria-label="Share this event"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '13px 20px',
          borderRadius: '8px',
          fontFamily: 'var(--serif)',
          fontSize: '0.88rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          background: 'transparent',
          color: 'var(--ink)',
          border: '2px solid var(--border)',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ink)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <ShareIcon />
        Share
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            minWidth: '180px',
            overflow: 'hidden',
            zIndex: 100,
          }}
        >
          <button
            onClick={copyLink}
            style={{ ...itemBase, background: hovered === 'copy' ? 'var(--off)' : 'transparent' }}
            onMouseEnter={() => setHovered('copy')}
            onMouseLeave={() => setHovered(null)}
          >
            {copied ? <CheckIcon /> : <LinkIcon />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={shareToX}
            style={{ ...itemBase, background: hovered === 'x' ? 'var(--off)' : 'transparent' }}
            onMouseEnter={() => setHovered('x')}
            onMouseLeave={() => setHovered(null)}
          >
            <XIcon />
            Post on X
          </button>
          <button
            onClick={shareToFacebook}
            style={{ ...itemBase, borderBottom: 'none', background: hovered === 'fb' ? 'var(--off)' : 'transparent' }}
            onMouseEnter={() => setHovered('fb')}
            onMouseLeave={() => setHovered(null)}
          >
            <FacebookIcon />
            Share on Facebook
          </button>
        </div>
      )}
    </div>
  )
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2d7a2d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.633L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}
