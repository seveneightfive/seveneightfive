'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Mail,
  Phone,
  Bell,
  User,
  Check,
  AlertCircle,
  Loader2,
  Upload,
} from 'lucide-react'

type Tab = 'profile' | 'email' | 'phone' | 'notifications'

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

const NOTIFICATION_DEFAULTS: NotificationSettings = {
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
    desc: "When events are added in Topeka that match your interests.",
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
    label: 'Weekly Top City digest',
    desc: "A curated look at what's happening this week in 785.",
  },
]

const SMS_TOGGLES: {
  key: keyof NotificationSettings
  label: string
  desc: string
}[] = [
  {
    key: 'sms_event_reminders',
    label: 'Event reminders',
    desc: 'Text reminder the day of events you have tickets to.',
  },
  {
    key: 'sms_last_minute_deals',
    label: 'Last-minute deals',
    desc: 'Heads-up when same-day tickets drop in price.',
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
    key: 'push_new_events_nearby',
    label: 'New events nearby',
    desc: 'Alert when new events are posted close to you.',
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
  const [tab, setTab] = useState<Tab>('profile')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  // Profile state
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileStatus, setProfileStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [profileError, setProfileError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Email state
  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailStep, setEmailStep] = useState<'form' | 'confirm'>('form')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'error'>('idle')
  const [emailError, setEmailError] = useState('')

  // Phone state
  const [phone, setPhone] = useState('')
  const [currentPhone, setCurrentPhone] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [phoneError, setPhoneError] = useState('')

  // Notifications state
  const [hasPhone, setHasPhone] = useState(false)
  const [notifications, setNotifications] = useState<NotificationSettings>(
    NOTIFICATION_DEFAULTS
  )
  const [notificationsSaved, setNotificationsSaved] = useState<NotificationSettings>(
    NOTIFICATION_DEFAULTS
  )
  const [notificationsSaving, setNotificationsSaving] = useState(false)
  const [notificationsStatus, setNotificationsStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle')
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
          'full_name, username, avatar_url, email, phone_number, notification_settings'
        )
        .eq('id', user.id)
        .single()

      if (data) {
        setFullName(data.full_name || '')
        setUsername(data.username || '')
        setAvatarUrl(data.avatar_url || '')
        setCurrentEmail(data.email || '')
        setHasPhone(!!data.phone_number)
        setPhone(data.phone_number || '')
        setCurrentPhone(data.phone_number || '')
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
      if (data) {
        setUsernameError('That username is already taken.')
      } else {
        setUsernameError('')
      }
    }, 500)
    return () => clearTimeout(timer)
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
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSaveProfile = async () => {
    if (usernameError || checkingUsername) return
    setSavingProfile(true)
    setProfileStatus('idle')
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        username: username || null,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    setSavingProfile(false)
    if (error) {
      setProfileStatus('error')
      setProfileError(error.message)
    } else {
      setProfileStatus('success')
    }
  }

  const isValidEmail = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

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

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6)
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value))
    setPhoneStatus('idle')
  }

  const handlePhoneSave = async () => {
    const digits = phone.replace(/\D/g, '')
    if (phone && digits.length !== 10) {
      setPhoneStatus('error')
      setPhoneError('Please enter a valid 10-digit US phone number.')
      return
    }
    setPhoneSaving(true)
    setPhoneStatus('idle')
    const { error } = await supabase
      .from('profiles')
      .update({
        phone_number: phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    setPhoneSaving(false)
    if (error) {
      setPhoneStatus('error')
      setPhoneError(error.message)
    } else {
      setCurrentPhone(phone)
      setPhoneStatus('success')
    }
  }

  const handlePhoneRemove = async () => {
    setPhoneSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        phone_number: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    setPhoneSaving(false)
    if (!error) {
      setPhone('')
      setCurrentPhone('')
      setPhoneStatus('success')
    }
  }

  const handleNotificationsToggle = (key: keyof NotificationSettings) => {
    setNotifications((s) => ({ ...s, [key]: !s[key] }))
    setNotificationsStatus('idle')
  }

  const handleNotificationsSave = async () => {
    setNotificationsSaving(true)
    setNotificationsStatus('idle')
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
    ? fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?'

  const profileHasChanges =
    fullName !== (fullName || '') ||
    username !== (username || '') ||
    avatarUrl !== (avatarUrl || '')

  const notificationsHasChanges =
    JSON.stringify(notifications) !==
    JSON.stringify(notificationsSaved)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
          Account
        </p>
        <h1 className="mb-2 font-display text-3xl font-bold leading-none text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your account, notifications, and preferences.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-white/[0.02]">
        {[
          { id: 'profile' as Tab, label: 'Profile', icon: User },
          { id: 'email' as Tab, label: 'Email', icon: Mail },
          { id: 'phone' as Tab, label: 'Phone', icon: Phone },
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

      {/* Tab content */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                Edit Profile
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Update your name, username, and avatar.
              </p>
            </div>

            {profileStatus === 'success' && (
              <div className="flex gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
                <Check className="h-4 w-4 shrink-0" />
                Profile updated.
              </div>
            )}

            {profileStatus === 'error' && (
              <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {profileError}
              </div>
            )}

            {/* Avatar preview */}
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-brand-600 font-display font-bold text-white dark:border-gray-700">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="h-full w-full object-cover"
                    onError={() => setAvatarUrl('')}
                  />
                ) : (
                  initials
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {fullName || 'Your Name'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {username ? `@${username}` : 'No username set'}
                </p>
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    setProfileStatus('idle')
                  }}
                  placeholder="Your full name"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                    setProfileStatus('idle')
                  }}
                  placeholder="your_handle"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                {usernameError ? (
                  <p className="mt-1.5 text-xs text-brand-600 dark:text-brand-400">
                    {usernameError}
                  </p>
                ) : checkingUsername ? (
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                    Checking availability…
                  </p>
                ) : username && !usernameError ? (
                  <p className="mt-1.5 text-xs text-success-600 dark:text-success-400">
                    ✓ Available
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                    3–20 chars, lowercase letters, numbers, underscores only.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                  Profile Photo
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading || savingProfile}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || savingProfile}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
                >
                  <Upload className="h-4 w-4" />
                  {uploading
                    ? 'Uploading…'
                    : avatarUrl
                      ? 'Change Photo'
                      : 'Upload Photo'}
                </button>
                {uploadError && (
                  <p className="mt-1.5 text-xs text-brand-600 dark:text-brand-400">
                    {uploadError}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  Square images work best. Max 8MB.
                </p>
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile || !profileHasChanges || !!usernameError}
              className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}

        {/* EMAIL TAB */}
        {tab === 'email' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                Update Email
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Change the email address associated with your account.
              </p>
            </div>

            {emailStep === 'confirm' ? (
              <>
                <div className="flex gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
                  <Check className="h-4 w-4 shrink-0" />
                  Confirmation emails sent.
                </div>

                <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
                  <p className="font-semibold text-brand-900 dark:text-brand-300">
                    Check Both Inboxes
                  </p>
                  <p className="mt-2 text-sm text-brand-700 dark:text-brand-400">
                    We've sent a confirmation link to both <strong>{currentEmail}</strong>{' '}
                    and <strong>{newEmail}</strong>. Click the link in{' '}
                    <strong>both</strong> emails to complete the change. The link
                    expires in 24 hours.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEmailStep('form')
                      setNewEmail('')
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
                  >
                    Use a different email
                  </button>
                </div>
              </>
            ) : (
              <>
                {emailStatus === 'error' && (
                  <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {emailError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                    Current Email
                  </label>
                  <input
                    type="email"
                    value={currentEmail}
                    disabled
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                    New Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value)
                      setEmailStatus('idle')
                    }}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                    A confirmation link will be sent to both your current and new
                    email addresses. You must confirm from both to complete the
                    change.
                  </p>
                </div>

                <button
                  onClick={handleEmailSubmit}
                  disabled={emailSaving || !newEmail}
                  className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {emailSaving ? 'Sending…' : 'Send confirmation'}
                </button>
              </>
            )}
          </div>
        )}

        {/* PHONE TAB */}
        {tab === 'phone' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                Phone Number
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Used for SMS event reminders. Never shared publicly.
              </p>
            </div>

            {phoneStatus === 'success' && (
              <div className="flex gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
                <Check className="h-4 w-4 shrink-0" />
                {phone ? 'Phone number saved.' : 'Phone number removed.'}
              </div>
            )}

            {phoneStatus === 'error' && (
              <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {phoneError}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                US Phone Number
              </label>
              <div className="flex gap-2">
                <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 dark:border-gray-800 dark:bg-white/[0.02]">
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                    🇺🇸 +1
                  </span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(785) 000-0000"
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                We'll only use this for account recovery and SMS reminders you opt
                into.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePhoneSave}
                disabled={phoneSaving || phone === currentPhone}
                className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {phoneSaving ? 'Saving…' : 'Save number'}
              </button>
              {currentPhone && (
                <button
                  onClick={handlePhoneRemove}
                  disabled={phoneSaving}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {tab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                Notifications
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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

            {/* Email */}
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-gray-600 dark:text-gray-400">
                ✉ Email
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

            {/* SMS */}
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-gray-600 dark:text-gray-400">
                📱 SMS / Text
              </h3>
              {!hasPhone && (
                <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400">
                  ⚡ Add a phone number in the Phone section to enable SMS
                  notifications.
                </div>
              )}
              <div
                className="space-y-3"
                style={{
                  opacity: hasPhone ? 1 : 0.45,
                  pointerEvents: hasPhone ? 'auto' : 'none',
                }}
              >
                {SMS_TOGGLES.map((item) => (
                  <NotificationToggle
                    key={item.key}
                    item={item}
                    checked={notifications[item.key]}
                    onChange={() => handleNotificationsToggle(item.key)}
                  />
                ))}
              </div>
            </div>

            {/* Push */}
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-gray-600 dark:text-gray-400">
                🔔 Push Notifications
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

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleNotificationsSave}
                disabled={
                  notificationsSaving || !notificationsHasChanges
                }
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

// ─── Notification Toggle Component ─────────────────────────────────────────

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
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          {item.label}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {item.desc}
        </p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked
            ? 'bg-brand-600'
            : 'bg-gray-300 dark:bg-gray-700'
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
