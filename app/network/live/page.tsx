'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { NETWORK_BASE_STYLES } from '../_styles'

interface Summary {
  total_attendees: number
  total_connections: number
  top_connector_name: string | null
  top_connector_count: number | null
}
interface LeaderboardRow {
  person_id: string
  name: string
  connection_count: number
}
interface RoleCount {
  role_label: string
  connection_count: number
}
interface RecentConnection {
  person_a_name: string
  person_b_name: string
  type_label: string
  created_at: string
}
interface RolePersonCount {
  role_label: string
  person_count: number
}

export default function LiveDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [byRole, setByRole] = useState<RoleCount[]>([])
  const [recent, setRecent] = useState<RecentConnection[]>([])
  const [rolePersonCounts, setRolePersonCounts] = useState<RolePersonCount[]>([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    const [summaryRes, leaderboardRes, byRoleRes, recentRes, rolePersonCountsRes] = await Promise.all([
      supabase.rpc('network_summary').single(),
      supabase.rpc('connection_leaderboard'),
      supabase.rpc('connections_by_role'),
      supabase.rpc('recent_connections', { limit_count: 8 }),
      supabase.rpc('roles_person_counts'),
    ])
    if (summaryRes.data) setSummary(summaryRes.data as Summary)
    if (leaderboardRes.data) setLeaderboard((leaderboardRes.data as LeaderboardRow[]).slice(0, 5))
    if (byRoleRes.data) setByRole(byRoleRes.data as RoleCount[])
    if (recentRes.data) setRecent(recentRes.data as RecentConnection[])
    if (rolePersonCountsRes.data) setRolePersonCounts(rolePersonCountsRes.data as RolePersonCount[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()

    // Live updates — refetch whenever a check-in or connection happens.
    const channel = supabase
      .channel('network-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_people' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_people_roles' }, () => loadAll())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadAll])

  function timeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h ago`
  }

  // Each connection row links two people, so a person's average degree is
  // (2 × connections) ÷ attendees — not connections ÷ attendees, which
  // would undercount by half.
  const avgConnectionsPerPerson =
    summary && summary.total_attendees > 0
      ? ((summary.total_connections * 2) / summary.total_attendees).toFixed(1)
      : '0.0'

  return (
    <>
      <style>{NETWORK_BASE_STYLES}</style>
      <div className="net-topbar">
        <div className="net-topbar-inner">
          <a href="/network" className="net-back">← Network</a>
          <span className="net-page-label">Live Dashboard</span>
        </div>
      </div>

      <div className="net-page">

        <div className="net-header">
          <h1>The Room, Right Now</h1>
          <p>Updates live as people check in and log connections</p>
        </div>

        {loading ? (
          <div className="loading-state">Loading live stats…</div>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="num">{summary?.total_attendees ?? 0}</div>
                <div className="label">Attendees</div>
              </div>
              <div className="stat-card">
                <div className="num">{summary?.total_connections ?? 0}</div>
                <div className="label">Connections</div>
              </div>
              <div className="stat-card">
                <div className="num" style={{ fontSize: '1.3rem' }}>
                  {summary?.top_connector_name ?? '—'}
                </div>
                <div className="label">Top Connector{summary?.top_connector_count ? ` · ${summary.top_connector_count}` : ''}</div>
              </div>
              <div className="stat-card">
                <div className="num">{avgConnectionsPerPerson}</div>
                <div className="label">Avg Connections / Person</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <h3 style={sectionHeadingStyle}>Leaderboard</h3>
                {leaderboard.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 12px' }}>No connections logged yet.</div>
                ) : (
                  leaderboard.map((row, i) => (
                    <div
                      key={row.person_id}
                      className="card"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        <span style={{ color: 'var(--ink-faint)', marginRight: 8 }}>#{i + 1}</span>
                        {row.name}
                      </span>
                      <span className="chip">{row.connection_count}</span>
                    </div>
                  ))
                )}

                <h3 style={{ ...sectionHeadingStyle, marginTop: 24 }}>Connections by Role</h3>
                <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 10 }}>
                  Only roles with at least one logged connection show up here — a role stays off this
                  list until someone holding it connects with someone.
                </p>
                {byRole.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 12px' }}>No data yet.</div>
                ) : (
                  byRole.map((row) => (
                    <div
                      key={row.role_label}
                      className="card"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}
                    >
                      <span style={{ fontSize: 14 }}>{row.role_label}</span>
                      <span className="chip chip-neutral">{row.connection_count}</span>
                    </div>
                  ))
                )}
              </div>

              <div>
                <h3 style={sectionHeadingStyle}>New Connections Tonight</h3>
                {recent.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 12px' }}>Nothing logged yet.</div>
                ) : (
                  recent.map((r, i) => (
                    <div key={i} className="card" style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>
                        {r.person_a_name} ↔ {r.person_b_name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>
                        {r.type_label} · {timeAgo(r.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <h3 style={{ ...sectionHeadingStyle, marginTop: 36 }}>All Roles Tonight</h3>
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 10 }}>
              Every role currently in the system and how many checked-in people hold it — including
              roles nobody&apos;s picked yet.
            </p>
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'var(--off)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Role</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>People</th>
                  </tr>
                </thead>
                <tbody>
                  {rolePersonCounts.map((r, i) => (
                    <tr key={r.role_label} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px' }}>{r.role_label}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{r.person_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <a href="/network/map" className="btn-primary net-cta-block">
              See the Network Map →
            </a>
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
