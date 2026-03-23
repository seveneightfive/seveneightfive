'use client'

import { useState } from 'react'

// ─── Exact types from public.opportunity_types (7 active rows) ─────────────────
const OPPORTUNITY_TYPES = [
  { slug: 'gig',            label: 'Gig',             hint: 'A one-time or short-term paid performance or job' },
  { slug: 'grant',          label: 'Grant',            hint: 'Funding for a project, program, or individual artist' },
  { slug: 'residency',      label: 'Residency',        hint: 'Time + space for an artist to develop their work' },
  { slug: 'call_for_artists', label: 'Call for Artists', hint: 'Seeking work for an exhibition, publication, or project' },
  { slug: 'collaboration',  label: 'Collaboration',    hint: 'Looking for a creative partner or co-creator' },
  { slug: 'commission',     label: 'Commission',       hint: 'Hiring an artist to create a specific work' },
  { slug: 'open_call',      label: 'Open Call',        hint: 'General open invitation to submit work or proposals' },
]

// ─── Exact types from public.compensation_types (5 rows) ──────────────────────
const COMPENSATION_TYPES = [
  { slug: 'paid',          label: 'Paid',         is_paid: true },
  { slug: 'stipend',       label: 'Stipend',      is_paid: true },
  { slug: 'revenue_share', label: 'Revenue Share', is_paid: true },
  { slug: 'unpaid',        label: 'Unpaid / Volunteer', is_paid: false },
  { slug: 'unknown',       label: 'Not Specified', is_paid: false },
]

type FormState = {
  title: string
  excerpt: string
  description: string
  type_slug: string
  compensation_slug: string
  compensation_details: string
  organization_name: string
  location_name: string
  city: string
  state: string
  deadline_date: string
  end_date: string
  application_url: string
  application_email: string
}

const EMPTY: FormState = {
  title: '',
  excerpt: '',
  description: '',
  type_slug: '',
  compensation_slug: '',
  compensation_details: '',
  organization_name: '',
  location_name: '',
  city: 'Topeka',
  state: 'KS',
  deadline_date: '',
  end_date: '',
  application_url: '',
  application_email: '',
}

type Props = {
  userArtistId?: string   // pre-fill posted_by_artist if user has an artist profile
}

export default function OpportunitySubmitForm({ userArtistId }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))

  const selectedType = OPPORTUNITY_TYPES.find(t => t.slug === form.type_slug)
  const selectedComp = COMPENSATION_TYPES.find(c => c.slug === form.compensation_slug)
  const showCompDetails = form.compensation_slug && form.compensation_slug !== 'unknown'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.type_slug || !form.description.trim()) return
    setStatus('submitting')
    setErrorMsg('')
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          country: 'US',
          is_public: true,
          status: 'active',
          posted_by_artist: userArtistId ?? null,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus('success')
      setForm(EMPTY)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="oppf-success">
        <div className="oppf-success-icon">✓</div>
        <h2 className="oppf-success-title">Opportunity Submitted</h2>
        <p className="oppf-success-sub">
          We'll review it and publish shortly. Thanks for supporting Topeka artists.
        </p>
        <button className="oppf-btn" onClick={() => setStatus('idle')}>Submit Another</button>
        <style>{css}</style>
      </div>
    )
  }

  return (
    <>
      <style>{css}</style>
      <div className="oppf-page">
        <div className="oppf-header">
          <p className="oppf-eyebrow">Artist Directory · Opportunities</p>
          <h1 className="oppf-title">Post an Opportunity</h1>
          <p className="oppf-sub">
            Share gigs, grants, residencies, open calls, commissions, and collaborations with
            Topeka's creative community.
          </p>
        </div>

        <form className="oppf-form" onSubmit={handleSubmit} noValidate>

          {/* ── Step 1: Opportunity type ── */}
          <div className="oppf-section">
            <h3 className="oppf-section-title">What kind of opportunity is this?</h3>
            <div className="oppf-type-grid">
              {OPPORTUNITY_TYPES.map(t => (
                <button
                  key={t.slug}
                  type="button"
                  className={`oppf-type-btn${form.type_slug === t.slug ? ' selected' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type_slug: t.slug }))}
                >
                  <span className="oppf-type-label">{t.label}</span>
                  <span className="oppf-type-hint">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Step 2: Core details (shows after type is selected) ── */}
          {form.type_slug && (
            <>
              <div className="oppf-section">
                <h3 className="oppf-section-title">Details</h3>

                <div className="oppf-field">
                  <label className="oppf-label">
                    Title <span className="oppf-req">*</span>
                  </label>
                  <input
                    className="oppf-input"
                    type="text"
                    placeholder={
                      selectedType?.slug === 'gig' ? 'e.g. Live Painter Needed for Wedding'
                      : selectedType?.slug === 'grant' ? 'e.g. ArtsConnect Community Arts Grant 2026'
                      : selectedType?.slug === 'call_for_artists' ? 'e.g. Call for Artists: Downtown Mural Project'
                      : selectedType?.slug === 'commission' ? 'e.g. Commission: Portrait for New Library'
                      : 'Title of your opportunity'
                    }
                    value={form.title}
                    onChange={set('title')}
                    required
                  />
                </div>

                <div className="oppf-field">
                  <label className="oppf-label">
                    Description <span className="oppf-req">*</span>
                  </label>
                  <textarea
                    className="oppf-textarea"
                    rows={6}
                    placeholder="Describe the opportunity: what you're looking for, eligibility requirements, timeline, and any other relevant details."
                    value={form.description}
                    onChange={set('description')}
                    required
                  />
                </div>

                <div className="oppf-field">
                  <label className="oppf-label">
                    Short Summary <span className="oppf-label-note">(shown in listings)</span>
                  </label>
                  <input
                    className="oppf-input"
                    type="text"
                    maxLength={200}
                    placeholder="One sentence that describes this opportunity"
                    value={form.excerpt}
                    onChange={set('excerpt')}
                  />
                  <span className="oppf-char">{form.excerpt.length}/200</span>
                </div>
              </div>

              {/* ── Compensation ── */}
              <div className="oppf-section">
                <h3 className="oppf-section-title">Compensation</h3>
                <div className="oppf-comp-grid">
                  {COMPENSATION_TYPES.map(c => (
                    <button
                      key={c.slug}
                      type="button"
                      className={`oppf-comp-btn${form.compensation_slug === c.slug ? ' selected' : ''}${c.is_paid ? ' is-paid' : ''}`}
                      onClick={() => setForm(f => ({ ...f, compensation_slug: c.slug }))}
                    >
                      {c.is_paid && <span className="oppf-paid-dot" />}
                      {c.label}
                    </button>
                  ))}
                </div>
                {showCompDetails && (
                  <div className="oppf-field" style={{ marginTop: 12 }}>
                    <label className="oppf-label">Compensation Details</label>
                    <input
                      className="oppf-input"
                      type="text"
                      placeholder={
                        selectedComp?.slug === 'paid' ? 'e.g. $300 flat fee'
                        : selectedComp?.slug === 'stipend' ? 'e.g. $500 stipend + materials covered'
                        : selectedComp?.slug === 'revenue_share' ? 'e.g. 60/40 split on ticket sales'
                        : 'Add any compensation details'
                      }
                      value={form.compensation_details}
                      onChange={set('compensation_details')}
                    />
                  </div>
                )}
              </div>

              {/* ── Organization + Location ── */}
              <div className="oppf-section">
                <h3 className="oppf-section-title">Organization &amp; Location</h3>
                <div className="oppf-row">
                  <div className="oppf-field">
                    <label className="oppf-label">Organization Name</label>
                    <input
                      className="oppf-input"
                      type="text"
                      placeholder="Arts council, gallery, business…"
                      value={form.organization_name}
                      onChange={set('organization_name')}
                    />
                  </div>
                  <div className="oppf-field">
                    <label className="oppf-label">Venue / Location Name</label>
                    <input
                      className="oppf-input"
                      type="text"
                      placeholder="e.g. Nerman Museum"
                      value={form.location_name}
                      onChange={set('location_name')}
                    />
                  </div>
                </div>
                <div className="oppf-row">
                  <div className="oppf-field oppf-field--grow">
                    <label className="oppf-label">City</label>
                    <input className="oppf-input" type="text" value={form.city} onChange={set('city')} />
                  </div>
                  <div className="oppf-field oppf-field--sm">
                    <label className="oppf-label">State</label>
                    <input className="oppf-input" type="text" maxLength={2} value={form.state} onChange={set('state')} />
                  </div>
                </div>
              </div>

              {/* ── How to apply + Dates ── */}
              <div className="oppf-section">
                <h3 className="oppf-section-title">How to Apply</h3>
                <div className="oppf-row">
                  <div className="oppf-field">
                    <label className="oppf-label">Application URL</label>
                    <input
                      className="oppf-input"
                      type="url"
                      placeholder="https://…"
                      value={form.application_url}
                      onChange={set('application_url')}
                    />
                  </div>
                  <div className="oppf-field">
                    <label className="oppf-label">Application Email</label>
                    <input
                      className="oppf-input"
                      type="email"
                      placeholder="apply@organization.org"
                      value={form.application_email}
                      onChange={set('application_email')}
                    />
                  </div>
                </div>
                <div className="oppf-row">
                  <div className="oppf-field">
                    <label className="oppf-label">Application Deadline</label>
                    <input className="oppf-input" type="date" value={form.deadline_date} onChange={set('deadline_date')} />
                  </div>
                  <div className="oppf-field">
                    <label className="oppf-label">
                      Opportunity End / Closing Date
                      <span className="oppf-label-note"> (if different)</span>
                    </label>
                    <input className="oppf-input" type="date" value={form.end_date} onChange={set('end_date')} />
                  </div>
                </div>
              </div>

              {/* ── Error ── */}
              {status === 'error' && (
                <div className="oppf-error">{errorMsg}</div>
              )}

              {/* ── Submit ── */}
              <div className="oppf-footer">
                <p className="oppf-footer-note">
                  Submissions are reviewed before publishing. You'll be notified when your listing goes live.
                </p>
                <button
                  type="submit"
                  className="oppf-btn"
                  disabled={!form.title.trim() || !form.description.trim() || status === 'submitting'}
                >
                  {status === 'submitting' ? 'Submitting…' : 'Submit Opportunity →'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </>
  )
}

const css = `
.oppf-page, .oppf-page * { box-sizing: border-box; }
.oppf-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 40px 40px 80px;
  font-family: 'Oswald', 'Arial Narrow', sans-serif;
}
.oppf-eyebrow {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: #C80650; margin: 0 0 8px;
}
.oppf-title {
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  font-weight: 800; letter-spacing: 0.04em;
  text-transform: uppercase; color: #0A0A0A;
  margin: 0 0 10px; line-height: 1.1;
}
.oppf-sub {
  font-size: 14px; color: #6b7280;
  margin: 0 0 40px; font-family: sans-serif;
  line-height: 1.6;
}
.oppf-form { display: flex; flex-direction: column; gap: 36px; }

.oppf-section { display: flex; flex-direction: column; gap: 16px; }
.oppf-section-title {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: #374151; margin: 0;
  padding-bottom: 12px;
  border-bottom: 1.5px solid #e5e7eb;
}

/* Type selector grid */
.oppf-type-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.oppf-type-btn {
  display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
  padding: 12px 14px;
  border: 1.5px solid #e5e7eb; border-radius: 8px;
  background: #fff; cursor: pointer;
  text-align: left; transition: all 0.15s;
}
.oppf-type-btn:hover { border-color: #C80650; background: #fff5f7; }
.oppf-type-btn.selected {
  border-color: #C80650; background: #fff0f4;
  box-shadow: 0 0 0 3px rgba(200,6,80,0.08);
}
.oppf-type-label { font-size: 14px; font-weight: 700; color: #111; font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 0.04em; }
.oppf-type-hint { font-size: 11px; color: #6b7280; font-family: sans-serif; line-height: 1.3; }

/* Fields */
.oppf-field { display: flex; flex-direction: column; gap: 6px; flex: 1; position: relative; }
.oppf-field--grow { flex: 2; }
.oppf-field--sm { flex: 0 0 80px; }
.oppf-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #374151; }
.oppf-label-note { font-size: 10px; color: #9ca3af; font-weight: 400; text-transform: none; letter-spacing: 0; }
.oppf-req { color: #C80650; }
.oppf-input, .oppf-textarea {
  padding: 10px 14px;
  border: 1.5px solid #e5e7eb; border-radius: 6px;
  font-size: 14px; font-family: sans-serif;
  color: #111; background: #fff;
  outline: none; transition: border-color 0.2s;
  width: 100%;
}
.oppf-input:focus, .oppf-textarea:focus { border-color: #C80650; }
.oppf-textarea { resize: vertical; }
.oppf-char { font-size: 11px; color: #9ca3af; text-align: right; font-family: sans-serif; margin-top: -4px; }
.oppf-row { display: flex; gap: 14px; }

/* Compensation grid */
.oppf-comp-grid { display: flex; gap: 8px; flex-wrap: wrap; }
.oppf-comp-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  border: 1.5px solid #e5e7eb; border-radius: 999px;
  background: #fff; cursor: pointer;
  font-size: 12px; font-weight: 600;
  color: #374151; font-family: 'Oswald', sans-serif;
  letter-spacing: 0.04em; transition: all 0.15s;
}
.oppf-comp-btn:hover { border-color: #C80650; color: #C80650; }
.oppf-comp-btn.selected { border-color: #C80650; background: #fff0f4; color: #C80650; }
.oppf-comp-btn.is-paid.selected { border-color: #166534; background: #dcfce7; color: #166534; }
.oppf-paid-dot { width: 7px; height: 7px; border-radius: 50%; background: #16a34a; }

/* Footer */
.oppf-footer {
  display: flex; align-items: center;
  justify-content: space-between; gap: 20px;
  flex-wrap: wrap; padding-top: 8px;
  border-top: 1.5px solid #e5e7eb;
}
.oppf-footer-note { font-size: 12px; color: #9ca3af; margin: 0; font-family: sans-serif; flex: 1; min-width: 180px; line-height: 1.5; }
.oppf-btn {
  display: inline-block; padding: 13px 28px;
  background: #0A0A0A; color: #fff;
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  border: none; border-radius: 4px;
  cursor: pointer; transition: background 0.2s;
  font-family: 'Oswald', sans-serif; white-space: nowrap;
}
.oppf-btn:hover:not(:disabled) { background: #C80650; }
.oppf-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.oppf-error {
  background: #fef2f2; border: 1px solid #fecaca;
  color: #dc2626; padding: 12px 16px;
  border-radius: 6px; font-size: 13px; font-family: sans-serif;
}

/* Success */
.oppf-success {
  max-width: 480px; margin: 80px auto;
  text-align: center; padding: 40px;
  font-family: 'Oswald', sans-serif;
}
.oppf-success-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: #dcfce7; color: #166534;
  font-size: 24px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
}
.oppf-success-title { font-size: 1.8rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; margin: 0 0 8px; color: #0A0A0A; }
.oppf-success-sub { font-size: 14px; color: #6b7280; margin: 0 0 24px; font-family: sans-serif; line-height: 1.6; }

@media (max-width: 640px) {
  .oppf-page { padding: 24px 20px 60px; }
  .oppf-type-grid { grid-template-columns: 1fr; }
  .oppf-row { flex-direction: column; }
  .oppf-field--sm { flex: 1; }
  .oppf-footer { flex-direction: column; align-items: stretch; }
  .oppf-btn { text-align: center; }
}
`
