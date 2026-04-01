'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type SaveTheDateStatus = 'pending' | 'approved' | 'rejected'

type SaveTheDateEventType =
  | 'Fundraiser'
  | 'Concert + Festival'
  | 'Community'
  | 'Holiday + Seasonal'
  | 'Faith + Worship'
  | 'Civic + Public Meeting'
  | 'Special Event'
  | 'Arts + Exhibition'
  | 'Sports + Recreation'
  | 'Party for a Cause'

interface SaveTheDate {
  id: string
  title: string
  organizer: string
  event_date: string
  event_end_date: string | null
  start_time: string | null
  end_time: string | null
  event_type: SaveTheDateEventType
  is_annual: boolean
  is_nonprofit: boolean
  venue_id: string | null
  location_name: string | null
  about: string | null
  needs: string | null
  expected_capacity: number | null
  submitter_email: string
  submitter_name: string | null
  submitter_phone: string | null
  status: SaveTheDateStatus
  created_at: string
  updated_at: string
}

interface AddEventForm {
  title: string
  organizer: string
  event_date: string
  event_end_date: string
  start_time: string
  end_time: string
  event_type: SaveTheDateEventType
  location_name: string
  expected_capacity: string
  about: string
  needs: string
  is_annual: boolean
  is_nonprofit: boolean
  submitter_name: string
  submitter_email: string
  submitter_phone: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const EVENT_TYPES: SaveTheDateEventType[] = [
  'Fundraiser',
  'Concert + Festival',
  'Community',
  'Holiday + Seasonal',
  'Faith + Worship',
  'Civic + Public Meeting',
  'Special Event',
  'Arts + Exhibition',
  'Sports + Recreation',
  'Party for a Cause',
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

function formatTime(t: string | null | undefined): string | null {
  if (!t) return null
  const [hStr, mStr] = t.split(':')
  let h = parseInt(hStr, 10)
  const min = mStr ?? '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${min} ${ampm}`
}

function downloadCSV(events: SaveTheDate[]): void {
  const headers = [
    'Title', 'Organizer', 'Event Date', 'End Date', 'Start Time', 'End Time',
    'Event Type', 'Location', 'Expected Capacity', 'About', 'Needs',
    'Is Annual', 'Is Nonprofit', 'Submitter Name', 'Submitter Email',
  ]
  const rows = events.map((e) => [
    e.title, e.organizer,
    formatDate(e.event_date), formatDate(e.event_end_date),
    formatTime(e.start_time) ?? '', formatTime(e.end_time) ?? '',
    e.event_type, e.location_name ?? '',
    e.expected_capacity ?? '', e.about ?? '', e.needs ?? '',
    e.is_annual ? 'Yes' : 'No', e.is_nonprofit ? 'Yes' : 'No',
    e.submitter_name ?? '', e.submitter_email,
  ])
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `785_save_the_date_${new Date().toISOString().slice(0, 7)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadPDF(events: SaveTheDate[], label: string): void {
  const rows = events
    .map(
      (e) => `
      <tr>
        <td>${formatDate(e.event_date)}${e.event_end_date ? ` – ${formatDate(e.event_end_date)}` : ''}</td>
        <td><strong>${e.title}</strong><br/><span class="org">${e.organizer}</span></td>
        <td>${e.event_type}</td>
        <td>${e.location_name ?? '—'}</td>
        <td>${e.expected_capacity ? e.expected_capacity.toLocaleString() : '—'}</td>
        <td>${e.about ? e.about.substring(0, 120) + (e.about.length > 120 ? '…' : '') : '—'}</td>
        <td>${e.needs ?? '—'}</td>
      </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>785 Save the Date – ${label}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; color: #111; background: #fff; padding: 40px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #111; padding-bottom: 16px; margin-bottom: 28px; }
  .logo img { height: 52px; width: auto; display: block; }
  .meta { text-align: right; }
  .meta h2 { font-size: 22px; font-weight: 600; }
  .meta p { font-size: 12px; color: #666; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #111; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; font-size: 10px; }
  td { padding: 10px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  tr:hover td { background: #f9f9f9; }
  .org { color: #666; font-size: 10px; }
  .footer { margin-top: 28px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo"><img src="https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/785%20BG%20MAGAZINE.png" alt="785 Magazine" /></div>
  <div class="meta">
    <h2>${label}</h2>
    <p>Annual Planning Calendar · seveneightfive.com</p>
    <p>Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>Date(s)</th>
      <th>Event &amp; Organizer</th>
      <th>Type</th>
      <th>Location</th>
      <th>Capacity</th>
      <th>About</th>
      <th>Needs</th>
    </tr>
  </thead>
  <tbody>${rows || "<tr><td colspan='7' style='text-align:center;padding:24px;color:#999;'>No approved events this period.</td></tr>"}</tbody>
</table>
<div class="footer">
  <span>seveneightfive.com · Topeka's Arts + Culture Platform</span>
  <span>${events.length} event${events.length !== 1 ? 's' : ''} listed</span>
</div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 600)
}

// ─── Add Event Modal ──────────────────────────────────────────────────────────
function AddEventModal({
  onClose,
  onSuccess,
  prefill,
}: {
  onClose: () => void
  onSuccess: () => void
  prefill: { name: string; email: string; phone: string }
}) {
  const [form, setForm] = useState<AddEventForm>({
    title: '', organizer: '', event_date: '', event_end_date: '',
    start_time: '', end_time: '', event_type: 'Special Event',
    location_name: '', expected_capacity: '', about: '', needs: '',
    is_annual: false, is_nonprofit: false,
    submitter_name: prefill.name,
    submitter_email: prefill.email,
    submitter_phone: prefill.phone,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof AddEventForm>(k: K, v: AddEventForm[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    if (!form.submitter_email || form.submitter_email.trim() === '') {
      setError('Could not detect your email. Please refresh and try again, or contact support.')
      setSaving(false)
      return
    }

    const payload = {
      ...form,
      expected_capacity: form.expected_capacity ? parseInt(form.expected_capacity) : null,
      event_end_date: form.event_end_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location_name: form.location_name || null,
      about: form.about || null,
      needs: form.needs || null,
      submitter_name: form.submitter_name || null,
      submitter_phone: form.submitter_phone || null,
      status: 'approved' as SaveTheDateStatus,
    }

    const { error: err } = await supabase.from('save_the_date').insert([payload])
    setSaving(false)
    if (err) { setError(err.message); return }
    onSuccess()
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Save the Date</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group full">
              <label>Event Title *</label>
              <input required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Event name" />
            </div>
            <div className="form-group full">
              <label>Organizer / Organization *</label>
              <input required value={form.organizer} onChange={(e) => set('organizer', e.target.value)} placeholder="Who's putting this on?" />
            </div>
            <div className="form-group">
              <label>Event Date *</label>
              <input type="date" required value={form.event_date} onChange={(e) => set('event_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>End Date <span className="optional">(if multi-day)</span></label>
              <input type="date" value={form.event_end_date} onChange={(e) => set('event_end_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Start Time</label>
              <input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
            </div>
            <div className="form-group full">
              <label>Event Type *</label>
              <select value={form.event_type} onChange={(e) => set('event_type', e.target.value as SaveTheDateEventType)}>
                {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Location / Venue Name</label>
              <input value={form.location_name} onChange={(e) => set('location_name', e.target.value)} placeholder="e.g. NOTO Arts District, TBD" />
            </div>
            <div className="form-group">
              <label>Expected Capacity</label>
              <input type="number" min="0" value={form.expected_capacity} onChange={(e) => set('expected_capacity', e.target.value)} placeholder="# of attendees" />
            </div>
            <div className="form-group checkboxes">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.is_annual} onChange={(e) => set('is_annual', e.target.checked)} />
                Annual event
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.is_nonprofit} onChange={(e) => set('is_nonprofit', e.target.checked)} />
                Nonprofit
              </label>
            </div>
            <div className="form-group full">
              <label>About <span className="optional">(optional)</span></label>
              <textarea rows={3} value={form.about} onChange={(e) => set('about', e.target.value)} placeholder="Brief description..." />
            </div>
            <div className="form-group full">
              <label>Needs <span className="optional">(venue, sponsors, volunteers, etc.)</span></label>
              <textarea rows={2} value={form.needs} onChange={(e) => set('needs', e.target.value)} placeholder="What are you still looking for?" />
            </div>
            <div className="form-group full">
              <label>Your Email *</label>
              <input
                required
                type="email"
                value={form.submitter_email}
                onChange={(e) => set('submitter_email', e.target.value)}
                placeholder="your@email.com"
              />
            </div>
          </div>

          {(form.submitter_name || form.submitter_email) && (
            <div className="submitter-confirm">
              <span className="submitter-confirm-label">Submitting as</span>
              <span className="submitter-confirm-value">
                {form.submitter_name}{form.submitter_name && form.submitter_email ? ' · ' : ''}{form.submitter_email}
              </span>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save the Date'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Event Detail Modal ───────────────────────────────────────────────────────
function EventDetailModal({ event, onClose }: { event: SaveTheDate; onClose: () => void }) {
  const startFmt = formatTime(event.start_time)
  const endFmt = formatTime(event.end_time)
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-detail">
        <div className="modal-header">
          <div>
            <span className="event-type-badge">{event.event_type}</span>
            <h2>{event.title}</h2>
            <p className="detail-organizer">{event.organizer}</p>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="detail-body">
          <div className="detail-row">
            <span className="detail-icon">📅</span>
            <div>
              <strong>{formatDate(event.event_date)}</strong>
              {event.event_end_date && event.event_end_date !== event.event_date && (
                <span> – {formatDate(event.event_end_date)}</span>
              )}
              {(startFmt || endFmt) && (
                <div className="detail-sub">
                  {startFmt}{startFmt && endFmt ? ' – ' : ''}{endFmt}
                </div>
              )}
            </div>
          </div>
          {event.location_name && (
            <div className="detail-row">
              <span className="detail-icon">📍</span>
              <div><strong>{event.location_name}</strong></div>
            </div>
          )}
          {event.expected_capacity && (
            <div className="detail-row">
              <span className="detail-icon">👥</span>
              <div><strong>{event.expected_capacity.toLocaleString()}</strong> expected attendees</div>
            </div>
          )}
          <div className="detail-tags">
            {event.is_annual && <span className="tag">Annual Event</span>}
            {event.is_nonprofit && <span className="tag">Nonprofit</span>}
          </div>
          {event.about && (
            <div className="detail-section">
              <h4>About</h4>
              <p>{event.about}</p>
            </div>
          )}
          {event.needs && (
            <div className="detail-section needs-section">
              <h4>Still Needs</h4>
              <p>{event.needs}</p>
            </div>
          )}
          {event.submitter_name && (
            <div className="detail-section contact-section">
              <h4>Contact</h4>
              <p>{event.submitter_name}</p>
              {event.submitter_email && (
                <p><a href={`mailto:${event.submitter_email}`}>{event.submitter_email}</a></p>
              )}
              {event.submitter_phone && <p>{event.submitter_phone}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Agenda List ──────────────────────────────────────────────────────────────
function AgendaList({
  events,
  loading,
  emptyLabel,
  onSelect,
}: {
  events: SaveTheDate[]
  loading: boolean
  emptyLabel: string
  onSelect: (e: SaveTheDate) => void
}) {
  if (loading) return <div className="loading-state">Loading events…</div>
  if (events.length === 0) {
    return (
      <div className="agenda-empty">
        <strong>{emptyLabel}</strong>
        Be the first to claim a date!
      </div>
    )
  }
  return (
    <>
      {events.map((ev) => {
        const d = new Date(ev.event_date + 'T12:00:00')
        const dayNum = d.getDate()
        const dayName = DAY_NAMES[d.getDay()]
        const isMultiDay = ev.event_end_date && ev.event_end_date !== ev.event_date
        return (
          <div key={ev.id} className="agenda-item" onClick={() => onSelect(ev)}>
            <div className="agenda-date">
              <div className="agenda-date-day">{dayNum}</div>
              <div className="agenda-date-dow">{dayName}</div>
            </div>
            <div className="agenda-content">
              <div className="agenda-title">{ev.title}</div>
              <div className="agenda-meta">
                <span className="agenda-organizer">{ev.organizer}</span>
                <span className="agenda-type-chip">{ev.event_type}</span>
              </div>
              {ev.location_name && (
                <div className="agenda-location">📍 {ev.location_name}</div>
              )}
              {isMultiDay && (
                <div className="agenda-multiday">through {formatDate(ev.event_end_date)}</div>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SaveTheDatePage() {
  const today = new Date()
  const [view, setView] = useState<'month' | 'year'>('year')
  const [month, setMonth] = useState<number>(today.getMonth())
  const [year, setYear] = useState<number>(today.getFullYear())
  const [events, setEvents] = useState<SaveTheDate[]>([])
  const [yearEvents, setYearEvents] = useState<SaveTheDate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [showAdd, setShowAdd] = useState<boolean>(false)
  const [selectedEvent, setSelectedEvent] = useState<SaveTheDate | null>(null)
  const [prefill, setPrefill] = useState({ name: '', email: '', phone: '' })
  const [prefillReady, setPrefillReady] = useState(false)

  // Load user profile for form pre-fill
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setPrefillReady(true) // unblock button even if no user
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone_number')
        .eq('id', user.id)
        .maybeSingle()
      setPrefill({
        name: profile?.full_name || '',
        email: profile?.email || user.email || '',
        phone: profile?.phone_number || '',
      })
      setPrefillReady(true)
    }
    loadProfile()
  }, [])

  const fetchMonthEvents = useCallback(async () => {
    setLoading(true)
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
    const { data, error } = await supabase
      .from('save_the_date')
      .select('*')
      .eq('status', 'approved')
      .gte('event_date', from)
      .lte('event_date', to)
      .order('event_date', { ascending: true })
    if (!error) setEvents((data as SaveTheDate[]) ?? [])
    setLoading(false)
  }, [month, year])

  const fetchYearEvents = useCallback(async () => {
    setLoading(true)
    const from = `${year}-01-01`
    const to = `${year}-12-31`
    const { data, error } = await supabase
      .from('save_the_date')
      .select('*')
      .eq('status', 'approved')
      .gte('event_date', from)
      .lte('event_date', to)
      .order('event_date', { ascending: true })
    if (!error) setYearEvents((data as SaveTheDate[]) ?? [])
    setLoading(false)
  }, [year])

  useEffect(() => {
    if (view === 'month') fetchMonthEvents()
    else fetchYearEvents()
  }, [view, fetchMonthEvents, fetchYearEvents])

  function prevPeriod() {
    if (view === 'year') { setYear((y) => y - 1); return }
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextPeriod() {
    if (view === 'year') { setYear((y) => y + 1); return }
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  function toggleView() {
    setView((v) => v === 'month' ? 'year' : 'month')
  }

  // Group year events by month
  const byMonth: Record<number, SaveTheDate[]> = {}
  if (view === 'year') {
    yearEvents.forEach((ev) => {
      const m = parseInt(ev.event_date.split('-')[1], 10) - 1
      if (!byMonth[m]) byMonth[m] = []
      byMonth[m].push(ev)
    })
  }

  const displayLabel = view === 'year' ? String(year) : `${MONTH_NAMES[month]} ${year}`
  const allEvents = view === 'year' ? yearEvents : events

  return (
    <>
      <style>{`
        .std-page {
          font-family: 'DM Sans', -apple-system, sans-serif;
          max-width: 860px;
          margin: 0 auto;
          padding: 0 24px 80px;
          color: #111;
        }
        .std-topnav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0;
          border-bottom: 1px solid #eee;
          margin-bottom: 32px;
        }
        .std-back {
          font-family: 'Oswald', sans-serif;
          font-size: 0.72rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.35);
          text-decoration: none;
          transition: color 0.15s;
        }
        .std-back:hover { color: #111; }
        .std-page-label {
          font-family: 'Oswald', sans-serif;
          font-size: 0.72rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.25);
        }
        .std-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 32px;
        }
        .std-header h1 {
          font-family: 'Oswald', sans-serif;
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 6px;
          line-height: 1;
        }
        .std-header p { font-size: 14px; color: #555; max-width: 520px; line-height: 1.5; }
        .btn-primary { background: #111; color: #fff; border: none; padding: 10px 18px; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; white-space: nowrap; transition: opacity 0.15s; }
        .btn-primary:hover { opacity: 0.82; }
        .btn-primary:disabled { opacity: 0.4; cursor: default; }
        .btn-ghost { background: transparent; color: #111; border: 1.5px solid #ddd; padding: 9px 16px; font-size: 14px; font-weight: 500; border-radius: 8px; cursor: pointer; transition: border-color 0.15s; }
        .btn-ghost:hover { border-color: #aaa; }
        .btn-outline { background: #fff; color: #111; border: 1.5px solid #ddd; padding: 8px 14px; font-size: 13px; font-weight: 500; border-radius: 7px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: border-color 0.15s, background 0.15s; }
        .btn-outline:hover { border-color: #999; background: #f5f5f5; }
        .cal-controls { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .cal-month-label {
          font-family: 'Oswald', sans-serif;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          min-width: 180px;
        }
        .cal-nav { background: none; border: 1.5px solid #ddd; border-radius: 7px; width: 34px; height: 34px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s; }
        .cal-nav:hover { border-color: #999; }
        .view-toggle { background: none; border: 1.5px solid #ddd; border-radius: 7px; padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s; font-family: 'Oswald', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; }
        .view-toggle:hover { border-color: #999; }
        .view-toggle.active { background: #111; border-color: #111; color: #fff; }
        .download-group { margin-left: auto; display: flex; gap: 8px; }
        .agenda-list { border: 1.5px solid #e5e5e5; border-radius: 12px; overflow: hidden; }
        .agenda-empty { padding: 48px 24px; text-align: center; color: #999; font-size: 15px; }
        .agenda-empty strong { display: block; color: #555; margin-bottom: 4px; font-size: 16px; }
        .agenda-item { display: grid; grid-template-columns: 90px 1fr; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.12s; }
        .agenda-item:last-child { border-bottom: none; }
        .agenda-item:hover { background: #fafafa; }
        .agenda-date { padding: 16px 16px 16px 20px; border-right: 1px solid #eee; background: #fafafa; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 70px; }
        .agenda-date-day { font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 700; line-height: 1; }
        .agenda-date-dow { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        .agenda-content { padding: 14px 20px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
        .agenda-title { font-size: 15px; font-weight: 600; }
        .agenda-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .agenda-organizer { font-size: 13px; color: #666; }
        .agenda-type-chip { font-size: 11px; font-weight: 600; color: #555; background: #f0f0f0; border-radius: 4px; padding: 2px 7px; letter-spacing: 0.3px; }
        .agenda-location { font-size: 12px; color: #999; }
        .agenda-multiday { font-size: 11px; color: #888; font-style: italic; }
        .year-month-section { margin-bottom: 36px; }
        .year-month-heading {
          font-family: 'Oswald', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #888;
          padding: 10px 0 8px;
          border-bottom: 2px solid #111;
          margin-bottom: 8px;
          display: flex;
          align-items: baseline;
          gap: 10px;
        }
        .year-month-count { font-size: 11px; font-weight: 500; color: #aaa; letter-spacing: 0; }
        .year-month-empty { font-size: 13px; color: #ccc; padding: 12px 0; font-style: italic; }
        .loading-state { padding: 40px 24px; text-align: center; color: #aaa; font-size: 14px; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal { background: #fff; border-radius: 14px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.18); }
        .modal-detail { max-width: 520px; }
        .modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 24px 24px 0; gap: 12px; }
        .modal-header h2 { font-size: 20px; font-weight: 700; margin-top: 4px; }
        .close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; padding: 0; line-height: 1; flex-shrink: 0; }
        .close-btn:hover { color: #111; }
        .modal-form { padding: 20px 24px 24px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-group.full { grid-column: 1 / -1; }
        .form-group label { font-size: 13px; font-weight: 600; color: #333; }
        .optional { font-weight: 400; color: #999; }
        .form-group input, .form-group select, .form-group textarea { border: 1.5px solid #ddd; border-radius: 7px; padding: 9px 12px; font-size: 14px; font-family: inherit; color: #111; outline: none; transition: border-color 0.15s; background: #fff; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #111; }
        .form-group textarea { resize: vertical; }
        .checkboxes { flex-direction: column; justify-content: flex-end; gap: 10px; }
        .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; cursor: pointer; }
        .checkbox-label input { width: 16px; height: 16px; cursor: pointer; }
        .submitter-confirm { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding: 10px 12px; background: #f5f5f5; border-radius: 7px; font-size: 13px; }
        .submitter-confirm-label { font-weight: 600; color: #555; white-space: nowrap; }
        .submitter-confirm-value { color: #333; }
        .form-error { color: #C80650; font-size: 13px; margin-top: 10px; padding: 10px 12px; background: #fce8ef; border-radius: 6px; }
        .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .event-type-badge { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #666; background: #f0f0f0; border-radius: 4px; padding: 3px 8px; display: inline-block; margin-bottom: 6px; }
        .detail-organizer { font-size: 14px; color: #666; margin-top: 2px; }
        .detail-body { padding: 20px 24px 28px; }
        .detail-row { display: flex; gap: 12px; margin-bottom: 14px; font-size: 14px; align-items: flex-start; }
        .detail-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
        .detail-sub { color: #666; font-size: 13px; margin-top: 2px; }
        .detail-tags { display: flex; gap: 8px; flex-wrap: wrap; margin: 2px 0 16px; }
        .tag { font-size: 12px; font-weight: 600; border: 1.5px solid #ddd; border-radius: 5px; padding: 3px 10px; color: #444; }
        .detail-section { margin-top: 16px; }
        .detail-section h4 { font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
        .detail-section p { font-size: 14px; color: #333; line-height: 1.6; }
        .needs-section { background: #fffbf0; border-radius: 8px; padding: 12px 14px; border-left: 3px solid #FFCE03; }
        .needs-section h4 { color: #a07b00; }
        .needs-section p { color: #555; }
        .contact-section { background: #f8f8f8; border-radius: 8px; padding: 12px 14px; }
        .contact-section a { color: #111; text-decoration: underline; }
        @media (max-width: 560px) {
          .std-header { flex-direction: column; }
          .form-grid { grid-template-columns: 1fr; }
          .form-group.full { grid-column: 1; }
          .download-group { margin-left: 0; }
          .cal-controls { gap: 6px; } .download-group { margin-left: 0; margin-top: 10px; width: 100%; justify-content: flex-start; }
          .std-page { padding: 0 16px 60px; }
        }
      `}</style>

      <div className="std-page">
        <div className="std-topnav">
          <a href="/dashboard" className="std-back">← Dashboard</a>
          <span className="std-page-label">Save The Date</span>
        </div>

        <div className="std-header">
          <div>
            <h1>Save The Date</h1>
            <p>
              Annual Planning Calendar — let&apos;s work together to decrease overlap and ensure everyone hosts successful events.
              Add your large event and date as soon as you know. No other information is required.
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowAdd(true)}
            disabled={!prefillReady}
          >
            + Add Event
          </button>
        </div>

        <div className="cal-controls">
          <button className="cal-nav" onClick={prevPeriod}>‹</button>
          <button
            className={`view-toggle${view === 'year' ? ' active' : ''}`}
            onClick={toggleView}
          >
            Year
          </button>
          <button className="cal-nav" onClick={nextPeriod}>›</button>
          <span className="cal-month-label">{displayLabel}</span>
          <div className="download-group">
            <button className="btn-outline" onClick={() => downloadCSV(allEvents)}>⬇ CSV</button>
            <button className="btn-outline" onClick={() => downloadPDF(allEvents, displayLabel)}>⬇ PDF</button>
          </div>
        </div>

        {view === 'month' && (
          <div className="agenda-list">
            <AgendaList
              events={events}
              loading={loading}
              emptyLabel={`No events saved for ${MONTH_NAMES[month]} ${year}`}
              onSelect={setSelectedEvent}
            />
          </div>
        )}

        {view === 'year' && (
          loading ? (
            <div className="agenda-list">
              <div className="loading-state">Loading events…</div>
            </div>
          ) : (
            MONTH_NAMES.map((mName, mIdx) => {
              const mEvents = byMonth[mIdx] || []
              return (
                <div key={mIdx} className="year-month-section">
                  <div className="year-month-heading">
                    {mName}
                    {mEvents.length > 0 && (
                      <span className="year-month-count">{mEvents.length} event{mEvents.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {mEvents.length === 0 ? (
                    <div className="year-month-empty">No events</div>
                  ) : (
                    <div className="agenda-list">
                      <AgendaList
                        events={mEvents}
                        loading={false}
                        emptyLabel=""
                        onSelect={setSelectedEvent}
                      />
                    </div>
                  )}
                </div>
              )
            })
          )
        )}
      </div>

      {showAdd && (
        <AddEventModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => view === 'month' ? fetchMonthEvents() : fetchYearEvents()}
          prefill={prefill}
        />
      )}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  )
}
