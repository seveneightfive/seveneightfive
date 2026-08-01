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
interface ConnectionTypeOption {
  slug: string
  label: string
}

export default function ConnectPage() {
  const [meId, setMeId] = useState<string | null | undefined>(undefined) // undefined = not checked yet
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [connectionTypes, setConnectionTypes] = useState<ConnectionTypeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [activeAttendee, setActiveAttendee] = useState<Attendee | null>(null)

  useEffect(() => {
    setMeId(localStorage.getItem('network_person_id'))
  }, [])

  useEffect(() => {
    async function loadConnectionTypes() {
      // Pulls every row from connection_types live, in the order you defined
      // them (id ascending) — add or rename types in Supabase and this list
      // updates automatically, no code change needed.
      const { data } = await supabase.from('connection_types').select('slug, label').order('id')
      setConnectionTypes((data as ConnectionTypeOption[]) ?? [])
    }
    loadConnectionTypes()
  }, [])

  const loadAttendees = useCallback(async (id: string) => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_attendees_with_connection_status', { me_id: id })
    if (!error) setAttendees((data as Attendee[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (meId) loadAttendees(meId)
  }, [meId, loadAttendees])

  return (
    <>
      <style>{NETWORK_BASE_STYLES}</style>
      <div className="net-page">
        <div className="net-topnav">
          <a href="/network" className="net-back">← Network</a>
          <span className="net-page-label">Connections</span>
        </div>

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
        ) : (
          <>
            <div className="net-header">
              <h1>Who Do You Know Here?</h1>
              <p>
                Tap a name if you&apos;ve performed together, organized an event together, recorded together,
                shared a bill, worked behind the scenes together, or collaborated in any music-related way.
              </p>
            </div>

            {loading ? (
              <div className="loading-state">Loading tonight&apos;s attendees…</div>
            ) : attendees.length === 0 ? (
              <div className="empty-state">No one else has checked in yet — check back soon.</div>
            ) : (
              attendees.map((a) => (
                <div
                  key={a.person_id}
                  className="card"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{a.name}</div>
                    {a.organization && (
                      <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{a.organization}</div>
                    )}
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {a.role_labels.map((r) => (
                        <span key={r} className="chip chip-neutral">{r}</span>
                      ))}
                    </div>
                  </div>
                  {a.connected ? (
                    <button className="btn-outline" onClick={() => setActiveAttendee(a)}>
                      ✓ Connected ({a.connection_type_slugs.length})
                    </button>
                  ) : (
                    <button className="btn-primary" onClick={() => setActiveAttendee(a)}>
                      I&apos;m connected
                    </button>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>

      {activeAttendee && meId && (
        <ConnectionModal
          attendee={activeAttendee}
          meId={meId}
          connectionTypes={connectionTypes}
          onClose={() => setActiveAttendee(null)}
          onSaved={() => {
            setActiveAttendee(null)
            loadAttendees(meId)
          }}
        />
      )}
    </>
  )
}

function ConnectionModal({
  attendee,
  meId,
  connectionTypes,
  onClose,
  onSaved,
}: {
  attendee: Attendee
  meId: string
  connectionTypes: ConnectionTypeOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [selected, setSelected] = useState<string[]>(attendee.connection_type_slugs)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggle(slug: string) {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const { error: err } = await supabase.rpc('set_connection', {
      p_person_a: meId,
      p_person_b: attendee.person_id,
      p_type_slugs: selected,
    })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved()
  }

  async function handleNotConnected() {
    setSaving(true)
    const { error: err } = await supabase.rpc('set_connection', {
      p_person_a: meId,
      p_person_b: attendee.person_id,
      p_type_slugs: [],
    })
    setSaving(false)
    if (!err) onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>You &amp; {attendee.name}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14 }}>
            Select everything that applies — you can pick more than one, and it&apos;ll show up on{' '}
            {attendee.name.split(' ')[0]}&apos;s list too.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {connectionTypes.map((opt) => (
              <label key={opt.slug} className={`checkbox-tile${selected.includes(opt.slug) ? ' checked' : ''}`}>
                <input type="checkbox" checked={selected.includes(opt.slug)} onChange={() => toggle(opt.slug)} />
                {opt.label}
              </label>
            ))}
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-footer">
            <button className="btn-ghost" onClick={handleNotConnected} disabled={saving}>
              Not connected
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
