'use client'

import { useState, useEffect } from 'react'
import { NETWORK_BASE_STYLES } from './_styles'

interface LinkTile {
  href: string
  title: string
  description: string
}

const LOGO_URL = 'https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/785-Splash-512-White.png'

const CHECKIN_LINK: LinkTile = {
  href: '/network/checkin',
  title: 'Check In',
  description: "Tell us who you are — name, roles, and genre if you're a musician or DJ.",
}

export default function NetworkHubPage() {
  const [meName, setMeName] = useState<string | null>(null)
  const [checkedForMe, setCheckedForMe] = useState(false)

  useEffect(() => {
    setMeName(localStorage.getItem('network_person_name'))
    setCheckedForMe(true)
  }, [])

  const isCheckedIn = checkedForMe && !!meName
  const firstName = meName ? meName.split(' ')[0] : ''

  // "My Music Connections" tile's own label changes once someone's checked
  // in — no separate "welcome back" tile added, so the grid stays 5 tiles
  // instead of growing to 6.
  const links: LinkTile[] = [
    ...(!checkedForMe || isCheckedIn ? [] : [CHECKIN_LINK]),
    { href: '/network/connect', title: 'Connect', description: "See who's here tonight and log how you know each other." },
    {
      href: '/network/me',
      title: isCheckedIn ? `${firstName} · Music Connections` : 'My Music Connections',
      description: 'Your personal stats — connections, genres bridged, and your community rank.',
    },
    { href: '/network/live', title: 'Live Dashboard', description: 'Live totals, leaderboard, and activity as the room fills in.' },
    { href: '/network/map', title: 'Network Map', description: 'Everyone tonight, plotted as a connected graph.' },
    { href: '/network/insights', title: 'Network Insights', description: 'Which roles and genres are most interconnected across the scene.' },
  ]

  return (
    <>
      <style>{NETWORK_BASE_STYLES}</style>
      <style>{`
        .net-hub {
          background: #0a0a0a;
          min-height: 100vh;
          padding: 28px 24px 48px;
        }
        .net-hub-inner { max-width: 900px; margin: 0 auto; }
        .net-hub-title {
          font-family: var(--serif);
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--gold);
          text-align: center;
          margin-bottom: 28px;
        }
        .net-hub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 560px) { .net-hub-grid { grid-template-columns: 1fr; } }
        .net-hub-card {
          display: block;
          text-decoration: none;
          border: 1.5px solid #2a2a2a;
          background: #141414;
          border-radius: 12px;
          padding: 20px;
          transition: border-color 0.15s, background 0.15s;
        }
        .net-hub-card:hover { border-color: var(--accent); background: #1a1a1a; }
        .net-hub-card-title {
          font-family: var(--serif);
          font-size: 0.95rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #ffffff;
          margin-bottom: 6px;
        }
        .net-hub-card-desc { font-size: 13px; color: #9a948c; line-height: 1.5; }
        .net-hub-checked-in .net-hub-card-title { color: var(--gold); }
        .net-hub-footer {
          margin-top: 40px;
          padding-top: 28px;
          border-top: 1px solid #222;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
        }
        .net-hub-logo-link { display: block; }
        .net-hub-logo {
          display: block;
          height: 56px;
          width: auto;
        }
        .net-hub-footer-links {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .net-hub-live-music {
          font-family: var(--serif);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--gold);
          text-decoration: none;
        }
        .net-hub-live-music:hover { color: #fff; }
        .net-hub-back {
          font-family: var(--serif);
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #6b6560;
          text-decoration: none;
        }
        .net-hub-back:hover { color: #ffffff; }
      `}</style>

      <div className="net-hub">
        <div className="net-hub-inner">
          <div className="net-hub-title">Topeka Music Network</div>

          <div className="net-hub-grid">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`net-hub-card${link.href === '/network/me' && isCheckedIn ? ' net-hub-checked-in' : ''}`}
              >
                <div className="net-hub-card-title">{link.title}</div>
                <div className="net-hub-card-desc">{link.description}</div>
              </a>
            ))}
          </div>

          <div className="net-hub-footer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href="/" className="net-hub-logo-link" aria-label="seveneightfive.com home">
              <img src={LOGO_URL} alt="785" className="net-hub-logo" />
            </a>
            <div className="net-hub-footer-links">
              <a href="/live-music" className="net-hub-live-music">Live Music Events →</a>
              <a href="/" className="net-hub-back">Back to seveneightfive.com</a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
