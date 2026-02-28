'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter, useSearchParams } from 'next/navigation'

type Step = 'choice' | 'phone' | 'otp' | 'magic' | 'magic_sent' | 'profile' | 'signup_info' | 'completing'
type Mode = 'signin' | 'signup'

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #1a1814;
    --white: #fff;
    --accent: #C80650;
    --serif: 'Oswald', sans-serif;
    --sans: 'DM Sans', system-ui, sans-serif;
  }
  html, body { min-height: 100vh; background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  .wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
  .card { width: 100%; max-width: 400px; }
  .wordmark { font-family: var(--serif); font-size: 0.72rem; font-weight: 400; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 32px; text-align: center; }
  .wordmark em { font-style: normal; color: var(--accent); font-weight: 600; }
  .mode-tabs { display: flex; margin-bottom: 40px; border-bottom: 1.5px solid rgba(255,255,255,0.1); }
  .mode-tab { flex: 1; padding: 10px; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -1.5px; font-family: var(--sans); font-size: 0.78rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.3); cursor: pointer; transition: all 0.15s; }
  .mode-tab.active { color: var(--white); border-bottom-color: var(--accent); }
  .mode-tab:hover:not(.active) { color: rgba(255,255,255,0.6); }
  .heading { font-family: var(--serif); font-size: clamp(2rem, 8vw, 3rem); font-weight: 700; text-transform: uppercase; line-height: 0.95; letter-spacing: -0.01em; margin-bottom: 10px; }
  .sub { font-size: 0.88rem; font-weight: 300; color: rgba(255,255,255,0.5); line-height: 1.6; margin-bottom: 40px; }
  label { display: block; font-size: 0.65rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 8px; }
  .field { margin-bottom: 16px; }
  input[type=tel], input[type=text], input[type=email] {
    width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.06);
    border: 1.5px solid rgba(255,255,255,0.12); border-radius: 8px;
    font-family: var(--sans); font-size: 1rem; color: #fff; outline: none;
    transition: border-color 0.15s;
  }
  input::placeholder { color: rgba(255,255,255,0.25); }
  input:focus { border-color: rgba(255,255,255,0.4); }
  .otp-input { font-size: 1.6rem; letter-spacing: 0.3em; text-align: center; font-family: var(--serif); }
  .btn {
    margin-top: 8px; width: 100%; padding: 14px; background: var(--accent);
    border: none; border-radius: 8px; font-family: var(--sans); font-size: 0.82rem;
    font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
    color: #fff; cursor: pointer; transition: opacity 0.15s;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn:hover:not(:disabled) { opacity: 0.88; }
  .btn-ghost {
    margin-top: 10px; width: 100%; padding: 13px; background: transparent;
    border: 1.5px solid rgba(255,255,255,0.12); border-radius: 8px;
    font-family: var(--sans); font-size: 0.82rem; font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.4);
    cursor: pointer; transition: all 0.15s;
  }
  .btn-ghost:hover { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.7); }
  .divider { display: flex; align-items: center; gap: 12px; margin: 24px 0; }
  .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.1); }
  .divider-text { font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.25); }
  .error { margin-top: 12px; font-size: 0.82rem; color: #ff6b6b; }
  .hint { margin-top: 14px; font-size: 0.78rem; color: rgba(255,255,255,0.3); line-height: 1.5; }
  .hint strong { color: rgba(255,255,255,0.6); font-weight: 500; }
  .back-btn { display: inline-block; margin-top: 28px; font-size: 0.78rem; color: rgba(255,255,255,0.35); background: none; border: none; padding: 0; font-family: var(--sans); cursor: pointer; transition: color 0.15s; }
  .back-btn:hover { color: rgba(255,255,255,0.7); }
  .sent-icon { font-size: 2.5rem; margin-bottom: 16px; }
  .name-row { display: flex; gap: 12px; }
  .name-row .field { flex: 1; }
  .completing-wrap { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 40px 0; }
  .completing-spinner { width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.15); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .completing-text { font-size: 0.88rem; color: rgba(255,255,255,0.5); }
`

function LoginPageInner() {
  const [mode, setMode] = useState<Mode>('signin')
  const [step, setStep] = useState<Step>('choice')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Handle ?complete=1 redirect from auth callback (magic link sign-up)
  useEffect(() => {
    if (searchParams.get('complete') !== '1') return
    const raw = localStorage.getItem('signup_pending')
    if (!raw) { router.replace('/'); return }
    const pending = JSON.parse(raw) as { firstName: string; lastName: string; email: string }
    setFirstName(pending.firstName)
    setLastName(pending.lastName)
    setEmail(pending.email)
    setStep('completing')

    const run = async () => {
      const res = await fetch('/api/auth/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      })
      localStorage.removeItem('signup_pending')
      const data = await res.json()
      router.push(data.role === 'creator' ? '/dashboard' : '/')
    }
    run()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const normalizePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
  }

  const resetError = () => setError('')

  const switchMode = (m: Mode) => {
    setMode(m)
    setStep(m === 'signup' ? 'signup_info' : 'choice')
    setPhone(''); setOtp(''); setEmail(''); setFirstName(''); setLastName('')
    resetError()
  }

  // ── Send phone OTP ──
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    resetError()
    const normalized = normalizePhone(phone)
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized })
    if (error) {
      setError(error.message)
    } else {
      sessionStorage.setItem('pending_phone', normalized)
      setStep('otp')
    }
    setLoading(false)
  }

  // ── Verify OTP ──
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    resetError()
    const pendingPhone = sessionStorage.getItem('pending_phone') || normalizePhone(phone)

    const { data, error } = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token: otp,
      type: 'sms',
    })

    if (error) { setError(error.message); setLoading(false); return }

    const user = data.user
    if (!user) { setError('Something went wrong. Please try again.'); setLoading(false); return }

    if (mode === 'signup') {
      // Sign up: call merge directly with pre-collected name + email
      const res = await fetch('/api/auth/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, lastName }),
      })
      const result = await res.json()
      if (!res.ok) { setError(result.error || 'Something went wrong.'); setLoading(false); return }
      sessionStorage.removeItem('pending_phone')
      router.push(result.role === 'creator' ? '/dashboard' : '/')
    } else {
      // Sign in: check existing entity links
      const [{ data: artist }, { data: venue }] = await Promise.all([
        supabase.from('artists').select('id').eq('auth_user_id', user.id).maybeSingle(),
        supabase.from('venues').select('id').eq('auth_user_id', user.id).maybeSingle(),
      ])
      if (artist || venue) {
        router.push('/dashboard')
      } else {
        setStep('profile')
      }
      setLoading(false)
    }
  }

  // ── Send magic link ──
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    resetError()

    if (mode === 'signup') {
      localStorage.setItem('signup_pending', JSON.stringify({ firstName, lastName, email }))
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      if (mode === 'signup') localStorage.removeItem('signup_pending')
      setError(error.message)
    } else {
      setStep('magic_sent')
    }
    setLoading(false)
  }

  // ── Complete profile + merge (sign-in new user) ──
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    resetError()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const res = await fetch('/api/auth/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, firstName, lastName }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    sessionStorage.removeItem('pending_phone')
    router.push(data.role === 'creator' ? '/dashboard' : '/')
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="wrap">
        <div className="card">
          <div className="wordmark">The <em>785</em></div>

          {/* ── Mode tabs (only on entry steps) ── */}
          {(step === 'choice' || step === 'signup_info') && (
            <div className="mode-tabs">
              <button className={`mode-tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => switchMode('signin')}>
                Sign In
              </button>
              <button className={`mode-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => switchMode('signup')}>
                Sign Up
              </button>
            </div>
          )}

          {/* ── SIGN IN: CHOICE ── */}
          {step === 'choice' && (
            <>
              <h1 className="heading">Sign<br />In</h1>
              <p className="sub">Use your phone number or email to access your account.</p>
              <button className="btn" onClick={() => { resetError(); setStep('phone') }}>
                📱 Sign in with Phone
              </button>
              <div className="divider">
                <div className="divider-line" />
                <span className="divider-text">or</span>
                <div className="divider-line" />
              </div>
              <button className="btn-ghost" onClick={() => { resetError(); setStep('magic') }}>
                ✉ Sign in with Email Link
              </button>
              <a href="/" className="back-btn">← Back to The 785</a>
            </>
          )}

          {/* ── SIGN UP: INFO ── */}
          {step === 'signup_info' && (
            <>
              <h1 className="heading">Create<br />Account</h1>
              <p className="sub">Set up your profile and connect your artist, venue, or event page.</p>
              <div className="name-row">
                <div className="field">
                  <label htmlFor="su-firstName">First Name</label>
                  <input
                    id="su-firstName" type="text" placeholder="Jane"
                    value={firstName} onChange={e => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="su-lastName">Last Name</label>
                  <input
                    id="su-lastName" type="text" placeholder="Smith"
                    value={lastName} onChange={e => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="su-email">Email Address</label>
                <input
                  id="su-email" type="email" placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              {error && <div className="error">{error}</div>}
              <button
                className="btn"
                disabled={!firstName || !lastName || !email}
                onClick={() => { resetError(); setStep('phone') }}
              >
                📱 Continue with Phone
              </button>
              <div className="divider">
                <div className="divider-line" />
                <span className="divider-text">or</span>
                <div className="divider-line" />
              </div>
              <button
                className="btn-ghost"
                disabled={!firstName || !lastName || !email}
                onClick={handleMagicLink as any}
              >
                ✉ Continue with Email Link
              </button>
              <a href="/" className="back-btn">← Back to The 785</a>
            </>
          )}

          {/* ── PHONE ── */}
          {step === 'phone' && (
            <>
              <h1 className="heading">Phone<br />Number</h1>
              <p className="sub">We'll send a 6-digit code to your phone.</p>
              <form onSubmit={handleSendOTP}>
                <div className="field">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    id="phone" type="tel" placeholder="(785) 000-0000"
                    value={phone} onChange={e => setPhone(e.target.value)}
                    required autoComplete="tel"
                  />
                </div>
                {error && <div className="error">{error}</div>}
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Code'}
                </button>
              </form>
              <button className="back-btn" onClick={() => { setStep(mode === 'signup' ? 'signup_info' : 'choice'); resetError() }}>← Back</button>
            </>
          )}

          {/* ── OTP ── */}
          {step === 'otp' && (
            <>
              <h1 className="heading">Enter<br />Code</h1>
              <p className="sub">We sent a 6-digit code to <strong style={{color: 'rgba(255,255,255,0.8)'}}>{phone}</strong>.</p>
              <form onSubmit={handleVerifyOTP}>
                <div className="field">
                  <label htmlFor="otp">Verification Code</label>
                  <input
                    id="otp" type="text" inputMode="numeric"
                    className="otp-input" placeholder="000000" maxLength={6}
                    value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    required autoComplete="one-time-code"
                  />
                </div>
                {error && <div className="error">{error}</div>}
                <button type="submit" className="btn" disabled={loading || otp.length < 6}>
                  {loading ? 'Verifying…' : 'Verify Code'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => { setStep('phone'); setOtp(''); resetError() }}>
                  ← Change Number
                </button>
              </form>
              <div className="hint">Didn't get it? Check your number and try again.</div>
            </>
          )}

          {/* ── MAGIC LINK (sign-in only) ── */}
          {step === 'magic' && (
            <>
              <h1 className="heading">Email<br />Link</h1>
              <p className="sub">Enter your email and we'll send a sign-in link — no password needed.</p>
              <form onSubmit={handleMagicLink}>
                <div className="field">
                  <label htmlFor="magic-email">Email Address</label>
                  <input
                    id="magic-email" type="email" placeholder="your@email.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="email"
                  />
                </div>
                {error && <div className="error">{error}</div>}
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Magic Link'}
                </button>
              </form>
              <button className="back-btn" onClick={() => { setStep('choice'); resetError() }}>← Back</button>
            </>
          )}

          {/* ── MAGIC SENT ── */}
          {step === 'magic_sent' && (
            <>
              <div className="sent-icon">✉</div>
              <h1 className="heading">Check<br />Email</h1>
              <p className="sub">
                We sent a {mode === 'signup' ? 'confirmation' : 'login'} link to <strong style={{color: 'rgba(255,255,255,0.8)'}}>{email}</strong>.
              </p>
              <div className="hint">
                Didn't get it? Check spam or{' '}
                <strong style={{cursor: 'pointer', textDecoration: 'underline'}} onClick={() => setStep(mode === 'signup' ? 'signup_info' : 'magic')}>
                  try again
                </strong>.
              </div>
              <a href="/" className="back-btn">← Back to The 785</a>
            </>
          )}

          {/* ── PROFILE (sign-in new user fallback) ── */}
          {step === 'profile' && (
            <>
              <h1 className="heading">Your<br />Profile</h1>
              <p className="sub">Just a few details to set up your account and connect your page.</p>
              <form onSubmit={handleProfileSubmit}>
                <div className="name-row">
                  <div className="field">
                    <label htmlFor="firstName">First Name</label>
                    <input
                      id="firstName" type="text" placeholder="Jane"
                      value={firstName} onChange={e => setFirstName(e.target.value)}
                      required autoComplete="given-name"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                      id="lastName" type="text" placeholder="Smith"
                      value={lastName} onChange={e => setLastName(e.target.value)}
                      required autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="profile-email">Email Address</label>
                  <input
                    id="profile-email" type="email" placeholder="your@email.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="email"
                  />
                </div>
                {error && <div className="error">{error}</div>}
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? 'Setting up…' : 'Complete Setup'}
                </button>
              </form>
              <div className="hint">Your email connects you to your artist, venue, or event page.</div>
            </>
          )}

          {/* ── COMPLETING (auto-merge after magic link sign-up) ── */}
          {step === 'completing' && (
            <div className="completing-wrap">
              <div className="completing-spinner" />
              <p className="completing-text">Setting up your account…</p>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
