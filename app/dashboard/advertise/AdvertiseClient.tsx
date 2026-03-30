'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Ad = {
  id: string
  headline: string | null
  ad_copy: string | null
  content: string | null
  ad_image_url: string | null
  button_text: string | null
  button_link: string | null
  start_date: string
  end_date: string
  duration: number
  price: number
  payment_status: string
  status: string
  views: number
  clicks: number
  created_at: string
}

type Props = {
  userId: string
  initialAds: Ad[]
  successParam: boolean
  cancelledAdId: string | null
}

const EMPTY_FORM = {
  headline: '',
  ad_copy: '',
  content: '',
  ad_image_url: '',
  button_text: '',
  button_link: '',
  start_date: new Date().toISOString().split('T')[0],
  duration: 5,
}

function calcEndDate(start: string, duration: number): string {
  const d = new Date(start + 'T12:00:00')
  d.setDate(d.getDate() + duration - 1)
  return d.toISOString().split('T')[0]
}

function formatDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length
}

export default function AdvertiseClient({ userId, initialAds, successParam, cancelledAdId }: Props) {
  const [ads, setAds] = useState<Ad[]>(initialAds)
  const [showForm, setShowForm] = useState(initialAds.length === 0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const price = form.duration === 5 ? '$10' : '$15'
  const endDate = calcEndDate(form.start_date, form.duration)
  const canSubmit = form.headline && form.ad_copy && form.button_text && form.button_link && form.start_date && !uploading

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return }

    setUploading(true)
    setError('')
    const ext = file.name.split('.').pop()
    const path = `${userId}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('advertisements').upload(path, file, { upsert: true })
    if (upErr) { setError('Upload failed — try again'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('advertisements').getPublicUrl(path)
    setForm(f => ({ ...f, ad_image_url: publicUrl }))
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/stripe/advertise/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Something went wrong'); setSubmitting(false); return }
    window.location.href = json.url
  }

  // Delete a cancelled (unpaid) draft ad
  async function deleteDraft(adId: string) {
    await supabase.from('advertisements').delete().eq('id', adId).eq('payment_status', 'pending')
    setAds(a => a.filter(x => x.id !== adId))
  }

  const adStatusLabel = (ad: Ad) => {
    const today = new Date().toISOString().split('T')[0]
    if (ad.payment_status !== 'paid') return { label: 'Pending Payment', color: '#b8860b', bg: '#fef9e7' }
    if (today < ad.start_date) return { label: 'Scheduled', color: '#1d6fa4', bg: '#e8f4fb' }
    if (today >= ad.start_date && today <= ad.end_date) return { label: 'Active', color: '#2d7a2d', bg: '#eafaf1' }
    return { label: 'Ended', color: '#6b6560', bg: '#f5f4f1' }
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #b8b3ad;
          --white: #ffffff; --off: #f5f4f1; --warm: #f2ede6;
          --accent: #C80650; --gold: #FFCE03; --border: rgba(0,0,0,0.1);
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        body { background: var(--off); color: var(--ink); font-family: var(--sans); }

        .adv-wrap { max-width: 1100px; margin: 0 auto; padding: 32px 24px 80px; }
        .adv-topbar { background: var(--white); border-bottom: 1px solid var(--border); padding: 0 24px; height: 52px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 100; }
        .adv-back { font-size: 0.78rem; color: var(--ink-soft); text-decoration: none; display: flex; align-items: center; gap: 6px; }
        .adv-back:hover { color: var(--ink); }
        .adv-wordmark { font-family: var(--serif); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-faint); }
        .adv-wordmark em { font-style: normal; color: var(--accent); }

        .adv-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 32px; }
        .adv-title { font-family: var(--serif); font-size: 2rem; font-weight: 700; text-transform: uppercase; line-height: 1; }
        .adv-sub { font-size: 0.85rem; color: var(--ink-soft); margin-top: 6px; font-weight: 300; }
        .adv-new-btn { display: inline-flex; align-items: center; gap: 7px; background: var(--gold); color: var(--ink); font-family: var(--serif); font-size: 0.82rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding: 12px 22px; border-radius: 8px; border: none; cursor: pointer; transition: opacity 0.15s; }
        .adv-new-btn:hover { opacity: 0.88; }

        /* SUCCESS / NOTICE BANNERS */
        .adv-notice { padding: 12px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 500; margin-bottom: 24px; }
        .adv-notice.success { background: #eafaf1; color: #2d7a2d; border: 1px solid rgba(45,122,45,0.2); }
        .adv-notice.warning { background: #fef9e7; color: #8a6800; border: 1px solid rgba(255,206,3,0.3); }

        /* AD LIST */
        .ad-list { display: grid; gap: 16px; margin-bottom: 40px; }
        .ad-card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: grid; grid-template-columns: 1fr auto; }
        .ad-card-body { padding: 20px 20px 16px; display: flex; flex-direction: column; gap: 8px; }
        .ad-card-img { width: 140px; object-fit: cover; flex-shrink: 0; }
        .ad-card-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .ad-badge { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; border-radius: 100px; }
        .ad-headline { font-family: var(--serif); font-size: 1.1rem; font-weight: 600; text-transform: uppercase; }
        .ad-copy { font-size: 0.82rem; color: var(--ink-soft); line-height: 1.5; }
        .ad-meta-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 0.72rem; color: var(--ink-faint); margin-top: 4px; }
        .ad-stat { display: flex; align-items: center; gap: 4px; }
        .ad-stat strong { color: var(--ink); font-weight: 600; }
        .ad-delete { font-size: 0.72rem; color: var(--accent); background: none; border: none; cursor: pointer; text-decoration: underline; margin-top: 8px; align-self: flex-start; }

        /* FORM LAYOUT */
        .adv-form-wrap { background: var(--white); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
        .adv-form-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .adv-form-title { font-family: var(--serif); font-size: 1.2rem; font-weight: 600; text-transform: uppercase; }
        .adv-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
        .adv-fields { padding: 24px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 18px; overflow-y: auto; max-height: 80vh; }
        .adv-preview-pane { padding: 24px; background: var(--off); display: flex; flex-direction: column; gap: 16px; position: sticky; top: 52px; }

        .adv-field label { display: block; font-size: 0.62rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #374151; margin-bottom: 6px; }
        .adv-field input, .adv-field textarea, .adv-field select {
          width: 100%; padding: 11px 14px; border: 1.5px solid var(--border);
          border-radius: 8px; font-family: var(--sans); font-size: 0.88rem;
          color: var(--ink); background: var(--white); outline: none; transition: border-color 0.15s;
        }
        .adv-field input:focus, .adv-field textarea:focus, .adv-field select:focus { border-color: var(--accent); }
        .adv-field .hint { font-size: 0.68rem; color: var(--ink-faint); margin-top: 4px; }
        .adv-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .upload-btn { width: 100%; padding: 14px; border: 2px dashed var(--border); border-radius: 8px; background: var(--off); cursor: pointer; font-family: var(--sans); font-size: 0.82rem; color: var(--ink-soft); transition: border-color 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .upload-btn:hover { border-color: var(--gold); }
        .img-preview { position: relative; border-radius: 8px; overflow: hidden; }
        .img-preview img { width: 100%; height: 140px; object-fit: cover; display: block; }
        .img-remove { position: absolute; top: 8px; right: 8px; background: var(--accent); color: white; border: none; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; }

        .price-strip { background: var(--off); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
        .price-strip-label { font-size: 0.72rem; color: var(--ink-faint); }
        .price-strip-amount { font-family: var(--serif); font-size: 1.4rem; font-weight: 700; }
        .price-strip-dates { font-size: 0.72rem; color: var(--ink-soft); margin-top: 2px; }

        .adv-submit { width: 100%; padding: 15px; background: var(--accent); color: white; border: none; border-radius: 8px; font-family: var(--serif); font-size: 0.95rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.15s; }
        .adv-submit:hover:not(:disabled) { opacity: 0.88; }
        .adv-submit:disabled { opacity: 0.45; cursor: not-allowed; }
        .adv-error { font-size: 0.78rem; color: var(--accent); padding: 4px 0; }

        /* LIVE PREVIEW CARD */
        .preview-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 10px; }
        .preview-card { background: #1a1814; border-radius: 10px; overflow: hidden; }
        .preview-content { padding: 20px 22px; display: flex; flex-direction: column; gap: 10px; }
        .preview-sponsored { display: inline-block; background: var(--gold); color: #1a1814; font-size: 0.55rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 2px 8px; border-radius: 100px; }
        .preview-headline { font-family: var(--serif); font-size: 1.2rem; font-weight: 700; text-transform: uppercase; color: white; line-height: 1.1; }
        .preview-copy { font-size: 0.78rem; color: rgba(255,255,255,0.7); font-weight: 300; line-height: 1.5; }
        .preview-content-text { font-size: 0.72rem; color: rgba(255,255,255,0.45); line-height: 1.5; }
        .preview-cta { display: inline-flex; align-items: center; gap: 5px; background: var(--accent); color: white; font-family: var(--serif); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 8px 14px; border-radius: 5px; }
        .preview-img { width: 100%; max-height: 140px; object-fit: cover; display: block; }
        .preview-placeholder { width: 100%; height: 100px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-size: 0.72rem; color: rgba(255,255,255,0.2); }

        @media (max-width: 860px) {
          .adv-form-grid { grid-template-columns: 1fr; }
          .adv-fields { max-height: none; border-right: none; border-bottom: 1px solid var(--border); }
          .adv-preview-pane { position: static; }
          .ad-card-img { width: 100px; }
        }
        @media (max-width: 640px) {
          .adv-wrap { padding: 20px 16px 80px; }
          .adv-2col { grid-template-columns: 1fr; }
          .adv-form-grid { grid-template-columns: 1fr; }
          .ad-card { grid-template-columns: 1fr; }
          .ad-card-img { width: 100%; height: 120px; }
        }
      `}</style>

      {/* Topbar */}
      <header className="adv-topbar">
        <a href="/dashboard" className="adv-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Dashboard
        </a>
        <span style={{ flex: 1 }} />
        <span className="adv-wordmark"><em>785</em>MAGAZINE</span>
      </header>

      <div className="adv-wrap">

        {/* Header */}
        <div className="adv-header">
          <div>
            <h1 className="adv-title">Advertise</h1>
            <p className="adv-sub">Promote your business or event to the Topeka community.</p>
          </div>
          {ads.length > 0 && !showForm && (
            <button className="adv-new-btn" onClick={() => setShowForm(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Place New Ad
            </button>
          )}
        </div>

        {/* Success notice */}
        {successParam && (
          <div className="adv-notice success">
            ✓ Payment confirmed — your ad is now live and will appear on the home page and events page.
          </div>
        )}

        {/* Cancelled notice + cleanup */}
        {cancelledAdId && (
          <div className="adv-notice warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Checkout cancelled — your draft ad was not published.</span>
            <button onClick={() => deleteDraft(cancelledAdId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#8a6800', textDecoration: 'underline' }}>
              Remove draft
            </button>
          </div>
        )}

        {/* Existing ads */}
        {ads.length > 0 && (
          <div className="ad-list">
            {ads.map(ad => {
              const { label, color, bg } = adStatusLabel(ad)
              return (
                <div key={ad.id} className="ad-card">
                  <div className="ad-card-body">
                    <div className="ad-card-top">
                      <span className="ad-badge" style={{ background: bg, color }}>{label}</span>
                      {ad.payment_status === 'paid' && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--ink-faint)' }}>
                          {formatDate(ad.start_date)} → {formatDate(ad.end_date)}
                        </span>
                      )}
                    </div>
                    {ad.headline && <div className="ad-headline">{ad.headline}</div>}
                    {ad.ad_copy && <div className="ad-copy">{ad.ad_copy}</div>}
                    <div className="ad-meta-row">
                      <span className="ad-stat"><strong>{ad.views}</strong> views</span>
                      <span className="ad-stat"><strong>{ad.clicks}</strong> clicks</span>
                      {ad.clicks > 0 && ad.views > 0 && (
                        <span className="ad-stat"><strong>{((ad.clicks / ad.views) * 100).toFixed(1)}%</strong> CTR</span>
                      )}
                      <span>${(ad.price / 100).toFixed(0)} · {ad.duration} days</span>
                    </div>
                    {ad.payment_status === 'pending' && (
                      <button className="ad-delete" onClick={() => deleteDraft(ad.id)}>Delete draft</button>
                    )}
                  </div>
                  {ad.ad_image_url && (
                    <img src={ad.ad_image_url} alt={ad.headline || ''} className="ad-card-img" />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="adv-form-wrap">
            <div className="adv-form-header">
              <span className="adv-form-title">Create Your Ad</span>
              {ads.length > 0 && (
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: '1.2rem' }}>✕</button>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="adv-form-grid">

                {/* ── Fields ── */}
                <div className="adv-fields">

                  <div className="adv-field">
                    <label>Headline <span style={{ color: 'var(--accent)' }}>*</span></label>
                    <input
                      type="text"
                      placeholder="Your business name, event, or tagline"
                      maxLength={60}
                      value={form.headline}
                      onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                      required
                    />
                    <span className="hint">{form.headline.length}/60 characters</span>
                  </div>

                  <div className="adv-field">
                    <label>Ad Copy <span style={{ color: 'var(--accent)' }}>*</span></label>
                    <textarea
                      rows={3}
                      placeholder="Main message — keep it punchy (max 20 words)"
                      value={form.ad_copy}
                      onChange={e => {
                        const w = e.target.value.trim().split(/\s+/).filter(Boolean).length
                        if (w <= 20 || e.target.value.length < form.ad_copy.length) {
                          setForm(f => ({ ...f, ad_copy: e.target.value }))
                        }
                      }}
                      required
                    />
                    <span className="hint">{wordCount(form.ad_copy)}/20 words</span>
                  </div>

                  <div className="adv-field">
                    <label>Additional Content <span style={{ color: 'var(--ink-faint)' }}>(optional)</span></label>
                    <textarea
                      rows={2}
                      placeholder="Supporting description (max 40 words)"
                      value={form.content}
                      onChange={e => {
                        const w = e.target.value.trim().split(/\s+/).filter(Boolean).length
                        if (w <= 40 || e.target.value.length < form.content.length) {
                          setForm(f => ({ ...f, content: e.target.value }))
                        }
                      }}
                    />
                    <span className="hint">{wordCount(form.content)}/40 words</span>
                  </div>

                  <div className="adv-field">
                    <label>Ad Image <span style={{ color: 'var(--ink-faint)' }}>(optional, max 5MB)</span></label>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} style={{ display: 'none' }} />
                    {form.ad_image_url ? (
                      <div className="img-preview">
                        <img src={form.ad_image_url} alt="Preview" />
                        <button type="button" className="img-remove" onClick={() => setForm(f => ({ ...f, ad_image_url: '' }))}>✕</button>
                      </div>
                    ) : (
                      <button type="button" className="upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                        </svg>
                        {uploading ? 'Uploading…' : 'Upload image'}
                      </button>
                    )}
                  </div>

                  <div className="adv-2col">
                    <div className="adv-field">
                      <label>Button Text <span style={{ color: 'var(--accent)' }}>*</span></label>
                      <input
                        type="text"
                        placeholder="Learn More"
                        maxLength={30}
                        value={form.button_text}
                        onChange={e => setForm(f => ({ ...f, button_text: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="adv-field">
                      <label>Button Link <span style={{ color: 'var(--accent)' }}>*</span></label>
                      <input
                        type="url"
                        placeholder="https://"
                        value={form.button_link}
                        onChange={e => setForm(f => ({ ...f, button_link: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="adv-2col">
                    <div className="adv-field">
                      <label>Start Date <span style={{ color: 'var(--accent)' }}>*</span></label>
                      <input
                        type="date"
                        value={form.start_date}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="adv-field">
                      <label>Package <span style={{ color: 'var(--accent)' }}>*</span></label>
                      <select
                        value={form.duration}
                        onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) }))}
                      >
                        <option value={5}>5 Days — $10</option>
                        <option value={14}>14 Days — $15</option>
                      </select>
                    </div>
                  </div>

                  {/* Price strip */}
                  <div className="price-strip">
                    <div>
                      <div className="price-strip-label">Total · {form.duration}-day banner placement</div>
                      <div className="price-strip-dates" style={{ marginTop: 3 }}>
                        {formatDate(form.start_date)} → {formatDate(endDate)}
                      </div>
                    </div>
                    <div className="price-strip-amount">{price}</div>
                  </div>

                  {error && <div className="adv-error">{error}</div>}

                  <button type="submit" className="adv-submit" disabled={!canSubmit || submitting}>
                    {submitting ? 'Redirecting to checkout…' : `Pay ${price} & Go Live`}
                  </button>

                  <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', textAlign: 'center', lineHeight: 1.5 }}>
                    Secure checkout via Stripe. Your ad activates immediately after payment.
                    Appears on the home page and events page.
                  </p>
                </div>

                {/* ── Live Preview ── */}
                <div className="adv-preview-pane">
                  <div className="preview-label">Live Preview</div>
                  <div className="preview-card">
                    {form.ad_image_url && (
                      <img src={form.ad_image_url} alt="Preview" className="preview-img" />
                    )}
                    {!form.ad_image_url && (
                      <div className="preview-placeholder">Image will appear here</div>
                    )}
                    <div className="preview-content">
                      <span className="preview-sponsored">Sponsored</span>
                      {form.headline
                        ? <div className="preview-headline">{form.headline}</div>
                        : <div className="preview-headline" style={{ color: 'rgba(255,255,255,0.2)' }}>Your headline</div>
                      }
                      {form.ad_copy && <div className="preview-copy">{form.ad_copy}</div>}
                      {form.content && <div className="preview-content-text">{form.content}</div>}
                      {form.button_text && (
                        <div>
                          <span className="preview-cta">
                            {form.button_text}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                            </svg>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', lineHeight: 1.6 }}>
                    This ad will appear on the <strong style={{ color: 'var(--ink-soft)' }}>home page</strong> (below featured events) and the <strong style={{ color: 'var(--ink-soft)' }}>events page</strong> (between event groups).
                  </div>
                </div>

              </div>
            </form>
          </div>
        )}

        {/* Empty state */}
        {ads.length === 0 && !showForm && (
          <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--white)', borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--border)', marginBottom: 16 }}>$</div>
            <p style={{ fontFamily: 'var(--serif)', fontSize: '1.2rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>No Ads Yet</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: 24 }}>
              Reach the Topeka community with a banner placement — from $10 for 5 days.
            </p>
            <button className="adv-new-btn" onClick={() => setShowForm(true)}>
              Place Your First Ad
            </button>
          </div>
        )}

      </div>
    </>
  )
}
