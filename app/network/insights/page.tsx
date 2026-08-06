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

export default function NetworkInsightsPage() {
  const [rolePairs, setRolePairs] = useState<RolePair[]>([])
  const [genreBridges, setGenreBridges] = useState<GenreBridge[]>([])
  const [monthlyConnections, setMonthlyConnections] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [pairsRes, bridgesRes, monthlyRes] = await Promise.all([
        supabase.rpc('role_pair_matrix'),
        supabase.rpc('genre_bridge_scores'),
        supabase.rpc('connections_this_month'),
      ])
      if (pairsRes.data) setRolePairs(pairsRes.data as RolePair[])
      if (bridgesRes.data) setGenreBridges((bridgesRes.data as GenreBridge[]).slice(0, 8))
      if (monthlyRes.data !== null && monthlyRes.data !== undefined) setMonthlyConnections(Number(monthlyRes.data))
      setLoading(false)
    }
    load()
  }, [])

  const maxCount = Math.max(1, ...rolePairs.map((r) => r.connection_count))
  const significantRolePairs = rolePairs.filter((r) => r.connection_count >= 3)
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
              As this app runs across more events over time, this number tracks the community getting more
              interconnected month over month.
            </p>
            <div className="stat-grid" style={{ marginBottom: 32 }}>
              <div className="stat-card">
                <div className="num">{monthlyConnections}</div>
                <div className="label">New Connections This Month</div>
              </div>
            </div>

            <h3 style={{ ...sectionHeadingStyle, marginTop: 32 }}>Role Interconnection</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 14 }}>
              How often each pair of roles shows up on either side of a logged connection. Only showing pairs with
              3+ connections — longer bar = more connections between those two roles.
            </p>
            {significantRolePairs.length === 0 ? (
              <div className="empty-state" style={{ marginBottom: 32 }}>
                No role pair has 3+ connections yet.
              </div>
            ) : (
              <div style={{ marginBottom: 36 }}>
                {significantRolePairs.map((r, i) => (
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
