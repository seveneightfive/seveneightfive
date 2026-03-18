'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import { SETTINGS_CSS } from '../settingsStyles'

export default function EmailSettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [status, setStatus] = useState<'idle' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentEmail(user.email || '')
      setLoading(false)
    }
    load()
  }, [])

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  const handleSubmit = async () => {
    if (!isValidEmail(newEmail)) {
      setStatus('error')
      setErrorMsg('Please enter a valid email address.')
      return
    }
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setStatus('error')
      setErrorMsg('This is already your current email address.')
      return
    }
    setSaving(true)
    setStatus('idle')

    // Supabase sends a confirmation link to BOTH old and new email
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setSaving(false)
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStep('confirm')
    }
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#1a1814' }} />

  return (
    <>
      <style>{SETTINGS_CSS}</style>

      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <a href="/dashboard" className="back-btn">
            <span className="back-arrow">←</span>
            Dashboard
          </a>
        </div>
        <a href="/" className="wordmark">seven<em>eight</em>five</a>
      </div>

      <div className="page">
        <div className="page-header">
          <div className="page-eyebrow">Account Settings</div>
          <div className="page-title">Update Email</div>
          <div className="page-sub">Change the email address associated with your account.</div>
        </div>

        {step === 'confirm' ? (
          <>
            <div className="success-banner">
              ✓ &nbsp;Confirmation emails sent.
            </div>
            <div className="verify-card">
              <div className="verify-title">Check Both Inboxes</div>
              <div className="verify-body">
                We&rsquo;ve sent a confirmation link to both{' '}
                <strong>{currentEmail}</strong> and <strong>{newEmail}</strong>.
                <br /><br />
                Click the link in <strong>both</strong> emails to complete the change.
                The link expires in 24 hours.
              </div>
              <div className="btn-row">
                <button className="btn btn-secondary" onClick={() => { setStep('form'); setNewEmail('') }}>
                  Use a different email
                </button>
                <a href="/dashboard" className="btn btn-ghost">Back to dashboard</a>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="settings-section">
              <div className="section-title">Current Email</div>
              <div className="field">
                <input
                  type="email"
                  className="field-input"
                  value={currentEmail}
                  readOnly
                  disabled
                  style={{ opacity: 0.5 }}
                />
              </div>
            </div>

            <div className="settings-section">
              <div className="section-title">New Email Address</div>
              <div className="field">
                <label className="field-label" htmlFor="new-email">Enter new email</label>
                <input
                  id="new-email"
                  type="email"
                  className="field-input"
                  value={newEmail}
                  onChange={e => { setNewEmail(e.target.value); setStatus('idle') }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={saving}
                />
                {status === 'error' && <p className="field-error">{errorMsg}</p>}
                <p className="field-hint">
                  A confirmation link will be sent to both your current and new email addresses.
                  You must confirm from both to complete the change.
                </p>
              </div>

              <div className="btn-row">
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={saving || !newEmail}
                >
                  {saving ? 'Sending…' : 'Send confirmation'}
                </button>
                <a href="/dashboard" className="btn btn-ghost">Cancel</a>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
