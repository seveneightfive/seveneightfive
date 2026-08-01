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
interface GenreDetail {
  genre: string
  connection_count: number
}

export default function NetworkInsightsPage() {
  const [rolePairs, setRolePairs] = useState<RolePair[]>([])
  const [genreBridges, setGenreBridges] = useState<GenreBridge[]>([])
  const [loading, setLoading] = useState(true)

  // Expand-on-click state for the Genre Bridges list. Detail is fetched
  // once per person and cached in genreDetails — clicking a name again
  // just re-toggles the dropdown, no refetch.
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [genreDetails, setGenreDetails] = useState<Record<string, GenreDetail[]>>({})
  const [detailLoading, setDetailLoading] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [pairsRes, bridgesRes] = await Promise.all([
        supabase.rpc('role_pair_matrix'),
        supabase.rpc('genre_bridge_scores'),
      ])
      if (pairsRes.data) setRolePairs(pairsRes.data as RolePair[])
      if (bridgesRes.data) setGenreBridges((bridgesRes.data as GenreBridge[]).slice(0, 8))
      setLoading(false)
    }
    load()
  }, [])

  async function toggleBridgeRow(personId: string) {
    if (expandedPersonId === personId) {
      setExpandedPersonId(null)
      return
    }
    setExpandedPersonId(personId)
    if (!genreDetails[personId]) {
      setDetailLoading(personId)
      const { data } = await supabase.rpc('genre_bridge_detail', { p_person_id: personId })
      setGenreDetails((prev) => ({ ...prev, [personId]: (data as GenreDetail[]) ?? [] }))
      setDetailLoading(null)
    }
  }

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
            <h3 style={sectionHeadingStyle}>Role Interconnection</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 14 }}>
              How often each pair of roles shows up on either side of a logged connection. Longer bar = more
              connections between two roles.
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
              How many distinct genres each person&apos;s direct connections span. Tap a name to see which genres.
            </p>
            {genreBridges.length === 0 ? (
              <div className="empty-state">No genre data yet — this only counts musicians &amp; DJs.</div>
            ) : (
              genreBridges.map((g) => {
                const isExpanded = expandedPersonId === g.person_id
                const details = genreDetails[g.person_id]
                const isDetailLoading = detailLoading === g.person_id

                return (
                  <div key={g.person_id} className="card" style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button
                        onClick={() => toggleBridgeRow(g.person_id)}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6, font: 'inherit', color: 'inherit',
                        }}
                        aria-expanded={isExpanded}
                      >
                        <span
                          style={{
                            fontSize: 11, color: 'var(--ink-faint)',
                            transform: isExpanded ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.15s', display: 'inline-block',
                          }}
                        >
                          ▶
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 500, textDecoration: 'underline', textDecorationColor: 'var(--border)' }}>
                          {g.name}
                        </span>
                      </button>
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

                    {isExpanded && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        {isDetailLoading ? (
                          <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Loading genres…</p>
                        ) : !details || details.length === 0 ? (
                          <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No genre detail found.</p>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {details.map((d) => (
                              <span key={d.genre} className="chip chip-neutral">
                                {d.genre} · {d.connection_count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
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
