'use client'

import { useState } from 'react'

type Props = {
  title: string
  text?: string
}

// Small client island just for the Web Share API (falls back to copying the
// URL to the clipboard on desktop browsers that don't support navigator.share).
// Kept separate from the server-rendered venue page so the rest of that page
// doesn't need "use client".
export default function VenueShareButton({ title, text }: Props) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
      } catch {
        // user cancelled the share sheet — no-op
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard blocked — nothing more we can do without a UI library
    }
  }

  return (
    <>
      <style>{`
        .venue-share-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.18);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #fff; position: relative;
          transition: background 0.15s;
        }
        .venue-share-btn:hover { background: rgba(0,0,0,0.5); }
        .venue-share-copied-tip {
          position: absolute; top: calc(100% + 8px); right: 0;
          background: #1a1814; color: #fff; font-size: 0.7rem; font-weight: 500;
          padding: 6px 10px; border-radius: 6px; white-space: nowrap;
        }
      `}</style>
      <button
        onClick={handleShare}
        aria-label="Share this venue"
        className="venue-share-btn"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 3.9M15.4 6.6l-6.8 3.9" />
        </svg>
        {copied && <span className="venue-share-copied-tip">Link copied</span>}
      </button>
    </>
  )
}
