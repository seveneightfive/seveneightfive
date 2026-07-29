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
  organizer: string | null
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

type DisplayMode = 'calendar' | 'list'
type ListView = 'month' | 'year'

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
    e.title, e.organizer ?? '',
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
        <td><strong>${e.title}</strong>${e.organizer ? `<br/><span class="org">${e.organizer}</span>` : ''}</td>
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
<title>seveneightfive SAVE THE DATE – ${label}</title>
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
  <span>seveneightfive.com · Celebrating everything local, everything Topeka.</span>
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
      setError('Could not detect your email. Please refresh and try again, or contact us at 785-249-3126.')
      setSaving(false)
      return
    }

    const payload = {
      ...form,
      organizer: form.organizer || null,
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
              <label>Organizer / Organization <span className="optional">(optional)</span></label>
              <input value={form.organizer} onChange={(e) => set('organizer', e.target.value)} placeholder="Who's putting this on?" />
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
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="detail-body">
          <div className="detail-row">
            <div className="detail-label">Date</div>
            <div className="detail-value">
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
              <div className="detail-label">Location</div>
              <div className="detail-value"><strong>{event.location_name}</strong></div>
            </div>
          )}

          {(event.is_annual || event.is_nonprofit) && (
            <div className="detail-tags">
              {event.is_annual && <span className="tag">Annual Event</span>}
              {event.is_nonprofit && <span className="tag">Nonprofit</span>}
            </div>
          )}

          {event.about && (
            <div className="detail-section">
              <h4>About</h4>
              <p>{event.about}</p>
            </div>
          )}

          {event.organizer && (
            <div className="detail-section">
              <h4>Organizer</h4>
              <p>{event.organizer}</p>
            </div>
          )}
          {event.expected_capacity && (
            <div className="detail-section">
              <h4>Expected Capacity</h4>
              <p>{event.expected_capacity.toLocaleString()} attendees</p>
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

// ─── Upcoming List (new) ───────────────────────────────────────────────────────
// Flat "next N events from today forward" list under the calendar grid,
// mirroring the mockup's "UPCOMING" section. Pulled from whichever
// events are already loaded (year events cover this without a new
// fetch, since it's always a superset of the current month).
function UpcomingList({
  events,
  onSelect,
}: {
  events: SaveTheDate[]
  onSelect: (e: SaveTheDate) => void
}) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const upcoming = events
    .filter((e) => e.event_date >= todayStr)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 6)

  if (upcoming.length === 0) return null

  return (
    <div className="upcoming-section">
      <h2 className="upcoming-heading">Upcoming</h2>
      <div className="upcoming-list">
        {upcoming.map((ev) => {
          const d = new Date(ev.event_date + 'T12:00:00')
          const isMultiDay = ev.event_end_date && ev.event_end_date !== ev.event_date
          return (
            <div key={ev.id} className="upcoming-item" onClick={() => onSelect(ev)}>
              <div className="upcoming-date">
                <div className="upcoming-date-month">
                  {d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                </div>
                <div className="upcoming-date-day">{d.getDate()}</div>
              </div>
              <div className="upcoming-content">
                <div className="upcoming-title">{ev.title}</div>
                <div className="upcoming-meta">
                  {ev.location_name && <span>{ev.location_name}</span>}
                  {ev.location_name && ev.organizer && <span> · </span>}
                  {ev.organizer && <span>{ev.organizer}</span>}
                  {isMultiDay && <span className="upcoming-multiday"> · through {formatDate(ev.event_end_date)}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Calendar Grid (month view) ───────────────────────────────────────────────
function CalendarGrid({
  month,
  year,
  events,
  loading,
  onSelect,
}: {
  month: number
  year: number
  events: SaveTheDate[]
  loading: boolean
  onSelect: (e: SaveTheDate) => void
}) {
  if (loading) return <div className="cal-grid-loading">Loading events…</div>

  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const byDay: Record<number, SaveTheDate[]> = {}
  events.forEach((ev) => {
    const day = parseInt(ev.event_date.split('-')[2], 10)
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(ev)
  })

  const cells: { day: number; inMonth: boolean; events: SaveTheDate[] }[] = []
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inMonth: false, events: [] })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, events: byDay[d] || [] })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length, inMonth: false, events: [] })
  }

  const today = new Date()
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year

  return (
    <div className="cal-grid">
      <div className="cal-grid-dow">
        {DAY_NAMES.map((d) => <div key={d} className="cal-grid-dow-cell">{d[0]}</div>)}
      </div>
      <div className="cal-grid-body">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`cal-grid-cell${cell.inMonth ? '' : ' cal-grid-cell-out'}${
              cell.inMonth && isCurrentMonth && cell.day === today.getDate() ? ' cal-grid-cell-today' : ''
            }`}
          >
            <div className="cal-grid-daynum">{cell.day}</div>
            <div className="cal-grid-events">
              {cell.events.slice(0, 3).map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className="cal-grid-chip"
                  onClick={() => onSelect(ev)}
                  title={ev.title}
                >
                  {ev.title}
                </button>
              ))}
              {cell.events.length > 3 && (
                <div className="cal-grid-more">+{cell.events.length - 3} more</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SaveTheDatePage() {
  const today = new Date()
  const [displayMode, setDisplayMode] = useState<DisplayMode>('calendar')
  const [view, setView] = useState<ListView>('year')
  const [month, setMonth] = useState<number>(today.getMonth())
  const [year, setYear] = useState<number>(today.getFullYear())
  const [events, setEvents] = useState<SaveTheDate[]>([])
  const [yearEvents, setYearEvents] = useState<SaveTheDate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [showAdd, setShowAdd] = useState<boolean>(false)
  const [selectedEvent, setSelectedEvent] = useState<SaveTheDate | null>(null)
  const [prefill, setPrefill] = useState({ name: '', email: '', phone: '' })
  const [prefillReady, setPrefillReady] = useState(false)

  const periodMode: ListView = displayMode === 'calendar' ? 'month' : view

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setPrefillReady(true)
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
    if (periodMode === 'month') fetchMonthEvents()
    else fetchYearEvents()
  }, [periodMode, fetchMonthEvents, fetchYearEvents])

  // The "Upcoming" list under the calendar view needs events extending
  // past the current month, so it piggybacks on the year fetch even
  // while in calendar mode — cheap since it's already the shape needed
  // for the year/list view too, just fetched once more if not already
  // in memory for this year.
  useEffect(() => {
    if (displayMode === 'calendar' && yearEvents.length === 0) {
      fetchYearEvents()
    }
  }, [displayMode, yearEvents.length, fetchYearEvents])

  function prevPeriod() {
    if (periodMode === 'year') { setYear((y) => y - 1); return }
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextPeriod() {
    if (periodMode === 'year') { setYear((y) => y + 1); return }
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }
  function goToToday() {
    setMonth(today.getMonth())
    setYear(today.getFullYear())
  }

  function toggleListPeriod() {
    setView((v) => v === 'month' ? 'year' : 'month')
  }

  const byMonth: Record<number, SaveTheDate[]> = {}
  if (displayMode === 'list' && view === 'year') {
    yearEvents.forEach((ev) => {
      const m = parseInt(ev.event_date.split('-')[1], 10) - 1
      if (!byMonth[m]) byMonth[m] = []
      byMonth[m].push(ev)
    })
  }

  const displayLabel = periodMode === 'year' ? String(year) : `${MONTH_NAMES[month]} ${year}`
  const allEvents = periodMode === 'year' ? yearEvents : events

  const isShowingCurrentMonth = periodMode === 'month' && month === today.getMonth() && year === today.getFullYear()

  return (
    <>
      <style>{`
        :root {
          --ink: #171614; --ink-soft: #6B6B6B; --ink-faint: #9A968C;
          --white: #ffffff; --off: #F7F6F3; --warm: #f2ede6;
          --yellow: #F5C518; --magenta: #E5316B;
          --border: #E5E3DD;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }

        .std-page {
          font-family: var(--sans);
          width: 100%;
          color: var(--ink);
          -webkit-font-smoothing: antialiased;
        }
        .std-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }
        .std-eyebrow {
          font-family: var(--serif);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--magenta);
          margin-bottom: 6px;
          display: block;
        }
        .std-header h1 {
          font-family: var(--serif);
          font-size: 2.25rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          text-transform: uppercase;
          margin-bottom: 8px;
          line-height: 1.05;
          color: var(--ink);
        }
        .std-header p { font-size: 0.95rem; font-weight: 400; color: var(--ink-soft); max-width: 620px; line-height: 1.55; }

        .btn-primary {
          background: var(--yellow);
          color: #171614;
          border: none;
          padding: 12px 22px;
          font-family: var(--serif);
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-primary:hover { background: #e6b910; }
        .btn-primary:active { transform: scale(0.98); }
        .btn-primary:disabled { opacity: 0.4; cursor: default; }

        .btn-ghost {
          background: transparent;
          color: var(--ink);
          border: 1.5px solid var(--border);
          padding: 11px 20px;
          font-family: var(--serif);
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-radius: 8px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .btn-ghost:hover { border-color: var(--ink-faint); background: var(--off); }

        .btn-outline {
          background: #fff;
          color: var(--ink);
          border: 1.5px solid var(--border);
          padding: 9px 16px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: border-color 0.15s, background 0.15s;
        }
        .btn-outline:hover { border-color: var(--ink-faint); background: var(--off); }

        /* Card wrapper — the whole calendar controls + grid now sit
           inside one bordered card, matching the mockup's boxed look
           (previously the controls floated loose above a separate grid). */
        .cal-card {
          border: 1.5px solid var(--border);
          border-radius: 14px;
          padding: 20px 24px;
          margin-bottom: 8px;
        }

        .cal-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; flex-wrap: wrap; gap: 12px; }
        .cal-topbar-left { display: flex; align-items: center; gap: 10px; }
        .cal-nav { background: none; border: 1.5px solid var(--border); border-radius: 8px; width: 36px; height: 36px; cursor: pointer; font-size: 17px; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s, background 0.15s; color: var(--ink); }
        .cal-nav:hover { border-color: var(--ink-faint); background: var(--off); }
        .cal-month-label {
          font-family: var(--serif);
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--ink);
        }
        .cal-today-btn {
          background: none;
          border: 1.5px solid var(--border);
          border-radius: 8px;
          padding: 8px 16px;
          font-family: var(--serif);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink);
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .cal-today-btn:hover:not(:disabled) { border-color: var(--ink-faint); background: var(--off); }
        .cal-today-btn:disabled { opacity: 0.35; cursor: default; }

        /* Mode toggle — Calendar / List */
        .mode-toggle { display: inline-flex; gap: 2px; background: var(--off); border-radius: 8px; padding: 3px; margin: 16px 0; }
        .mode-toggle-btn { font-family: var(--serif); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 8px 18px; border-radius: 6px; border: none; background: transparent; color: var(--ink-soft); cursor: pointer; transition: background 0.15s, color 0.15s; }
        .mode-toggle-btn.active { background: var(--ink); color: #fff; }

        .cal-controls-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .view-toggle { background: none; border: 1.5px solid var(--border); border-radius: 7px; padding: 7px 14px; font-size: 13px; font-weight: 700; cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s; font-family: var(--serif); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink); }
        .view-toggle:hover { border-color: var(--ink-faint); }
        .view-toggle.active { background: var(--ink); border-color: var(--ink); color: #fff; }
        .download-group { margin-left: auto; display: flex; gap: 8px; }

        .agenda-list { border: 1.5px solid var(--border); border-radius: 12px; overflow: hidden; }
        .agenda-empty { padding: 48px 24px; text-align: center; color: var(--ink-faint); font-size: 15px; }
        .agenda-empty strong { display: block; color: var(--ink-soft); margin-bottom: 4px; font-size: 16px; font-weight: 600; }
        .agenda-item { display: grid; grid-template-columns: 90px 1fr; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.12s; }
        .agenda-item:last-child { border-bottom: none; }
        .agenda-item:hover { background: var(--off); }
        .agenda-date { padding: 16px 16px 16px 20px; border-right: 1px solid var(--border); background: var(--off); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 70px; }
        .agenda-date-day { font-family: var(--serif); font-size: 22px; font-weight: 700; line-height: 1; color: var(--ink); }
        .agenda-date-dow { font-size: 11px; font-weight: 700; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        .agenda-content { padding: 14px 20px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
        .agenda-title { font-size: 15px; font-weight: 600; color: var(--ink); }
        .agenda-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .agenda-organizer { font-size: 13px; font-weight: 500; color: var(--ink-soft); }
        .agenda-type-chip { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--magenta); background: #fdf0f4; border-radius: 100px; padding: 3px 10px; }
        .agenda-location { font-size: 12px; font-weight: 500; color: var(--ink-faint); }
        .agenda-multiday { font-size: 11px; font-weight: 500; color: var(--ink-faint); font-style: italic; }

        .year-month-section { margin-bottom: 36px; }
        .year-month-heading {
          font-family: var(--serif);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-soft);
          padding: 10px 0 8px;
          border-bottom: 2px solid var(--ink);
          margin-bottom: 8px;
          display: flex;
          align-items: baseline;
          gap: 10px;
        }
        .year-month-count { font-size: 11px; font-weight: 600; color: var(--ink-faint); letter-spacing: 0; }
        .year-month-empty { font-size: 13px; font-weight: 500; color: var(--ink-faint); padding: 12px 0; font-style: italic; }
        .loading-state { padding: 40px 24px; text-align: center; color: var(--ink-faint); font-size: 14px; font-weight: 500; }

        /* Calendar grid — mockup treatment: lighter cell fill, yellow
           chips instead of solid black, taller cells, tighter dow row. */
        .cal-grid { border-radius: 12px; overflow: hidden; }
        .cal-grid-loading { padding: 40px 24px; text-align: center; color: var(--ink-faint); font-size: 14px; font-weight: 500; }
        .cal-grid-dow { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 6px; }
        .cal-grid-dow-cell { padding: 6px 8px; text-align: center; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em; color: var(--ink-faint); }
        .cal-grid-body { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .cal-grid-cell {
          min-height: 108px;
          padding: 8px;
          border-radius: 8px;
          background: var(--off);
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: background 0.12s;
        }
        .cal-grid-cell-out { background: transparent; }
        .cal-grid-cell-out .cal-grid-daynum { color: var(--ink-faint); }
        .cal-grid-cell-today { border: 1.5px solid var(--magenta); background: #fdf0f4; }
        .cal-grid-daynum { font-size: 0.85rem; font-weight: 700; color: var(--ink); }
        .cal-grid-events { display: flex; flex-direction: column; gap: 3px; }
        .cal-grid-chip {
          display: block;
          width: 100%;
          text-align: left;
          background: var(--yellow);
          color: #171614;
          border: none;
          border-radius: 5px;
          padding: 3px 7px;
          font-size: 0.7rem;
          font-weight: 600;
          font-family: var(--sans);
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: background 0.12s;
        }
        .cal-grid-chip:hover { background: #e6b910; }
        .cal-grid-more { font-size: 0.66rem; font-weight: 600; color: var(--ink-faint); padding: 0 2px; }
        @media (max-width: 900px) {
          .cal-grid-cell { min-height: 80px; padding: 6px; }
          .cal-grid-chip { font-size: 0.62rem; }
        }

        /* Upcoming list — new section under calendar view */
        .upcoming-section { margin-top: 32px; }
        .upcoming-heading {
          font-family: var(--serif);
          font-size: 1.5rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.01em;
          margin-bottom: 16px;
          color: var(--ink);
        }
        .upcoming-list { display: flex; flex-direction: column; gap: 10px; }
        .upcoming-item {
          display: grid;
          grid-template-columns: 64px 1fr;
          align-items: center;
          gap: 16px;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          padding: 14px 18px;
          cursor: pointer;
          transition: border-color 0.12s, background 0.12s;
        }
        .upcoming-item:hover { border-color: var(--ink-faint); background: var(--off); }
        .upcoming-date {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--ink);
          border-radius: 8px;
          padding: 8px 4px;
          color: #fff;
        }
        .upcoming-date-month { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; color: #9A968C; }
        .upcoming-date-day { font-family: var(--serif); font-size: 1.15rem; font-weight: 700; line-height: 1.1; }
        .upcoming-content { min-width: 0; }
        .upcoming-title { font-size: 15px; font-weight: 600; color: var(--ink); }
        .upcoming-meta { margin-top: 2px; font-size: 13px; color: var(--ink-soft); }
        .upcoming-multiday { font-style: italic; }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(23,22,20,0.55); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal { background: #fff; border-radius: 16px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.2); }
        .modal-detail { max-width: 520px; }
        .modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 28px 28px 0; gap: 12px; }
        .modal-header h2 { font-family: var(--serif); font-size: 1.4rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em; margin-top: 6px; color: var(--ink); }
        .close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--ink-faint); padding: 4px; line-height: 1; flex-shrink: 0; border-radius: 6px; transition: background 0.15s, color 0.15s; }
        .close-btn:hover { color: var(--ink); background: var(--off); }
        .modal-form { padding: 22px 28px 28px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group.full { grid-column: 1 / -1; }
        .form-group label { font-size: 13px; font-weight: 600; color: var(--ink); }
        .optional { font-weight: 400; color: var(--ink-faint); }
        .form-group input, .form-group select, .form-group textarea {
          border: 1.5px solid var(--border);
          border-radius: 8px;
          padding: 10px 13px;
          font-size: 14px;
          font-family: inherit;
          color: var(--ink);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          background: #fff;
        }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
          border-color: var(--ink);
          box-shadow: 0 0 0 3px rgba(23,22,20,0.06);
        }
        .form-group textarea { resize: vertical; }
        .checkboxes { flex-direction: column; justify-content: flex-end; gap: 10px; }
        .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; cursor: pointer; color: var(--ink); }
        .checkbox-label input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--ink); }
        .submitter-confirm { display: flex; align-items: center; gap: 8px; margin-top: 18px; padding: 11px 14px; background: var(--off); border-radius: 8px; font-size: 13px; }
        .submitter-confirm-label { font-weight: 700; color: var(--ink-soft); white-space: nowrap; }
        .submitter-confirm-value { color: var(--ink); font-weight: 500; }
        .form-error { color: var(--magenta); font-size: 13px; font-weight: 500; margin-top: 10px; padding: 10px 12px; background: #fdf0f4; border-radius: 8px; }
        .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
        .event-type-badge { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--magenta); background: #fdf0f4; border-radius: 100px; padding: 4px 11px; display: inline-block; margin-bottom: 6px; }
        .detail-body { padding: 20px 28px 28px; }
        .detail-row { margin-bottom: 16px; font-size: 14px; }
        .detail-label { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 4px; }
        .detail-value { font-size: 1rem; font-weight: 400; color: var(--ink); }
        .detail-value strong { font-weight: 600; }
        .detail-sub { color: var(--ink-soft); font-size: 13px; font-weight: 500; margin-top: 2px; }
        .detail-tags { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 16px; }
        .tag { font-size: 12px; font-weight: 700; border: 1.5px solid var(--border); border-radius: 5px; padding: 3px 10px; color: var(--ink-soft); }
        .detail-section { margin-top: 18px; }
        .detail-section h4 { font-family: var(--serif); font-size: 0.72rem; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
        .detail-section p { font-size: 14px; font-weight: 400; color: var(--ink); line-height: 1.6; }
        .needs-section { background: #fffbf0; border-radius: 8px; padding: 12px 14px; border-left: 3px solid var(--yellow); }
        .needs-section h4 { color: #a07b00; }
        .needs-section p { color: var(--ink-soft); }
        .contact-section { background: var(--off); border-radius: 8px; padding: 12px 14px; }
        .contact-section a { color: var(--ink); text-decoration: underline; }
        @media (max-width: 560px) {
          .std-header { flex-direction: column; }
          .form-grid { grid-template-columns: 1fr; }
          .form-group.full { grid-column: 1; }
          .cal-card { padding: 14px 16px; }
          .cal-controls-row { gap: 6px; }
          .download-group { margin-left: 0; margin-top: 10px; width: 100%; justify-content: flex-start; }
          .upcoming-item { grid-template-columns: 52px 1fr; padding: 12px 14px; }
        }
      `}</style>

      <div className="std-page">
        <div className="std-header">
          <div>
            <span className="std-eyebrow">Planning</span>
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

        <div className="cal-card">
          <div className="cal-topbar">
            <div className="cal-topbar-left">
              <button className="cal-nav" onClick={prevPeriod} aria-label="Previous">‹</button>
              <button className="cal-nav" onClick={nextPeriod} aria-label="Next">›</button>
              <span className="cal-month-label">{displayLabel}</span>
            </div>
            {displayMode === 'calendar' && (
              <button className="cal-today-btn" onClick={goToToday} disabled={isShowingCurrentMonth}>
                Today
              </button>
            )}
          </div>

          <div className="cal-controls-row">
            <div className="mode-toggle" style={{ margin: 0 }}>
              <button
                className={`mode-toggle-btn${displayMode === 'calendar' ? ' active' : ''}`}
                onClick={() => setDisplayMode('calendar')}
              >
                Calendar
              </button>
              <button
                className={`mode-toggle-btn${displayMode === 'list' ? ' active' : ''}`}
                onClick={() => setDisplayMode('list')}
              >
                List
              </button>
            </div>
            {displayMode === 'list' && (
              <button
                className={`view-toggle${view === 'year' ? ' active' : ''}`}
                onClick={toggleListPeriod}
              >
                Year
              </button>
            )}
            <div className="download-group">
              <button className="btn-outline" onClick={() => downloadCSV(allEvents)}>⬇ CSV</button>
              <button className="btn-outline" onClick={() => downloadPDF(allEvents, displayLabel)}>⬇ PDF</button>
            </div>
          </div>

          {displayMode === 'calendar' && (
            <CalendarGrid
              month={month}
              year={year}
              events={events}
              loading={loading}
              onSelect={setSelectedEvent}
            />
          )}

          {displayMode === 'list' && view === 'month' && (
            <div className="agenda-list">
              <AgendaList
                events={events}
                loading={loading}
                emptyLabel={`No events saved for ${MONTH_NAMES[month]} ${year}`}
                onSelect={setSelectedEvent}
              />
            </div>
          )}

          {displayMode === 'list' && view === 'year' && (
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

        {/* Upcoming list — only shown in Calendar mode, mirrors the mockup */}
        {displayMode === 'calendar' && (
          <UpcomingList events={yearEvents} onSelect={setSelectedEvent} />
        )}
      </div>

      {showAdd && (
        <AddEventModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            if (periodMode === 'month') fetchMonthEvents()
            else fetchYearEvents()
            // Keep the Upcoming list's source data fresh too, since it
            // always reads from yearEvents regardless of period mode.
            fetchYearEvents()
          }}
          prefill={prefill}
        />
      )}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  )
}

// ─── Agenda List (unchanged) ────────────────────────────────────────────────
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
                {ev.organizer && <span className="agenda-organizer">{ev.organizer}</span>}
                <span className="agenda-type-chip">{ev.event_type}</span>
              </div>
              {ev.location_name && (
                <div className="agenda-location">@ {ev.location_name}</div>
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
