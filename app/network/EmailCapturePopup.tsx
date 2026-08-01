'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface EmailCapturePopupProps {
  onClose: () => void
  sourcePage: string
}

// Edit these two lines to change what the popup says — no other code
// needs to change.
const POPUP_HEADLINE = 'Get connected to your artist profile'
const POPUP_BODY =
  "Enter your email or phone and we'll follow up to link this to your artist profile on seveneightfive.com — so you can claim it, update it, or get notified when someone connects with you."

export default function EmailCapturePopup({ onClose, sourcePage }: EmailCapturePopupProps) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim() && !phone.trim()) {
      setError('Enter an email or phone number to continue.')
      return
    }

    setSaving(true)
    const personId = localStorage.getItem('network_person_id')

    const { error: err } = await supabase.rpc('capture_network_lead', {
      p_person_id: personId,
      p_email: email.trim(),
      p_phone: phone.trim(),
      p_source_page: sourcePage,
    })

    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    localStorage.setItem('network_lead_prompt_done', '1')
    setDone(true)
    setTimeout(onClose, 1400)
  }

  function dismiss() {
    // Dismissing (not submitting) still marks it done for this device —
    // we don't want to re-interrupt someone who already said no.
    localStorage.setItem('network_lead_prompt_done', '1')
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && dismiss()}
    >
      <div className="modal">
        <div className="modal-header">
          <h2>{done ? 'Thanks!' : POPUP_HEADLINE}</h2>
          <button className="close-btn" onClick={dismiss} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          {done ? (
            <p style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
              We&apos;ll be in touch. Enjoy the rest of the night.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>{POPUP_BODY}</p>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Phone <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(optional if you gave an email)</span></label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 555-5555"
                  />
                </div>
                {error && <p className="form-error">{error}</p>}
                <div className="modal-footer">
                  <button type="button" className="btn-ghost" onClick={dismiss} disabled={saving}>
                    Not now
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Submit'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
