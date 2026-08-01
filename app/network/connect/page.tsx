'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { NETWORK_BASE_STYLES } from '../_styles'
import ConnectionModal, { ConnectionTypeOption } from '../ConnectionModal'

interface Attendee {
  person_id: string
  name: string
  organization: string | null
  role_labels: string[]
  connected: boolean
  connection_type_slugs: string[]
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

  // Once someone's marked as connected, they drop off this list — this
  // screen is now specifically "who haven't you logged yet", and editing
  // an existing connection happens from the "My Connections" list on /me.
  const unconnected = attendees.filter((a) => !a.connected)

  return (
    <>
      <style>{NETWORK_BASE_STYLES}</style>
      <div className="net-topbar">
        <div className="net-topbar-inner">
          <a href="/network" className="net-back">← Network</a>
          <span className="net-page-label">Connect</span>
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
        ) : (
          <>
            <div className="net-header">
              <h1>Who Do You Know Here?</h1>
              <p>
                Tap a name if you&apos;ve performed together, organized an event together, recorded together,
                shared a bill, worked behind the scenes together, or collaborated in any music-related way.
                Already logged someone? Edit it from{' '}
                <a href="/network/me" style={{ color: 'var(--accent)' }}>My Connections</a>.
              </p>
            </div>

            {loading ? (
              <div className="loading-state">Loading tonight&apos;s attendees…</div>
            ) : attendees.length === 0 ? (
              <div className="empty-state">No one else has checked in yet — check back soon.</div>
            ) : unconnected.length === 0 ? (
              <div className="empty-state">
                You&apos;re connected with everyone who&apos;s checked in so far — nice work. Check back as more
                people arrive, or review/edit what you&apos;ve logged on{' '}
                <a href="/network/me" style={{ color: 'var(--accent)' }}>My Connections</a>.
              </div>
            ) : (
              unconnected.map((a) => (
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
                  <button className="btn-primary" onClick={() => setActiveAttendee(a)}>
                    I&apos;m connected
                  </button>
                </div>
              ))
            )}

            <a href="/network/live" className="btn-primary net-cta-block">
              See The Network →
            </a>
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
