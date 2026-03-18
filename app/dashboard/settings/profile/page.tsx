'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import { SETTINGS_CSS } from '../settingsStyles'

type Profile = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  email: string | null
  role: string
  points: number
}

export default function EditProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Form state
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, email, role, points')
        .eq('id', user.id)
        .single()
      if (data) {
        setProfile(data)
        setFullName(data.full_name || '')
        setUsername(data.username || '')
        setAvatarUrl(data.avatar_url || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  // Debounce username uniqueness check
  useEffect(() => {
    if (!username || !profile || username === profile.username) {
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
        .neq('id', profile.id)
        .maybeSingle()
      setCheckingUsername(false)
      if (data) {
        setUsernameError('That username is already taken.')
      } else {
        setUsernameError('')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [username, profile])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    if (file.size > 8 * 1024 * 1024) { setUploadError('File must be under 8MB'); return }
    setUploading(true)
    setUploadError('')
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`
    const { error: err } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (err) { setUploadError(err.message); setUploading(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
    setStatus('idle')
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const hasChanges = profile && (
    fullName !== (profile.full_name || '') ||
    username !== (profile.username || '') ||
    avatarUrl !== (profile.avatar_url || '')
  )

  const handleSave = async () => {
    if (!profile) return
    if (usernameError) return
    if (username && !/^[a-z0-9_]{3,20}$/.test(username)) {
      setStatus('error')
      setErrorMsg('Invalid username format.')
      return
    }
    setSaving(true)
    setStatus('idle')
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        username: username || null,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
    setSaving(false)
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setProfile(p => p ? { ...p, full_name: fullName, username, avatar_url: avatarUrl } : p)
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
          <div className="page-title">Edit Profile</div>
          <div className="page-sub">Update your name, username, and avatar.</div>
        </div>

        {status === 'success' && (
          <div className="success-banner">✓ &nbsp;Profile updated.</div>
        )}

        {/* Avatar preview */}
        <div className="avatar-section">
          <div className="avatar-circle">
            {avatarUrl
              ? <img src={avatarUrl} alt={fullName} onError={() => setAvatarUrl('')} />
              : initials
            }
          </div>
          <div className="avatar-info">
            <div className="avatar-name">{fullName || 'Your Name'}</div>
            <div className="avatar-meta">
              {username ? `@${username}` : 'No username set'}&nbsp;·&nbsp;
              {profile?.points || 0} pts
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-title">Basic Info</div>

          <div className="field">
            <label className="field-label" htmlFor="full-name">Full Name</label>
            <input
              id="full-name"
              type="text"
              className="field-input"
              value={fullName}
              onChange={e => { setFullName(e.target.value); setStatus('idle') }}
              placeholder="Your full name"
              autoComplete="name"
              disabled={saving}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="field-input"
              value={username}
              onChange={e => { setUsername(e.target.value.toLowerCase()); setStatus('idle') }}
              placeholder="your_handle"
              autoComplete="username"
              disabled={saving}
            />
            {usernameError
              ? <p className="field-error">{usernameError}</p>
              : checkingUsername
              ? <p className="field-hint">Checking availability…</p>
              : username && username !== profile?.username
              ? <p className="field-success">✓ Available</p>
              : <p className="field-hint">Lowercase letters, numbers, and underscores. 3–20 characters.</p>
            }
          </div>
        </div>

        <div className="settings-section">
          <div className="section-title">Avatar</div>

          <div className="field">
            <label className="field-label">Profile Photo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
              disabled={uploading || saving}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || saving}
              style={{ marginTop: 8 }}
            >
              {uploading ? 'Uploading…' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
            </button>
            {uploadError && <p className="field-error" style={{ marginTop: 6 }}>{uploadError}</p>}
            <p className="field-hint">Square images work best. Max 8MB.</p>
          </div>
        </div>

        {status === 'error' && (
          <p className="field-error" style={{ marginBottom: 16 }}>{errorMsg}</p>
        )}

        <div className="btn-row">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !hasChanges || !!usernameError || checkingUsername}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <a href="/dashboard" className="btn btn-ghost">Cancel</a>
        </div>
      </div>
    </>
  )
}
