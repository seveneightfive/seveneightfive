'use client'

import { NETWORK_BASE_STYLES } from './_styles'

const LINKS: { href: string; title: string; description: string }[] = [
  { href: '/network/checkin', title: 'Check In', description: "Tell us who you are — name, roles, and genre if you're a musician or DJ." },
  { href: '/network/connect', title: 'Connections', description: "See who's here tonight and log how you know each other." },
  { href: '/network/me', title: 'My Connections', description: 'Your personal stats — connections, genres bridged, and your community rank.' },
  { href: '/network/live', title: 'Live Dashboard', description: 'Live totals, leaderboard, and activity as the room fills in.' },
  { href: '/network/map', title: 'Network Map', description: 'Everyone tonight, plotted as a connected graph.' },
  { href: '/network/insights', title: 'Network Insights', description: 'Which roles and genres are most interconnected across the scene.' },
]

export default function NetworkHubPage() {
  return (
    <>
      <style>{NETWORK_BASE_STYLES}</style>
      <div className="net-page">
        <div className="net-topnav">
          <a href="/" className="net-back">← seveneightfive.com</a>
          <span className="net-page-label">Music Network</span>
        </div>

        <div className="net-header">
          <h1>Topeka Music Network</h1>
          <p>Mapping how the scene connects — one check-in at a time.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="card"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit', transition: 'border-color 0.15s' }}
            >
              <div
                style={{
                  fontFamily: 'var(--serif)', fontSize: '0.95rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--ink)', marginBottom: 6,
                }}
              >
                {link.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{link.description}</div>
            </a>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 560px) {
          .net-page > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
