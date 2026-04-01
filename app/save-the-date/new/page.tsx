'use client'

// Public route: /save-the-date/new
// Standalone submission form — no account needed.
// On success, redirects back to /save-the-date with a ?submitted=1 param.

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

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

interface FormState {
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

const EMPTY: FormState = {
  title: '', organizer: '', event_date: '', event_end_date: '',
  start_time: '', end_time: '', event_type: 'Special Event',
  location_name: '', expected_capacity: '', about: '', needs: '',
  is_annual: false, is_nonprofit: false,
  submitter_name: '', submitter_email: '', submitter_phone: '',
}

export default function SaveTheDateNewPage() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: err } = await supabase.from('save_the_date').insert([{
      title:             form.title,
      organizer:         form.organizer,
      event_date:        form.event_date,
      event_end_date:    form.event_end_date   || null,
      start_time:        form.start_time        || null,
      end_time:          form.end_time           || null,
      event_type:        form.event_type,
      location_name:     form.location_name     || null,
      expected_capacity: form.expected_capacity ? parseInt(form.expected_capacity) : null,
      about:             form.about             || null,
      needs:             form.needs             || null,
      is_annual:         form.is_annual,
      is_nonprofit:      form.is_nonprofit,
      submitter_name:    form.submitter_name    || null,
      submitter_email:   form.submitter_email,
      submitter_phone:   form.submitter_phone   || null,
      status:            'pending',
    }])

    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <>
        <style>{CSS}</style>
        <div className="page">
          <div className="success-wrap">
            <div className="success-check">✓</div>
            <h1 className="success-title">Date Claimed!</h1>
            <p className="success-sub">
              <strong>"{form.title}"</strong> has been submitted for review.
              We'll add it to the community calendar once approved — usually within 24 hours.
            </p>
            <div className="success-actions">
              <a href="/save-the-date" className="btn-primary">View Calendar</a>
              <a href="/dashboard" className="btn-ghost">Back to Dashboard</a>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="page">

        {/* Header */}
        <div className="page-header">
          <a href="/save-the-date" className="back-link">← Community Calendar</a>
        </div>

        <div className="form-header">
          <div className="form-eyebrow">Community Calendar</div>
          <h1 className="form-title">CLAIM A DATE</h1>
          <p className="form-desc">
            Help Topeka avoid event conflicts. Add your date as soon as you know it —
            no full details required. No account needed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="form-card">

          <div className="form-section-label">Event Info</div>
          <div className="form-grid">
            <div className="form-group full">
              <label>Event Title <span className="req">*</span></label>
              <input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Name of your event" />
            </div>
            <div className="form-group full">
              <label>Organizer / Organization <span className="req">*</span></label>
              <input required value={form.organizer} onChange={e => set('organizer', e.target.value)} placeholder="Who's putting this on?" />
            </div>
            <div className="form-group">
              <label>Event Date <span className="req">*</span></label>
              <input type="date" required value={form.event_date} onChange={e => set('event_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>End Date <span className="opt">(if multi-day)</span></label>
              <input type="date" value={form.event_end_date} onChange={e => set('event_end_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Start Time</label>
              <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
            </div>
            <div className="form-group full">
              <label>Event Type <span className="req">*</span></label>
              <select value={form.event_type} onChange={e => set('event_type', e.target.value as SaveTheDateEventType)}>
                {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Location / Venue <span className="opt">(or TBD)</span></label>
              <input value={form.location_name} onChange={e => set('location_name', e.target.value)} placeholder="e.g. NOTO Arts District, TBD" />
            </div>
            <div className="form-group">
              <label>Expected Attendance</label>
              <input type="number" min="0" value={form.expected_capacity} onChange={e => set('expected_capacity', e.target.value)} placeholder="# of attendees" />
            </div>
            <div className="form-group checkboxes">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.is_annual} onChange={e => set('is_annual', e.target.checked)} />
                Annual event
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.is_nonprofit} onChange={e => set('is_nonprofit', e.target.checked)} />
                Nonprofit
              </label>
            </div>
            <div className="form-group full">
              <label>About <span className="opt">(optional)</span></label>
              <textarea rows={3} value={form.about} onChange={e => set('about', e.target.value)} placeholder="Brief description of the event..." />
            </div>
            <div className="form-group full">
              <label>What do you still need? <span className="opt">(venue, sponsors, volunteers, etc.)</span></label>
              <textarea rows={2} value={form.needs} onChange={e => set('needs', e.target.value)} placeholder="e.g. Looking for a venue that seats 300+" />
            </div>
          </div>

          <div className="form-section-label" style={{ marginTop: 24 }}>Your Info</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Your Name</label>
              <input value={form.submitter_name} onChange={e => set('submitter_name', e.target.value)} placeholder="Full name" />
            </div>
            <div className="form-group">
              <label>Phone <span className="opt">(optional)</span></label>
              <input type="tel" value={form.submitter_phone} onChange={e => set('submitter_phone', e.target.value)} placeholder="(785) 000-0000" />
            </div>
            <div className="form-group full">
              <label>Email <span className="req">*</span></label>
              <input required type="email" value={form.submitter_email} onChange={e => set('submitter_email', e.target.value)} placeholder="your@email.com" />
              <span className="field-hint">We'll notify you when your date is approved. Not shared publicly.</span>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <a href="/save-the-date" className="btn-ghost">Cancel</a>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Claim This Date'}
            </button>
          </div>

        </form>

        <p className="fine-print">
          Submissions are reviewed before appearing on the calendar — usually within 24 hours.
          Questions? Email <a href="mailto:kerrice@seveneightfive.com">kerrice@seveneightfive.com</a>
        </p>

      </div>
    </>
  )
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:     #f5f4f1;
    --white:  #ffffff;
    --text:   #1a1a1a;
    --muted:  #6b6b6b;
    --hint:   #aaaaaa;
    --border: rgba(0,0,0,0.08);
    --borders:rgba(0,0,0,0.12);
    --brand:  #C80650;
    --yellow: #FFCE03;
    --serif:  'Oswald', sans-serif;
    --sans:   'DM Sans', system-ui, sans-serif;
  }
  html, body { background: var(--bg); color: var(--text); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

  .page { max-width: 640px; margin: 0 auto; padding: 0 20px 80px; }

  .page-header { padding: 20px 0 0; }
  .back-link { font-size: 0.75rem; color: var(--muted); text-decoration: none; font-weight: 500; }
  .back-link:hover { color: var(--text); }

  .form-header { padding: 24px 0 28px; }
  .form-eyebrow { font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brand); font-weight: 700; margin-bottom: 4px; }
  .form-title { font-family: var(--serif); font-size: 2.2rem; font-weight: 700; line-height: 1; color: var(--text); margin-bottom: 10px; }
  .form-desc { font-size: 0.88rem; color: var(--muted); line-height: 1.6; }

  .form-card { background: var(--white); border: 0.5px solid var(--borders); border-radius: 14px; padding: 24px; }

  .form-section-label { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--hint); margin-bottom: 14px; padding-bottom: 8px; border-bottom: 0.5px solid var(--border); }

  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-group.full { grid-column: 1 / -1; }
  .form-group label { font-size: 0.75rem; font-weight: 600; color: var(--text); }
  .req { color: var(--brand); }
  .opt { font-weight: 400; color: var(--hint); }
  .form-group input, .form-group select, .form-group textarea {
    border: 0.5px solid var(--borders); border-radius: 8px; padding: 9px 12px;
    font-size: 0.88rem; font-family: var(--sans); color: var(--text);
    outline: none; transition: border-color 0.15s; background: var(--white);
  }
  .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--text); }
  .form-group textarea { resize: vertical; }
  .field-hint { font-size: 0.68rem; color: var(--hint); margin-top: 3px; }
  .checkboxes { flex-direction: column; justify-content: flex-end; gap: 10px; }
  .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 500; cursor: pointer; color: var(--text); }
  .checkbox-label input { width: 15px; height: 15px; cursor: pointer; accent-color: var(--brand); }

  .form-error { background: #fce8ef; color: var(--brand); font-size: 0.82rem; padding: 10px 14px; border-radius: 8px; margin-top: 16px; }

  .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
  .btn-primary { background: var(--brand); color: #fff; border: none; padding: 11px 20px; font-size: 0.88rem; font-weight: 700; border-radius: 8px; cursor: pointer; font-family: var(--serif); letter-spacing: 0.04em; text-transform: uppercase; text-decoration: none; display: inline-block; }
  .btn-primary:hover { opacity: 0.9; }
  .btn-primary:disabled { opacity: 0.4; cursor: default; }
  .btn-ghost { background: none; color: var(--muted); border: 0.5px solid var(--borders); padding: 11px 16px; font-size: 0.82rem; font-weight: 600; border-radius: 8px; cursor: pointer; text-decoration: none; display: inline-block; font-family: var(--sans); }
  .btn-ghost:hover { color: var(--text); border-color: var(--text); }

  .fine-print { font-size: 0.72rem; color: var(--hint); text-align: center; margin-top: 20px; line-height: 1.5; }
  .fine-print a { color: var(--muted); }

  .success-wrap { text-align: center; padding: 80px 20px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .success-check { width: 56px; height: 56px; border-radius: 50%; background: #eafaf1; color: #1e7e34; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; }
  .success-title { font-family: var(--serif); font-size: 2rem; font-weight: 700; color: var(--text); }
  .success-sub { font-size: 0.95rem; color: var(--muted); max-width: 420px; line-height: 1.6; }
  .success-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }

  @media (max-width: 560px) {
    .form-grid { grid-template-columns: 1fr; }
    .form-group.full { grid-column: 1; }
    .form-card { padding: 18px 16px; }
  }
`
