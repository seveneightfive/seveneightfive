'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { NETWORK_BASE_STYLES } from '../_styles'

interface RoleOption {
  id: number
  slug: string
  label: string
}
interface ExistingPerson {
  id: string
  name: string
  organization: string | null
}

// Roles that trigger the genre picker — matches roles seeded in Supabase
// (musician, ensemble_member, dj).
const MUSIC_ROLE_SLUGS = ['musician', 'ensemble_member', 'dj']

const GENRES = [
  'Rock', 'Pop', 'Jazz', 'Classical', 'Electronic', 'Hip-Hop', 'Country',
  'Reggae', 'Blues', 'Folk', 'Singer-Songwriter', 'Spoken Word', 'Motown',
  'Funk', 'Americana', 'Punk', 'Grunge', 'Jam Band', 'Tejano', 'Latin',
  'DJ', 'Bluegrass', 'Rap',
]

export default function CheckInPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // "Welcome back" search — lets someone who already checked in earlier
  // tonight (but lost localStorage, or is on a different device) find their
  // existing check-in instead of accidentally creating a duplicate.
  const [lookupQuery, setLookupQuery] = useState('')
  const [lookupResults, setLookupResults] = useState<ExistingPerson[]>([])
  const [lookupLoading, setLookupLoading] = useState(false)

  useEffect(() => {
    async function loadRoles() {
      const { data } = await supabase.from('roles').select('id, slug, label').order('label')
      setRoles((data as RoleOption[]) ?? [])
    }
    loadRoles()
  }, [])

  useEffect(() => {
    const query = lookupQuery.trim()
    if (query.length < 2) {
      setLookupResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setLookupLoading(true)
      const { data } = await supabase
        .from('event_people')
        .select('id, name, organization')
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(8)
      setLookupResults((data as ExistingPerson[]) ?? [])
      setLookupLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [lookupQuery])

  function claimExisting(person: ExistingPerson) {
    localStorage.setItem('network_person_id', person.id)
    localStorage.setItem('network_person_name', person.name)
    router.push('/network/connect')
  }

  const selectedSlugs = roles.filter((r) => selectedRoleIds.includes(r.id)).map((r) => r.slug)
  const showGenres = selectedSlugs.some((s) => MUSIC_ROLE_SLUGS.includes(s))

  function toggleRole(id: number) {
    setSelectedRoleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  function toggleGenre(g: string) {
    setSelectedGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter your name.')
      return
    }
    if (selectedRoleIds.length === 0) {
      setError('Please select at least one role.')
      return
    }

    setSaving(true)

    const { data: person, error: personErr } = await supabase
      .from('event_people')
      .insert({ name: name.trim(), organization: organization.trim() || null })
      .select('id')
      .single()

    if (personErr || !person) {
      setError(personErr?.message ?? 'Something went wrong checking you in.')
      setSaving(false)
      return
    }

    const roleRows = selectedRoleIds.map((role_id) => ({ person_id: person.id, role_id }))
    const { error: roleErr } = await supabase.from('event_people_roles').insert(roleRows)
    if (roleErr) {
      setError(roleErr.message)
      setSaving(false)
      return
    }

    if (showGenres && selectedGenres.length > 0) {
      const genreRows = selectedGenres.map((genre) => ({ person_id: person.id, genre }))
      const { error: genreErr } = await supabase.from('event_people_genres').insert(genreRows)
      if (genreErr) {
        setError(genreErr.message)
        setSaving(false)
        return
      }
    }

    // No login required for the walk-up flow — remember who "me" is on this
    // device so /network/connect and /network/live can pick it up.
    localStorage.setItem('network_person_id', person.id)
    localStorage.setItem('network_person_name', name.trim())

    setSaving(false)
    router.push('/network/connect')
  }

  return (
    <>
      <style>{NETWORK_BASE_STYLES}</style>
      <div className="net-topbar">
        <div className="net-topbar-inner">
          <a href="/network" className="net-back">← Network</a>
          <span className="net-page-label">Check In</span>
        </div>
      </div>

      <div className="net-page">

        <div className="net-header">
          <h1>Who&apos;s Here Tonight</h1>
          <p>Tell us who you are so we can start mapping how the Topeka music scene connects.</p>
        </div>

        <div className="form-group">
          <label>Already checked in earlier tonight?</label>
          <input
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
            placeholder="Search your name…"
          />
        </div>

        {lookupLoading && <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 12 }}>Searching…</p>}

        {lookupResults.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            {lookupResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => claimExisting(p)}
                className="card"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none',
                  font: 'inherit', color: 'inherit',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  {p.organization && <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{p.organization}</div>}
                </div>
                <span className="chip chip-neutral">This is me →</span>
              </button>
            ))}
          </div>
        )}

        {lookupQuery.trim().length >= 2 && !lookupLoading && lookupResults.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 24 }}>
            No match yet — check the spelling, or check in as new below.
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
            Or check in as new
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Your Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
          </div>

          <div className="form-group">
            <label>
              Organization <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(optional)</span>
            </label>
            <input
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Band, venue, publication, etc."
            />
          </div>

          <div className="form-group">
            <label>
              Role(s) * <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(select all that apply)</span>
            </label>
            <div className="checkbox-grid">
              {roles.map((role) => (
                <label key={role.id} className={`checkbox-tile${selectedRoleIds.includes(role.id) ? ' checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </div>

          {showGenres && (
            <div className="form-group">
              <label>
                Genre(s) <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(optional, select all that apply)</span>
              </label>
              <div className="checkbox-grid">
                {GENRES.map((g) => (
                  <label key={g} className={`checkbox-tile${selectedGenres.includes(g) ? ' checked' : ''}`}>
                    <input type="checkbox" checked={selectedGenres.includes(g)} onChange={() => toggleGenre(g)} />
                    {g}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 8 }}>
            {saving ? 'Checking in…' : "I'm here →"}
          </button>
        </form>
      </div>
    </>
  )
}
