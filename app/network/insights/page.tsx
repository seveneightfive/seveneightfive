'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { NETWORK_BASE_STYLES } from '../_styles'

interface RolePair {
  role_a: string
  role_b: string
  connection_count: number
}
interface GenreBridge {
  person_id: string
  name: string
  genres_bridged: number
}
interface GrowthPoint {
  bucket: string
  new_connections: number
  cumulative_connections: number
}

export default function NetworkInsightsPage() {
  const [rolePairs, setRolePairs] = useState<RolePair[]>([])
  const [genreBridges, setGenreBridges] = useState<GenreBridge[]>([])
  const [growth, setGrowth] = useState<GrowthPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [pairsRes, bridgesRes, growthRes] = await Promise.all([
        supabase.rpc('role_pair_matrix'),
        supabase.rpc('genre_bridge_scores'),
        supabase.rpc('connections_growth'),
      ])
      if (pairsRes.data) setRolePairs(pairsRes.data as RolePair[])
      if (bridgesRes.data) setGenreBridges((bridgesRes.data as GenreBridge[]).slice(0, 8))
      if (growthRes.data) setGrowth(growthRes.data as GrowthPoint[])
      setLoading(false)
    }
    load()
  }, [])

  const maxCount = Math.max(1, ...rolePairs.map((r) => r.connection_count))
  const maxBridge = Math.max(1, ...genreBridges.map((g) => g.genres_bridged))

  return (
    <>
      <style>{NETWORK_BASE_STYLES}</style>
      <div className="net-topbar">
        <div className="net-topbar-inner">
          <a href="/network" className="net-back">← Network</a>
          <span className="net-page-label">Network Insights</span>
        </div>
      </div>

      <div className="net-page">

        <div className="net-header">
          <h1>Which Parts of the Scene Connect?</h1>
          <p>
            Which roles in the Topeka music ecosystem are most interconnected, and who&apos;s bridging the most
            genres tonight.
          </p>
        </div>

        {loading ? (
          <div className="loading-state">Crunching the connections…</div>
        ) : (
          <>
            <h3 style={sectionHeadingStyle}>Network Growth</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 14 }}>
              Total connections logged, hour by hour. As you run more nights like this, this same view will show
              the community getting more interconnected over months and years.
            </p>
            {growth.length === 0 ? (
              <div className="empty-state" style={{ marginBottom: 32 }}>No connections logged yet.</div>
            ) : (
              <GrowthChart data={growth} />
            )}

            <h3 style={{ ...sectionHeadingStyle, marginTop: 32 }}>Role Interconnection</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 14 }}>
              How often each pair of roles shows up on either side of a logged connection. Longer bar = more
              connections between those two roles.
            </p>
            {rolePairs.length === 0 ? (
              <div className="empty-state" style={{ marginBottom: 32 }}>No connections logged yet.</div>
            ) : (
              <div style={{ marginBottom: 36 }}>
                {rolePairs.map((r, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>
                        {r.role_a}
                        {r.role_a !== r.role_b && <> ↔ {r.role_b}</>}
                        {r.role_a === r.role_b && <> (within role)</>}
                      </span>
                      <span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>{r.connection_count}</span>
                    </div>
                    <div style={{ background: 'var(--off)', borderRadius: 100, height: 8, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(r.connection_count / maxCount) * 100}%`,
                          background: 'var(--accent)',
                          height: '100%',
                          borderRadius: 100,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 style={sectionHeadingStyle}>Genre Bridges</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 14 }}>
              How many distinct genres each person&apos;s direct connections span — the people pulling different
              corners of the scene together.
            </p>
            {genreBridges.length === 0 ? (
              <div className="empty-state">No genre data yet — this only counts musicians &amp; DJs.</div>
            ) : (
              genreBridges.map((g) => (
                <div
                  key={g.person_id}
                  className="card"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{g.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 140px' }}>
                    <div style={{ background: 'var(--off)', borderRadius: 100, height: 6, flex: 1, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(g.genres_bridged / maxBridge) * 100}%`,
                          background: 'var(--gold)',
                          height: '100%',
                          borderRadius: 100,
                        }}
                      />
                    </div>
                    <span className="chip chip-neutral">{g.genres_bridged}</span>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </>
  )
}

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontSize: '0.8rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--ink-soft)',
  marginBottom: 6,
}

function GrowthChart({ data }: { data: GrowthPoint[] }) {
  const width = 800
  const height = 220
  const padding = { top: 16, right: 16, bottom: 28, left: 16 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const maxVal = Math.max(1, ...data.map((d) => d.cumulative_connections))
  const points = data.map((d, i) => {
    const x = padding.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
    const y = padding.top + plotH - (d.cumulative_connections / maxVal) * plotH
    return { x, y, d }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + plotH} L ${points[0].x} ${padding.top + plotH} Z`

  function formatBucket(iso: string) {
    return new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric' })
  }

  return (
    <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: '16px 8px', marginBottom: 32 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" style={{ display: 'block' }}>
        <path d={areaPath} fill="var(--accent-light)" stroke="none" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--accent)" />
        ))}
        {points.map((p, i) => (
          (i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2)) && (
            <text key={`label-${i}`} x={p.x} y={height - 8} textAnchor="middle" fontSize={10} fill="#8a847d">
              {formatBucket(p.d.bucket)}
            </text>
          )
        ))}
        <text x={points[points.length - 1].x} y={points[points.length - 1].y - 10} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--accent)">
          {points[points.length - 1].d.cumulative_connections}
        </text>
      </svg>
    </div>
  )
}
