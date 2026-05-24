'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

type Opportunity = {
  id: string
  slug: string | null
  title: string
  excerpt: string | null
  type_slug: string | null
  type_label: string | null
  compensation_slug: string | null
  compensation_label: string | null
  location_display: string | null
  application_url: string | null
  application_email: string | null
  deadline_date: string | null
  deadline_status: 'rolling' | 'closed' | 'urgent' | 'soon' | 'open' | null
  days_until_deadline: number | null
  organization_name: string | null
  is_featured: boolean | null
  og_image: string | null
  created_at: string
}

type OpportunityType = {
  slug: string
  label: string
}

const BRAND = '#C80650'

// Color the type pill based on the category, with a sensible default.
function typeColor(slug: string | null): string {
  switch (slug) {
    case 'job': return '#0F766E'
    case 'volunteer': return '#7C3AED'
    case 'casting-call': return '#DB2777'
    case 'grant': return '#CA8A04'
    case 'collaboration': return '#2563EB'
    default: return '#555'
  }
}

// Map the deadline_status enum from the SQL view to a UI treatment.
function deadlineDisplay(o: Opportunity): { label: string; color: string } {
  const status = o.deadline_status
  if (status === 'rolling') return { label: 'Rolling', color: '#777' }
  if (status === 'closed')  return { label: 'Closed', color: '#999' }

  const days = o.days_until_deadline
  if (status === 'urgent' && days != null)
    return { label: days === 0 ? 'Due today' : `${days}d left`, color: BRAND }
  if (status === 'soon' && days != null)
    return { label: `${days}d left`, color: '#D97706' }

  // 'open' — show the actual date
  if (o.deadline_date) {
    const d = new Date(o.deadline_date)
    return {
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      color: '#555',
    }
  }
  return { label: '', color: '#777' }
}

export default function OpportunitiesList() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [types, setTypes] = useState<OpportunityType[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState('all')
  const [search, setSearch] = useState('')

  // Fetch type filter options + opportunities in parallel
  useEffect(() => {
    async function fetchAll() {
      const [typesRes, oppsRes] = await Promise.all([
        supabase
          .from('opportunity_types_active')
          .select('slug, label'),
        supabase
          .from('opportunities_listing')
          .select('*')
          .order('is_featured', { ascending: false })
          .order('deadline_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false }),
      ])

      if (typesRes.error) console.error(typesRes.error)
      if (oppsRes.error) console.error(oppsRes.error)

      setTypes(typesRes.data ?? [])
      setOpportunities(oppsRes.data ?? [])
      setLoading(false)
    }
    fetchAll()
  }, [])

  // Client-side filter — keep this simple. For real scale, push to SQL with .eq/.ilike.
  const filtered = useMemo(() => {
    let result = opportunities

    if (activeType !== 'all') {
      result = result.filter(o => o.type_slug === activeType)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        o =>
          o.title.toLowerCase().includes(q) ||
          o.excerpt?.toLowerCase().includes(q) ||
          o.organization_name?.toLowerCase().includes(q)
      )
    }

    return result
  }, [activeType, search, opportunities])

  const empty = !loading && filtered.length === 0

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 10 }}>Opportunities</h1>
        {!loading && (
          <div style={{ color: '#777', fontSize: 14 }}>
            {filtered.length} {filtered.length === 1 ? 'opportunity' : 'opportunities'}
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by title, org, or keyword…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #ddd',
            fontSize: 14,
          }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 30 }}>
        <FilterChip
          label="All"
          active={activeType === 'all'}
          onClick={() => setActiveType('all')}
        />
        {types.map(t => (
          <FilterChip
            key={t.slug}
            label={t.label}
            active={activeType === t.slug}
            onClick={() => setActiveType(t.slug)}
          />
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#777' }}>
          Loading…
        </div>
      ) : empty ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#777' }}>
          No opportunities match those filters.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(o => (
            <OpportunityRow key={o.id} opportunity={o} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        border: '1px solid ' + (active ? '#111' : '#ddd'),
        background: active ? '#111' : 'white',
        color: active ? 'white' : '#444',
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function OpportunityRow({ opportunity: o }: { opportunity: Opportunity }) {
  // Internal link if we have a slug, otherwise fall back to the external apply URL.
  const href = o.slug
    ? `/opportunities/${o.slug}`
    : o.application_url || (o.application_email ? `mailto:${o.application_email}` : '#')
  const isExternal = !o.slug && href !== '#'

  const deadline = deadlineDisplay(o)
  const isClosed = o.deadline_status === 'closed'

  return (
    <a
      href={href}
      target={isExternal ? '_blank' : '_self'}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      style={{
        display: 'flex',
        gap: 16,
        padding: '16px 18px',
        border: '1px solid #eee',
        borderLeft: o.is_featured ? `3px solid ${BRAND}` : '1px solid #eee',
        borderRadius: 10,
        background: 'white',
        textDecoration: 'none',
        color: 'inherit',
        opacity: isClosed ? 0.6 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Top row: type pill + featured tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {o.type_label && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                color: typeColor(o.type_slug),
              }}
            >
              {o.type_label}
            </span>
          )}
          {o.is_featured && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                color: BRAND,
                background: 'rgba(200, 6, 80, 0.08)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              Featured
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>
          {o.title}
        </div>

        {/* Org */}
        {o.organization_name && (
          <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
            {o.organization_name}
          </div>
        )}

        {/* Excerpt */}
        {o.excerpt && (
          <div
            style={{
              fontSize: 14,
              color: '#666',
              lineHeight: 1.45,
              marginBottom: 10,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {o.excerpt}
          </div>
        )}

        {/* Meta row: location · compensation */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#777' }}>
          {o.location_display && <span>📍 {o.location_display}</span>}
          {o.compensation_label && <span>💰 {o.compensation_label}</span>}
        </div>
      </div>

      {/* Deadline column */}
      <div
        style={{
          flexShrink: 0,
          textAlign: 'right',
          fontSize: 13,
          fontWeight: 600,
          color: deadline.color,
          minWidth: 80,
          alignSelf: 'flex-start',
        }}
      >
        {deadline.label}
      </div>
    </a>
  )
}
