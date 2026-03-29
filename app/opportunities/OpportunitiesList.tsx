'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

type Opportunity = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  opportunity_type: string | null
  external_url: string | null
  slug: string | null
  created_at: string
}

const OPPORTUNITY_TYPES = [
  'All',
  'Job',
  'Volunteer',
  'Casting Call',
  'Grant',
  'Collaboration',
]

export default function OpportunitiesList() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [filtered, setFiltered] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchOpportunities() {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      setOpportunities(data || [])
      setFiltered(data || [])
      setLoading(false)
    }

    fetchOpportunities()
  }, [])

  useEffect(() => {
    let result = [...opportunities]

    if (activeType !== 'All') {
      result = result.filter(
        o => o.opportunity_type === activeType
      )
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        o =>
          o.title.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q)
      )
    }

    setFiltered(result)
  }, [activeType, search, opportunities])

  const empty = useMemo(() => !loading && filtered.length === 0, [loading, filtered])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px 80px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 10 }}>785 Opportunities</h1>
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
          placeholder="Search opportunities..."
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
        {OPPORTUNITY_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: '1px solid #ddd',
              background: activeType === type ? '#111' : 'white',
              color: activeType === type ? 'white' : '#444',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          Loading...
        </div>
      ) : empty ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#777' }}>
          No opportunities found.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {filtered.map(opportunity => {
            const href = opportunity.slug
              ? `/opportunities/${opportunity.slug}`
              : opportunity.external_url || '#'

            const isExternal = !opportunity.slug

            return (
              <a
                key={opportunity.id}
                href={href}
                target={isExternal ? '_blank' : '_self'}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                style={{
                  display: 'flex',
                  gap: 16,
                  padding: 16,
                  border: '1px solid #eee',
                  borderRadius: 10,
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s',
                }}
              >
                {opportunity.image_url && (
                  <img
                    src={opportunity.image_url}
                    alt={opportunity.title}
                    style={{
                      width: 100,
                      height: 80,
                      objectFit: 'cover',
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                  />
                )}

                <div style={{ flex: 1 }}>
                  {opportunity.opportunity_type && (
                    <div style={{ fontSize: 12, color: '#C80650', marginBottom: 6 }}>
                      {opportunity.opportunity_type}
                    </div>
                  )}

                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
                    {opportunity.title}
                  </div>

                  {opportunity.description && (
                    <div style={{ fontSize: 14, color: '#666', lineHeight: 1.4 }}>
                      {opportunity.description}
                    </div>
                  )}
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}