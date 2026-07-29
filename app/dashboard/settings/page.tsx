'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import {
  Bell,
  User,
  Check,
  AlertCircle,
  Loader2,
  Upload,
} from 'lucide-react'

/**
 * Settings — restructured this pass:
 *
 *  - Tabs collapsed from 4 (Profile/Email/Phone/Notifications) to 2
 *    (Account/Notifications). Account now holds avatar, full name,
 *    username, email, and phone all in one form — matching the mockup's
 *    simpler settings shell.
 *  - The two SMS toggles that used to live in Notifications are gone.
 *    In their place: a single "Send me text reminders" checkbox living
 *    right next to the phone number field in Account, per request.
 *  - Notifications subheadings ("Email" / "Push Notifications") no
 *    longer have icons in front of them.
 *  - "Weekly Top City digest" renamed to "seveneightfive weekender".
 *    This still only writes to notification_settings in Supabase — see
 *    the TODO comment at that toggle for the sender.net follow-up.
 *  - Push "New events nearby" removed. "Artist activity" kept.
 */

type Tab = 'account' | 'notifications'

type NotificationSettings = {
  email_event_reminders: boolean
  email_new_events: boolean
  email_artist_updates: boolean
  email_venue_news: boolean
  email_weekly_digest: boolean
  push_event_reminders: boolean
  push_artist_updates: boolean
}

const NOTIFICATION_DEFAULTS: NotificationSettings = {
  email_event_reminders: true,
  email_new_events: true,
  email_artist_updates: true,
  email_venue_news: true,
  email_weekly_digest: true,
  push_event_reminders: true,
  push_artist_updates: true,
}

const EMAIL_TOGGLES: {
  key: keyof NotificationSettings
  label: string
  desc: string
}[] = [
  {
    key: 'email_event_reminders',
    label: 'Event reminders',
    desc: "Day-of reminders for events you've RSVPed or have tickets to.",
  },
  {
    key: 'email_new_events',
    label: 'New events near you',
    desc: 'When events are added in Topeka that match your interests.',
  },
  {
    key: 'email_artist_updates',
    label: 'Artist updates',
    desc: 'New shows and announcements from artists you follow.',
  },
  {
    key: 'email_venue_news',
    label: 'Venue news',
    desc: 'Announcements from venues on your following list.',
  },
  {
    key: 'email_weekly_digest',
    label: 'seveneightfive weekender',
    desc: "A curated look at what's happening this week in seveneightfive.",
  },
]

const PUSH_TOGGLES: {
  key: keyof NotificationSettings
  label: string
  desc: string
}[] = [
  {
    key: 'push_event_reminders',
    label: 'Event reminders',
    desc: 'Push notification for upcoming events on your list.',
  },
  {
    key: 'push_artist_updates',
    label: 'Artist activity',
    desc: 'When followed artists announce new shows.',
  },
]

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('account')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  // Account state (avatar, name, username, email, phone, SMS opt-in)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailStep, setEmailStep] = useState<'form' | 'confirm'>('form')

  const [phone, setPhone] = useState('')
  const [currentPhone, setCurrentPhone] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [currentSmsOptIn, setCurrentSmsOptIn] = useState(false)

  const [savingAccount, setSavingAccount] = useState(false)
  const [accountStatus, setAccountStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [accountError, setAccountError] = useState('')

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationSettings>(NOTIFICATION_DEFAULTS)
  const [notificationsSaved, setNotificationsSaved] = useState<NotificationSettings>(NOTIFICATION_DEFAULTS)
  const [notificationsSaving, setNotificationsSaving] = useState(false)
  const [notificationsStatus, setNotificationsStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [notificationsError, setNotificationsError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const { data } = await supabase
        .from('profiles')
        .select(
          'full_name, username, avatar_url, email, phone_number, sms_opt_in, notification_settings'
        )
        .eq('id', user.id)
        .single()

      if (data) {
        setFullName(data.full_name || '')
        setUsername(data.username || '')
        setAvatarUrl(data.avatar_url || '')
        setCurrentEmail(data.email || '')
        setPhone(data.phone_number || '')
        setCurrentPhone(data.phone_number || '')
        setSmsOptIn(!!data.sms_opt_in)
        setCurrentSmsOptIn(!!data.sms_opt_in)
        const merged = {
          ...NOTIFICATION_DEFAULTS,
          ...(data.notification_settings || {}),
        }
        setNotifications(merged)
        setNotificationsSaved(merged)
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Username uniqueness check
  useEffect(() => {
    if (!username || username === fullName) {
      setUsernameError('')
      return
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setUsernameError('3–20 chars, lowercase letters, numbers, underscores only.')
      return
    }
    const timer = setTimeout(async () => {
      setCheckingUsername(true)
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .maybeSingle()
      setCheckingUsername(false)
      setUsernameError(data ? 'That username is already taken.' : '')
    }, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, userId])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('File must be under 8MB')
      return
    }
    setUploading(true)
    setUploadError('')
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar-${Date.now()}.${ext}`
    const { error: err } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (err) {
      setUploadError(err.message)
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('profiles').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value))
    setAccountStatus('idle')
  }

  // ─── Single "Save changes" for the whole Account tab ─────────────────
  // Handles full_name/username/avatar_url + phone/sms_opt_in together.
  // Email uses its own flow (Supabase requires a confirm-both-inboxes
  // step) so it's saved separately via handleEmailSubmit below.
  const handleSaveAccount = async () => {
    if (usernameError || checkingUsername) return
    const phoneDigits = phone.replace(/\D/g, '')
    if (phone && phoneDigits.length !== 10) {
      setAccountStatus('error')
      setAccountError('Please enter a valid 10-digit US phone number.')
      return
    }
    setSavingAccount(true)
    setAccountStatus('idle')
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        username: username || null,
        avatar_url: avatarUrl || null,
        phone_number: phone || null,
        sms_opt_in: phone ? smsOptIn : false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    setSavingAccount(false)
    if (error) {
      setAccountStatus('error')
      setAccountError(error.message)
    } else {
      setCurrentPhone(phone)
      setCurrentSmsOptIn(phone ? smsOptIn : false)
      if (!phone) setSmsOptIn(false)
      setAccountStatus('success')
    }
  }

  const [emailSaving, setEmailSaving] = useState(false)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'error'>('idle')
  const [emailError, setEmailError] = useState('')

  const handleEmailSubmit = async () => {
    if (!isValidEmail(newEmail)) {
      setEmailStatus('error')
      setEmailError('Please enter a valid email address.')
      return
    }
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setEmailStatus('error')
      setEmailError('This is already your current email address.')
      return
    }
    setEmailSaving(true)
    setEmailStatus('idle')
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setEmailSaving(false)
    if (error) {
      setEmailStatus('error')
      setEmailError(error.message)
    } else {
      setEmailStep('confirm')
    }
  }

  const handleNotificationsToggle = (key: keyof NotificationSettings) => {
    setNotifications((s) => ({ ...s, [key]: !s[key] }))
    setNotificationsStatus('idle')
  }

  const handleNotificationsSave = async () => {
    setNotificationsSaving(true)
    setNotificationsStatus('idle')
    // TODO: when email_weekly_digest is toggled on/off, also sync
    // membership in the sender.net "seveneightfive weekender" group via
    // their API (needs SENDER_NET_API_KEY + list ID). For now this only
    // persists to Supabase notification_settings, same as every other
    // toggle here.
    const { error } = await supabase
      .from('profiles')
      .update({
        notification_settings: notifications,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    setNotificationsSaving(false)
    if (error) {
      setNotificationsStatus('error')
      setNotificationsError(error.message)
    } else {
      setNotificationsSaved(notifications)
      setNotificationsStatus('success')
    }
  }

  const handleDisableAllNotifications = () => {
    const allOff = Object.fromEntries(
      Object.keys(NOTIFICATION_DEFAULTS).map((k) => [k, false])
    ) as NotificationSettings
    setNotifications(allOff)
    setNotificationsStatus('idle')
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const accountHasChanges =
    phone !== currentPhone || smsOptIn !== currentSmsOptIn

  const notificationsHasChanges =
    JSON.stringify(notifications) !== JSON.stringify(notificationsSaved)

  return (
    <div className="space-y-6">
      {/* Tab navigation — simplified from 4 tabs to 2 */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-white/[0.02]">
        {[
          { id: 'account' as Tab, label: 'Account', icon: User },
          { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase transition ${
              tab === id
                ? 'bg-white text-gray-900 shadow-sm dark:bg-white/[0.1] dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        {/* ACCOUNT TAB — avatar, name, username, email, phone + SMS opt-in */}
        {tab === 'account' && (
          <div className="space-y-8">
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                Account
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Your name, photo, and contact info.
              </p>
            </div>

            {accountStatus === 'success' && (
              <div className="flex gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
                <Check className="h-4 w-4 shrink-0" />
                Account updated.
              </div>
            )}
            {accountStatus === 'error' && (
              <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {accountError}
              </div>
            )}

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-brand-600 font-display font-bold text-white dark:border-gray-700">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="h-full w-full rounded-full object-cover"
                    onError={() => setAvatarUrl('')}
                  />
                ) : (
                  initials
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading…' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </button>
                {uploadError && (
                  <p className="mt-1.5 text-xs text-brand-600 dark:text-brand-400">{uploadError}</p>
                )}
              </div>
            </div>

            {/* Name / Username */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    setAccountStatus('idle')
                  }}
                  placeholder="Your full name"
                  className={accountInputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase())
                    setAccountStatus('idle')
                  }}
                  placeholder="your_handle"
                  className={accountInputCls}
                />
                {usernameError ? (
                  <p className="mt-1.5 text-xs text-brand-600 dark:text-brand-400">{usernameError}</p>
                ) : checkingUsername ? (
                  <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">Checking availability…</p>
                ) : username ? (
                  <p className="mt-1.5 text-xs text-success-600 dark:text-success-400">✓ Available</p>
                ) : null}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                Email
              </label>
              {emailStep === 'confirm' ? (
                <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-500/30 dark:bg-brand-500/10">
                  <p className="font-semibold text-brand-900 dark:text-brand-300">Check both inboxes</p>
                  <p className="mt-2 text-brand-700 dark:text-brand-400">
                    We've sent a confirmation link to both <strong>{currentEmail}</strong> and{' '}
                    <strong>{newEmail}</strong>. Click the link in both to complete the change.
                  </p>
                  <button
                    onClick={() => {
                      setEmailStep('form')
                      setNewEmail('')
                    }}
                    className="mt-3 text-xs font-semibold underline hover:no-underline"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={currentEmail}
                      disabled
                      className={`${accountInputCls} bg-gray-50 text-gray-600 dark:bg-white/[0.02] dark:text-gray-400 sm:flex-1`}
                    />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => {
                        setNewEmail(e.target.value)
                        setEmailStatus('idle')
                      }}
                      placeholder="New email address"
                      className={`${accountInputCls} sm:flex-1`}
                    />
                    <button
                      onClick={handleEmailSubmit}
                      disabled={emailSaving || !newEmail}
                      className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
                    >
                      {emailSaving ? 'Sending…' : 'Update'}
                    </button>
                  </div>
                  {emailStatus === 'error' && (
                    <p className="mt-1.5 text-xs text-brand-600 dark:text-brand-400">{emailError}</p>
                  )}
                  <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                    Changing your email requires confirming from both your current and new address.
                  </p>
                </>
              )}
            </div>

            {/* Phone + SMS opt-in checkbox right beneath it */}
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                Phone
              </label>
              <div className="flex gap-2">
                <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 dark:border-gray-800 dark:bg-white/[0.02]">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">🇺🇸 +1</span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(785) 000-0000"
                  className={`${accountInputCls} flex-1`}
                />
              </div>

              <label className="mt-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={smsOptIn}
                  disabled={!phone}
                  onChange={(e) => {
                    setSmsOptIn(e.target.checked)
                    setAccountStatus('idle')
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                />
                Send me text reminders for events I have tickets to
              </label>
              {!phone && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Add a phone number above to enable text reminders.
                </p>
              )}
            </div>

            <button
              onClick={handleSaveAccount}
              disabled={savingAccount || !accountHasChanges || !!usernameError}
              className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingAccount ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}

        {/* NOTIFICATIONS TAB — icons removed from subheadings, SMS section gone */}
        {tab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                Notifications
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Choose how and when 785 reaches out to you.
              </p>
            </div>

            {notificationsStatus === 'success' && (
              <div className="flex gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
                <Check className="h-4 w-4 shrink-0" />
                Notification preferences saved.
              </div>
            )}
            {notificationsStatus === 'error' && (
              <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {notificationsError}
              </div>
            )}

            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-gray-600 dark:text-gray-400">
                Email
              </h3>
              <div className="space-y-3">
                {EMAIL_TOGGLES.map((item) => (
                  <NotificationToggle
                    key={item.key}
                    item={item}
                    checked={notifications[item.key]}
                    onChange={() => handleNotificationsToggle(item.key)}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-gray-600 dark:text-gray-400">
                Push Notifications
              </h3>
              <div className="space-y-3">
                {PUSH_TOGGLES.map((item) => (
                  <NotificationToggle
                    key={item.key}
                    item={item}
                    checked={notifications[item.key]}
                    onChange={() => handleNotificationsToggle(item.key)}
                  />
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Text reminders are managed from the Account tab, next to your phone number.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleNotificationsSave}
                disabled={notificationsSaving || !notificationsHasChanges}
                className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {notificationsSaving ? 'Saving…' : 'Save preferences'}
              </button>
              <button
                onClick={handleDisableAllNotifications}
                disabled={notificationsSaving}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
              >
                Disable all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const accountInputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500'

function NotificationToggle({
  item,
  checked,
  onChange,
}: {
  item: { key: keyof NotificationSettings; label: string; desc: string }
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{item.desc}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
