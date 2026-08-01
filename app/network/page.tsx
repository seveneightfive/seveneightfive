'use client'

import { useState, useEffect } from 'react'
import { NETWORK_BASE_STYLES } from './_styles'

interface LinkTile {
  href: string
  title: string
  description: string
}

const BASE_LINKS: LinkTile[] = [
  { href: '/network/connect', title: 'Connect', description: "See who's here tonight and log how you know each other." },
  { href: '/network/me', title: 'My Music Connections', description: 'Your personal stats — connections, genres bridged, and your community rank.' },
  { href: '/network/live', title: 'Live Dashboard', description: 'Live totals, leaderboard, and activity as the room fills in.' },
  { href: '/network/map', title: 'Network Map', description: 'Everyone tonight, plotted as a connected graph.' },
  { href: '/network/insights', title: 'Network Insights', description: 'Which roles and genres are most interconnected across the scene.' },
]

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

  // Not checked in yet -> Check In is the first tile.
  // Already checked in -> replace it with a "Welcome back" tile pointing at
  // My Connections instead, so the same action isn't offered twice.
  const links: LinkTile[] = !checkedForMe
    ? BASE_LINKS
    : meName
      ? [
          {
            href: '/network/me',
            title: `Welcome back, ${meName.split(' ')[0]}`,
            description: "You're checked in. Tap here for your stats, or head straight to Connect.",
          },
          ...BASE_LINKS,
        ]
      : [CHECKIN_LINK, ...BASE_LINKS]

  return (
    <>
      <style>{NETWORK_BASE_STYLES}</style>
      <style>{`
        .net-hub {
          background: #0a0a0a;
          min-height: 100vh;
          padding: 64px 24px 80px;
        }
        .net-hub-inner { max-width: 900px; margin: 0 auto; }
        .net-hub-logo {
          font-family: var(--serif);
          font-size: 2.4rem;
          font-weight: 700;
          letter-spacing: 4px;
          color: #ffffff;
          text-align: center;
          margin-bottom: 4px;
        }
        .net-hub-logo span { color: var(--accent); }
        .net-hub-title {
          font-family: var(--serif);
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--gold);
          text-align: center;
          margin-bottom: 48px;
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
        .net-hub-welcome { border-color: var(--gold); }
        .net-hub-welcome .net-hub-card-title { color: var(--gold); }
        .net-hub-back {
          display: block;
          text-align: center;
          font-family: var(--serif);
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #6b6560;
          text-decoration: none;
          margin-top: 40px;
        }
        .net-hub-back:hover { color: #ffffff; }
      `}</style>

      <div className="net-hub">
        <div className="net-hub-inner">
          <div className="net-hub-logo">
            785<span>.</span>
          </div>
          <div className="net-hub-title">Topeka Music Network</div>

          <div className="net-hub-grid">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`net-hub-card${link.title.startsWith('Welcome back') ? ' net-hub-welcome' : ''}`}
              >
                <div className="net-hub-card-title">{link.title}</div>
                <div className="net-hub-card-desc">{link.description}</div>
              </a>
            ))}
          </div>

          <a href="/" className="net-hub-back">Back to seveneightfive.com</a>
        </div>
      </div>
    </>
  )
}
