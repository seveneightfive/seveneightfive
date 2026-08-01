'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { NETWORK_BASE_STYLES } from '../_styles'

interface Attendee {
  person_id: string
  name: string
  organization: string | null
  role_labels: string[]
  connected: boolean
  connection_type_slugs: string[]
}
interface LeaderboardRow {
  person_id: string
  name: string
  connection_count: number
}
interface GenreBridge {
  person_id: string
  name: string
  genres_bridged: number
}

export default function MyConnectionsPage() {
  const [meId, setMeId] = useState<string | null | undefined>(undefined)
  const [meName, setMeName] = useState('')
  const [loading, setLoading] = useState(true)

  const [connectedTo, setConnectedTo] = useState<Attendee[]>([])
  const [avgDegrees, setAvgDegrees] = useState<number | null>(null)
  const [rank, setRank] = useState<number | null>(null)
  const [totalRanked, setTotalRanked] = useState<number>(0)
  const [genresBridged, setGenresBridged] = useState<number>(0)
  const [furthest, setFurthest] = useState<{ names: string[]; depth: number } | null>(null)

  const loadStats = useCallback(async (id: string) => {
    setLoading(true)
    const [attendeesRes, avgRes, leaderboardRes, genreRes, furthestRes] = await Promise.all([
      supabase.rpc('get_attendees_with_connection_status', { me_id: id }),
      supabase.rpc('avg_degrees_from', { start_id: id }),
      supabase.rpc('connection_leaderboard'),
      supabase.rpc('genre_bridge_scores'),
      supabase.rpc('furthest_connections_from', { start_id: id }),
    ])

    if (attendeesRes.data) {
      const all = attendeesRes.data as Attendee[]
      setConnectedTo(all.filter((a) => a.connected))
    }
    if (avgRes.data !== null && avgRes.data !== undefined) {
      setAvgDegrees(Number(avgRes.data))
    } else {
      setAvgDegrees(null)
    }
    if (leaderboardRes.data) {
      const board = leaderboardRes.data as LeaderboardRow[]
      setTotalRanked(board.filter((b) => b.connection_count > 0).length)
      const idx = board.findIndex((b) => b.person_id === id)
      setRank(idx >= 0 && board[idx].connection_count > 0 ? idx + 1 : null)
    }
    if (genreRes.data) {
      const bridges = genreRes.data as GenreBridge[]
      const mine = bridges.find((b) => b.person_id === id)
      setGenresBridged(mine?.genres_bridged ?? 0)
    }
    if (furthestRes.data && (furthestRes.data as { name: string; depth: number }[]).length > 0) {
      const rows = furthestRes.data as { name: string; depth: number }[]
      setFurthest({ names: rows.map((r) => r.name), depth: rows[0].depth })
    } else {
      setFurthest(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const id = localStorage.getItem('network_person_id')
    const nm = localStorage.getItem('network_person_name')
    setMeId(id)
    setMeName(nm ?? '')
  }, [])

  useEffect(() => {
    if (meId) loadStats(meId)
  }, [meId, loadStats])

  // Tally connections by role — a person with multiple roles counts toward
  // each of them, matching how the roles were captured at check-in.
  const roleCounts: Record<string, number> = {}
  connectedTo.forEach((a) => {
    a.role_labels.forEach((label) => {
      roleCounts[label] = (roleCounts[label] ?? 0) + 1
    })
  })
  const roleCountEntries = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])
  const distinctRolesConnected = roleCountEntries.length

  return (
    <>
      <style>{NETWORK_BASE_STYLES}</style>
      <div className="net-topbar">
        <div className="net-topbar-inner">
          <a href="/network" className="net-back">← Network</a>
          <span className="net-page-label">My Music Connections</span>
        </div>
      </div>

      <div className="net-page">

        {meId === undefined ? null : !meId ? (
          <div className="empty-state">
            <strong style={{ display: 'block', marginBottom: 8, color: 'var(--ink-soft)' }}>
              You haven&apos;t checked in yet.
            </strong>
            <a
              href="/network/checkin"
              className="btn-primary"
              style={{ display: 'inline-block', marginTop: 12, textDecoration: 'none' }}
            >
              Check In →
            </a>
          </div>
        ) : loading ? (
          <div className="loading-state">Pulling your stats…</div>
        ) : (
          <>
            <div className="net-header">
              <h1>{meName || 'Your Night'}</h1>
              <p>Here&apos;s how you&apos;re showing up in tonight&apos;s network.</p>
            </div>

            <div className="stat-grid">
              <div className="stat-card">
                <div className="num">{connectedTo.length}</div>
                <div className="label">Connections</div>
              </div>
              <div className="stat-card">
                <div className="num">{genresBridged}</div>
                <div className="label">Genres Bridged</div>
              </div>
              <div className="stat-card">
                <div className="num">{distinctRolesConnected}</div>
                <div className="label">Roles Connected</div>
              </div>
              <div className="stat-card">
                <div className="num">{avgDegrees !== null ? avgDegrees.toFixed(1) : '—'}</div>
                <div className="label">Avg. Separation</div>
              </div>
              <div className="stat-card">
                <div className="num">{furthest ? furthest.depth : '—'}</div>
                <div className="label">
                  Furthest Reach{furthest ? ` · ${furthest.names[0]}${furthest.names.length > 1 ? ` +${furthest.names.length - 1}` : ''}` : ''}
                </div>
              </div>
            </div>

            {rank && (
              <div
                className="card"
                style={{
                  background: 'var(--accent-light)', borderColor: 'var(--accent)',
                  textAlign: 'center', fontFamily: 'var(--serif)', fontWeight: 700,
                  fontSize: '0.9rem', letterSpacing: '0.04em', textTransform: 'uppercase',
                  color: 'var(--accent)', marginBottom: 24,
                }}
              >
                ⭐ #{rank} Community Connector{totalRanked ? ` of ${totalRanked}` : ''}
              </div>
            )}

            <h3 style={sectionHeadingStyle}>Connected To</h3>
            {connectedTo.length === 0 ? (
              <div className="empty-state">
                No connections logged yet — head to{' '}
                <a href="/network/connect" style={{ color: 'var(--accent)' }}>Connect</a> to add some.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {roleCountEntries.map(([label, count]) => (
                    <span key={label} className="chip chip-neutral">
                      {count} {label}{count !== 1 ? 's' : ''}
                    </span>
                  ))}
                </div>
                {connectedTo.map((a) => (
                  <div
                    key={a.person_id}
                    className="card"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{a.role_labels.join(', ')}</div>
                    </div>
                    <span className="chip">{a.connection_type_slugs.length}</span>
                  </div>
                ))}
              </>
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
  marginBottom: 10,
}
