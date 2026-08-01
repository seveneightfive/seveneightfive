'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { NETWORK_BASE_STYLES } from '../_styles'

interface PersonNode {
  id: string
  name: string
  roleSlug: string | null
  roleLabel: string | null
}
type Edge = [string, string]

const ROLE_COLORS: Record<string, string> = {
  musician: '#c80650',
  ensemble_member: '#c80650',
  dj: '#8a3ffc',
  event_organizer: '#0f62fe',
  venue_owner: '#0e8a45',
  photographer: '#ff832b',
  journalist: '#a2673e',
  record_store: '#da1e28',
  sound_engineer: '#6b6560',
  educator: '#1192e8',
  lyricist_poet: '#9f1853',
  instrument_repair: '#005d5d',
}
const DEFAULT_COLOR = '#8a847d'

// A small, dependency-free force-directed layout (Fruchterman–Reingold).
// Runs once over a fixed number of iterations rather than animating forever —
// simpler and more predictable for a one-night event's graph size.
function computeLayout(nodeIds: string[], edges: Edge[], width: number, height: number, iterations = 300) {
  const k = (Math.sqrt((width * height) / Math.max(nodeIds.length, 1))) * 0.9
  const pos: Record<string, { x: number; y: number }> = {}

  nodeIds.forEach((id, i) => {
    const angle = (i / Math.max(nodeIds.length, 1)) * 2 * Math.PI
    pos[id] = {
      x: width / 2 + Math.cos(angle) * Math.min(width, height) * 0.3,
      y: height / 2 + Math.sin(angle) * Math.min(width, height) * 0.3,
    }
  })

  for (let iter = 0; iter < iterations; iter++) {
    const disp: Record<string, { x: number; y: number }> = {}
    nodeIds.forEach((id) => (disp[id] = { x: 0, y: 0 }))

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = nodeIds[i]
        const b = nodeIds[j]
        const dx = pos[a].x - pos[b].x
        const dy = pos[a].y - pos[b].y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
        const force = (k * k) / dist
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        disp[a].x += fx
        disp[a].y += fy
        disp[b].x -= fx
        disp[b].y -= fy
      }
    }

    edges.forEach(([a, b]) => {
      if (!pos[a] || !pos[b]) return
      const dx = pos[a].x - pos[b].x
      const dy = pos[a].y - pos[b].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
      const force = (dist * dist) / k
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      disp[a].x -= fx
      disp[a].y -= fy
      disp[b].x += fx
      disp[b].y += fy
    })

    const temp = (width / 10) * (1 - iter / iterations)
    nodeIds.forEach((id) => {
      const dx = disp[id].x
      const dy = disp[id].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
      pos[id].x += (dx / dist) * Math.min(dist, temp)
      pos[id].y += (dy / dist) * Math.min(dist, temp)
      pos[id].x = Math.min(width - 40, Math.max(40, pos[id].x))
      pos[id].y = Math.min(height - 40, Math.max(40, pos[id].y))
    })
  }

  return pos
}

export default function NetworkMapPage() {
  const [nodes, setNodes] = useState<PersonNode[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const width = 800
  const height = 600

  useEffect(() => {
    async function load() {
      const [peopleRes, rolesRes, connectionsRes] = await Promise.all([
        supabase.from('event_people').select('id, name'),
        supabase.from('event_people_roles').select('person_id, roles(slug, label)'),
        supabase.from('connections').select('person_a, person_b'),
      ])

      const roleByPerson: Record<string, { slug: string; label: string }> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(rolesRes.data as any[] ?? []).forEach((row) => {
        if (!roleByPerson[row.person_id] && row.roles) {
          roleByPerson[row.person_id] = { slug: row.roles.slug, label: row.roles.label }
        }
      })

      const people: PersonNode[] = (peopleRes.data ?? []).map((p: { id: string; name: string }) => ({
        id: p.id,
        name: p.name,
        roleSlug: roleByPerson[p.id]?.slug ?? null,
        roleLabel: roleByPerson[p.id]?.label ?? null,
      }))

      // Dedupe edges — a pair can have multiple connection-type rows.
      const seen = new Set<string>()
      const dedupedEdges: Edge[] = []
      ;(connectionsRes.data ?? []).forEach((c: { person_a: string; person_b: string }) => {
        const key = `${c.person_a}|${c.person_b}`
        if (!seen.has(key)) {
          seen.add(key)
          dedupedEdges.push([c.person_a, c.person_b])
        }
      })

      setNodes(people)
      setEdges(dedupedEdges)
      setLoading(false)
    }
    load()
  }, [])

  const positions = useMemo(() => {
    if (nodes.length === 0) return {}
    return computeLayout(nodes.map((n) => n.id), edges, width, height)
  }, [nodes, edges])

  const usedRoles = useMemo(() => {
    const set = new Map<string, string>()
    nodes.forEach((n) => {
      if (n.roleSlug && n.roleLabel) set.set(n.roleSlug, n.roleLabel)
    })
    return Array.from(set.entries())
  }, [nodes])

  return (
    <>
      <style>{NETWORK_BASE_STYLES}</style>
      <div className="net-topbar">
        <div className="net-topbar-inner">
          <a href="/network" className="net-back">← Network</a>
          <span className="net-page-label">Network Map</span>
        </div>
      </div>

      <div className="net-page" style={{ maxWidth: 900 }}>

        <div className="net-header">
          <h1>The Whole Room, Mapped</h1>
          <p>Every dot is a person tonight; every line is a logged connection. Colored by primary role.</p>
        </div>

        {loading ? (
          <div className="loading-state">Building the map…</div>
        ) : nodes.length === 0 ? (
          <div className="empty-state">No one has checked in yet.</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              {usedRoles.map(([slug, label]) => (
                <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-soft)' }}>
                  <span
                    style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: ROLE_COLORS[slug] ?? DEFAULT_COLOR, display: 'inline-block',
                    }}
                  />
                  {label}
                </div>
              ))}
            </div>

            <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" style={{ display: 'block', background: '#fff' }}>
                {edges.map(([a, b], i) => {
                  const pa = positions[a]
                  const pb = positions[b]
                  if (!pa || !pb) return null
                  const dimmed = hoveredId && hoveredId !== a && hoveredId !== b
                  return (
                    <line
                      key={i}
                      x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                      stroke={dimmed ? '#ece8e2' : '#c9c4bc'}
                      strokeWidth={dimmed ? 1 : 1.5}
                    />
                  )
                })}
                {nodes.map((n) => {
                  const p = positions[n.id]
                  if (!p) return null
                  const dimmed = hoveredId && hoveredId !== n.id
                  return (
                    <g
                      key={n.id}
                      onMouseEnter={() => setHoveredId(n.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        cx={p.x} cy={p.y} r={hoveredId === n.id ? 10 : 7}
                        fill={ROLE_COLORS[n.roleSlug ?? ''] ?? DEFAULT_COLOR}
                        opacity={dimmed ? 0.35 : 1}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                      <text
                        x={p.x} y={p.y - 12}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={hoveredId === n.id ? 700 : 500}
                        fill={dimmed ? '#c9c4bc' : '#1a1814'}
                      >
                        {n.name}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </>
        )}
      </div>

      <div className="net-page" style={{ maxWidth: 900, paddingTop: 0 }}>
        <a href="/network/insights" className="btn-primary net-cta-block">
          See Network Insights →
        </a>
      </div>
    </>
  )
}
