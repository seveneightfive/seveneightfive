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

function downloadPDF(events: SaveTheDate[], month: number, year: number): void {
  const monthLabel = `${MONTH_NAMES[month]} ${year}`
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
<title>785 Save the Date – ${monthLabel}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; color: #111; background: #fff; padding: 40px; }
  .header { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 3px solid #111; padding-bottom: 16px; margin-bottom: 28px; }
  .logo { font-family: 'DM Serif Display', serif; font-size: 48px; letter-spacing: -2px; line-height: 1; }
  .logo span { font-size: 14px; font-family: 'DM Sans', sans-serif; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; display: block; margin-top: 2px; }
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
  <div class="logo">785<span>Save The Date</span></div>
  <div class="meta">
    <h2>${monthLabel}</h2>
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
  <tbody>${rows || "<tr><td colspan='7' style='text-align:center;padding:24px;color:#999;'>No approved events this month.</td></tr>"}</tbody>
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
function AddEventModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<AddEventForm>({
    title: '', organizer: '', event_date: '', event_end_date: '',
    start_time: '', end_time: '', event_type: 'Special Event',
    location_name: '', expected_capacity: '', about: '', needs: '',
    is_annual: false, is_nonprofit: false,
    submitter_name: '', submitter_email: '', submitter_phone: '',
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
      status: 'pending' as SaveTheDateStatus,
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
            <div className="form-divider full"><span>Submitter Info</span></div>
            <div className="form-group">
              <label>Your Name</label>
              <input value={form.submitter_name} onChange={(e) => set('submitter_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" required value={form.submitter_email} onChange={(e) => set('submitter_email', e.target.value)} />
            </div>
            <div className="form-group full">
              <label>Phone <span className="optional">(optional)</span></label>
              <input type="tel" value={form.submitter_phone} onChange={(e) => set('submitter_phone', e.target.value)} />
            </div>
          </div>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SaveTheDatePage() {
  const today = new Date()
  const [month, setMonth] = useState<number>(today.getMonth())
  const [year, setYear] = useState<number>(today.getFullYear())
  const [events, setEvents] = useState<SaveTheDate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [showAdd, setShowAdd] = useState<boolean>(false)
  const [selectedEvent, setSelectedEvent] = useState<SaveTheDate | null>(null)

  const fetchEvents = useCallback(async () => {
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

  useEffect(() => { fetchEvents() }, [fetchEvents])

  function prevMonth(): void {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextMonth(): void {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }
  function goToday(): void {
    setMonth(today.getMonth())
    setYear(today.getFullYear())
  }

  return (
    <>
      <style>{`
        .std-page {
          font-family: 'DM Sans', -apple-system, sans-serif;
          max-width: 860px;
          margin: 0 auto;
          padding: 40px 24px 80px;
          color: #111;
        }
        .std-topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
        .std-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #666; text-decoration: none; border: 1.5px solid #ddd; border-radius: 7px; padding: 6px 12px; transition: border-color 0.15s, color 0.15s; }
        .std-back:hover { border-color: #999; color: #111; }
        .std-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 32px;
        }
        .std-header h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 6px; }
        .std-header p { font-size: 14px; color: #555; max-width: 520px; line-height: 1.5; }
        .btn-primary { background: #111; color: #fff; border: none; padding: 10px 18px; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; white-space: nowrap; transition: opacity 0.15s; }
        .btn-primary:hover { opacity: 0.82; }
        .btn-primary:disabled { opacity: 0.4; cursor: default; }
        .btn-ghost { background: transparent; color: #111; border: 1.5px solid #ddd; padding: 9px 16px; font-size: 14px; font-weight: 500; border-radius: 8px; cursor: pointer; transition: border-color 0.15s; }
        .btn-ghost:hover { border-color: #aaa; }
        .btn-outline { background: #fff; color: #111; border: 1.5px solid #ddd; padding: 8px 14px; font-size: 13px; font-weight: 500; border-radius: 7px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: border-color 0.15s, background 0.15s; }
        .btn-outline:hover { border-color: #999; background: #f5f5f5; }
        .cal-controls { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .cal-month-label { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; min-width: 200px; }
        .cal-nav { background: none; border: 1.5px solid #ddd; border-radius: 7px; width: 34px; height: 34px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s; }
        .cal-nav:hover { border-color: #999; }
        .today-btn { background: none; border: 1.5px solid #ddd; border-radius: 7px; padding: 6px 14px; font-size: 13px; font-weight: 500; cursor: pointer; transition: border-color 0.15s; }
        .today-btn:hover { border-color: #999; }
        .download-group { margin-left: auto; display: flex; gap: 8px; }
        .agenda-list { border: 1.5px solid #e5e5e5; border-radius: 12px; overflow: hidden; }
        .agenda-empty { padding: 48px 24px; text-align: center; color: #999; font-size: 15px; }
        .agenda-empty strong { display: block; color: #555; margin-bottom: 4px; font-size: 16px; }
        .agenda-item { display: grid; grid-template-columns: 90px 1fr; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.12s; }
        .agenda-item:last-child { border-bottom: none; }
        .agenda-item:hover { background: #fafafa; }
        .agenda-date { padding: 16px 16px 16px 20px; border-right: 1px solid #eee; background: #fafafa; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 70px; }
        .agenda-date-day { font-size: 22px; font-weight: 700; line-height: 1; }
        .agenda-date-dow { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        .agenda-content { padding: 14px 20px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
        .agenda-title { font-size: 15px; font-weight: 600; }
        .agenda-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .agenda-organizer { font-size: 13px; color: #666; }
        .agenda-type-chip { font-size: 11px; font-weight: 600; color: #555; background: #f0f0f0; border-radius: 4px; padding: 2px 7px; letter-spacing: 0.3px; }
        .agenda-location { font-size: 12px; color: #999; }
        .agenda-multiday { font-size: 11px; color: #888; font-style: italic; }
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
        .form-divider { position: relative; text-align: center; border-top: 1px solid #eee; margin: 4px 0 0; }
        .form-divider span { position: relative; top: -10px; background: #fff; padding: 0 10px; font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.8px; }
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
          .cal-controls { gap: 6px; }
        }
      `}</style>

      <div className="std-page">
        <div className="std-topbar">
          <a href="/dashboard" className="std-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Dashboard
          </a>
        </div>

        <div className="std-header">
          <div>
            <h1>Save The Date</h1>
            <p>
              Annual Planning Calendar — let&apos;s work together to decrease overlap and ensure everyone hosts successful events.
              Add your large event and date as soon as you know. No other information is required.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Event</button>
        </div>

        <div className="cal-controls">
          <button className="cal-nav" onClick={prevMonth}>‹</button>
          <button className="today-btn" onClick={goToday}>Today</button>
          <button className="cal-nav" onClick={nextMonth}>›</button>
          <span className="cal-month-label">{MONTH_NAMES[month]} {year}</span>
          <div className="download-group">
            <button className="btn-outline" onClick={() => downloadCSV(events)}>⬇ CSV</button>
            <button className="btn-outline" onClick={() => downloadPDF(events, month, year)}>⬇ PDF</button>
          </div>
        </div>

        <div className="agenda-list">
          {loading ? (
            <div className="loading-state">Loading events…</div>
          ) : events.length === 0 ? (
            <div className="agenda-empty">
              <strong>No events saved for {MONTH_NAMES[month]} {year}</strong>
              Be the first to claim a date!
            </div>
          ) : (
            events.map((ev) => {
              const d = new Date(ev.event_date + 'T12:00:00')
              const dayNum = d.getDate()
              const dayName = DAY_NAMES[d.getDay()]
              const isMultiDay = ev.event_end_date && ev.event_end_date !== ev.event_date
              return (
                <div key={ev.id} className="agenda-item" onClick={() => setSelectedEvent(ev)}>
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
            })
          )}
        </div>
      </div>

      {showAdd && (
        <AddEventModal onClose={() => setShowAdd(false)} onSuccess={fetchEvents} />
      )}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  )
}
