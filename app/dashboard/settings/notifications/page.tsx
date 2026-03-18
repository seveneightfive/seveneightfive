'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import { SETTINGS_CSS } from '../settingsStyles'

type NotificationSettings = {
  email_event_reminders: boolean
  email_new_events: boolean
  email_artist_updates: boolean
  email_venue_news: boolean
  email_weekly_digest: boolean
  sms_event_reminders: boolean
  sms_last_minute_deals: boolean
  push_event_reminders: boolean
  push_new_events_nearby: boolean
  push_artist_updates: boolean
}

const DEFAULTS: NotificationSettings = {
  email_event_reminders: true,
  email_new_events: true,
  email_artist_updates: true,
  email_venue_news: true,
  email_weekly_digest: true,
  sms_event_reminders: false,
  sms_last_minute_deals: false,
  push_event_reminders: true,
  push_new_events_nearby: true,
  push_artist_updates: true,
}

const EMAIL_TOGGLES: { key: keyof NotificationSettings; label: string; desc: string }[] = [
  { key: 'email_event_reminders', label: 'Event reminders', desc: 'Day-of reminders for events you\'ve RSVPed or have tickets to.' },
  { key: 'email_new_events', label: 'New events near you', desc: 'When events are added in Topeka that match your interests.' },
  { key: 'email_artist_updates', label: 'Artist updates', desc: 'New shows and announcements from artists you follow.' },
  { key: 'email_venue_news', label: 'Venue news', desc: 'Announcements from venues on your following list.' },
  { key: 'email_weekly_digest', label: 'Weekly Top City digest', desc: 'A curated look at what\'s happening this week in 785.' },
]

const SMS_TOGGLES: { key: keyof NotificationSettings; label: string; desc: string }[] = [
  { key: 'sms_event_reminders', label: 'Event reminders', desc: 'Text reminder the day of events you have tickets to.' },
  { key: 'sms_last_minute_deals', label: 'Last-minute deals', desc: 'Heads-up when same-day tickets drop in price.' },
]

const PUSH_TOGGLES: { key: keyof NotificationSettings; label: string; desc: string }[] = [
  { key: 'push_event_reminders', label: 'Event reminders', desc: 'Push notification for upcoming events on your list.' },
  { key: 'push_new_events_nearby', label: 'New events nearby', desc: 'Alert when new events are posted close to you.' },
  { key: 'push_artist_updates', label: 'Artist activity', desc: 'When followed artists announce new shows.' },
]

export default function NotificationsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [hasPhone, setHasPhone] = useState(false)
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS)
  const [saved, setSaved] = useState<NotificationSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data } = await supabase
        .from('profiles')
        .select('notification_settings, phone_number')
        .eq('id', user.id)
        .single()
      if (data) {
        setHasPhone(!!data.phone_number)
        const merged = { ...DEFAULTS, ...(data.notification_settings || {}) }
        setSettings(merged)
        setSaved(merged)
      }
      setLoading(false)
    }
    load()
  }, [])

  const toggle = (key: keyof NotificationSettings) => {
    setSettings(s => ({ ...s, [key]: !s[key] }))
    setStatus('idle')
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(saved)

  const handleSave = async () => {
    setSaving(true)
    setStatus('idle')
    const { error } = await supabase
      .from('profiles')
      .update({ notification_settings: settings, updated_at: new Date().toISOString() })
      .eq('id', userId)
    setSaving(false)
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setSaved(settings)
      setStatus('success')
    }
  }

  const disableAll = () => {
    const allOff = Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, false])) as NotificationSettings
    setSettings(allOff)
    setStatus('idle')
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#1a1814' }} />

  const Toggle = ({ item }: { item: { key: keyof NotificationSettings; label: string; desc: string } }) => (
    <div className="toggle-row">
      <div className="toggle-info">
        <div className="toggle-label">{item.label}</div>
        <div className="toggle-desc">{item.desc}</div>
      </div>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={settings[item.key]}
          onChange={() => toggle(item.key)}
        />
        <span className="toggle-track" />
      </label>
    </div>
  )

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
          <div className="page-title">Notifications</div>
          <div className="page-sub">Choose how and when 785 reaches out to you.</div>
        </div>

        {status === 'success' && (
          <div className="success-banner">✓ &nbsp;Notification preferences saved.</div>
        )}
        {status === 'error' && (
          <p className="field-error" style={{ marginBottom: 16 }}>{errorMsg}</p>
        )}

        {/* ── EMAIL ── */}
        <div className="settings-section">
          <div className="section-title">✉ Email</div>
          <div className="toggle-group">
            {EMAIL_TOGGLES.map(item => <Toggle key={item.key} item={item} />)}
          </div>
        </div>

        {/* ── SMS ── */}
        <div className="settings-section">
          <div className="section-title">📱 SMS / Text</div>
          {!hasPhone && (
            <div className="info-banner">
              ⚡ Add a phone number to enable SMS notifications.{' '}
              <a href="/dashboard/settings/phone" style={{ color: 'inherit', marginLeft: 4 }}>
                Add number →
              </a>
            </div>
          )}
          <div className="toggle-group" style={{ opacity: hasPhone ? 1 : 0.45, pointerEvents: hasPhone ? 'auto' : 'none' }}>
            {SMS_TOGGLES.map(item => <Toggle key={item.key} item={item} />)}
          </div>
        </div>

        {/* ── PUSH ── */}
        <div className="settings-section">
          <div className="section-title">🔔 Push Notifications</div>
          <div className="toggle-group">
            {PUSH_TOGGLES.map(item => <Toggle key={item.key} item={item} />)}
          </div>
        </div>

        <div className="btn-row" style={{ marginBottom: 12 }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving…' : 'Save preferences'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={disableAll}
            disabled={saving}
          >
            Disable all
          </button>
        </div>
      </div>
    </>
  )
}
