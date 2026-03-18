'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import { SETTINGS_CSS } from '../settingsStyles'

export default function PhoneSettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [currentPhone, setCurrentPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', user.id)
        .single()
      const existing = data?.phone_number || ''
      setCurrentPhone(existing)
      setPhone(existing)
      setLoading(false)
    }
    load()
  }, [])

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value))
    setStatus('idle')
  }

  const handleSave = async () => {
    const digits = phone.replace(/\D/g, '')
    if (phone && digits.length !== 10) {
      setStatus('error')
      setErrorMsg('Please enter a valid 10-digit US phone number.')
      return
    }
    setSaving(true)
    setStatus('idle')
    const { error } = await supabase
      .from('profiles')
      .update({ phone_number: phone || null, updated_at: new Date().toISOString() })
      .eq('id', userId)
    setSaving(false)
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setCurrentPhone(phone)
      setStatus('success')
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ phone_number: null, updated_at: new Date().toISOString() })
      .eq('id', userId)
    setSaving(false)
    if (!error) {
      setPhone('')
      setCurrentPhone('')
      setStatus('success')
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
          <div className="page-title">Phone Number</div>
          <div className="page-sub">Used for SMS event reminders. Never shared publicly.</div>
        </div>

        {status === 'success' && (
          <div className="success-banner">
            ✓ &nbsp;{phone ? 'Phone number saved.' : 'Phone number removed.'}
          </div>
        )}

        <div className="settings-section">
          <div className="section-title">Mobile Number</div>

          <div className="field">
            <label className="field-label" htmlFor="phone">US Phone Number</label>
            <div className="phone-wrap">
              <span className="phone-prefix">🇺🇸 +1</span>
              <input
                id="phone"
                type="tel"
                className="field-input"
                value={phone}
                onChange={handleChange}
                placeholder="(785) 000-0000"
                autoComplete="tel"
                disabled={saving}
              />
            </div>
            {status === 'error' && <p className="field-error">{errorMsg}</p>}
            <p className="field-hint">
              We&rsquo;ll only use this for account recovery and SMS reminders you opt into.
            </p>
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || phone === currentPhone}>
              {saving ? 'Saving…' : 'Save number'}
            </button>
            {currentPhone && (
              <button className="btn btn-danger" onClick={handleRemove} disabled={saving}>
                Remove number
              </button>
            )}
          </div>
        </div>

        <div className="divider" />

        <div className="settings-section">
          <div className="section-title">SMS Notifications</div>
          <div className="info-banner">
            ⚡ Configure SMS notification preferences in{' '}
            <a href="/dashboard/settings/notifications" style={{ color: 'inherit', marginLeft: 4 }}>
              Notification Settings →
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
