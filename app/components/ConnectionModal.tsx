'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ConnectionTypeOption {
  slug: string
  label: string
}
export interface ConnectableAttendee {
  person_id: string
  name: string
  connection_type_slugs: string[]
}

export default function ConnectionModal({
  attendee,
  meId,
  connectionTypes,
  onClose,
  onSaved,
}: {
  attendee: ConnectableAttendee
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
