'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'

type Step = 'phone' | 'otp' | 'email'

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #c0bab3;
    --white: #fff; --off: #f7f6f4; --border: #ece8e2;
    --accent: #C80650;
    --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
  }
  html, body { min-height: 100vh; background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  .wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
  .card { width: 100%; max-width: 400px; }
  .wordmark { font-family: var(--serif); font-size: 0.72rem; font-weight: 400; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 48px; text-align: center; }
  .wordmark em { font-style: normal; color: var(--accent); font-weight: 600; }
  .heading { font-family: var(--serif); font-size: clamp(2rem, 8vw, 3rem); font-weight: 700; text-transform: uppercase; line-height: 0.95; letter-spacing: -0.01em; margin-bottom: 10px; }
  .sub { font-size: 0.88rem; font-weight: 300; color: rgba(255,255,255,0.5); line-height: 1.6; margin-bottom: 40px; }
  label { display: block; font-size: 0.65rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 8px; }
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
    margin-top: 16px; width: 100%; padding: 14px; background: var(--accent);
    border: none; border-radius: 8px; font-family: var(--sans); font-size: 0.82rem;
    font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
    color: #fff; cursor: pointer; transition: opacity 0.15s;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn:hover:not(:disabled) { opacity: 0.88; }
  .btn-ghost {
    margin-top: 12px; width: 100%; padding: 12px; background: transparent;
    border: 1.5px solid rgba(255,255,255,0.12); border-radius: 8px;
    font-family: var(--sans); font-size: 0.82rem; font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.4);
    cursor: pointer; transition: all 0.15s;
  }
  .btn-ghost:hover { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.7); }
  .error { margin-top: 14px; font-size: 0.82rem; color: #ff6b6b; }
  .hint { margin-top: 14px; font-size: 0.78rem; color: rgba(255,255,255,0.3); line-height: 1.5; }
  .hint strong { color: rgba(255,255,255,0.6); font-weight: 500; }
  .back-link { display: inline-block; margin-top: 32px; font-size: 0.78rem; color: rgba(255,255,255,0.35); text-decoration: none; transition: color 0.15s; cursor: pointer; background: none; border: none; padding: 0; font-family: var(--sans); }
  .back-link:hover { color: rgba(255,255,255,0.7); }
  .step-indicator { display: flex; gap: 6px; margin-bottom: 40px; }
  .step-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.15); transition: background 0.2s; }
  .step-dot.active { background: var(--accent); }
  .step-dot.done { background: rgba(255,255,255,0.35); }
`

export default function LoginPage() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const supabase = createClient()

  // Normalize to E.164 (+1 for US)
  const normalizePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
  }

  // Step 1: Send OTP
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

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

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const pendingPhone = sessionStorage.getItem('pending_phone') || normalizePhone(phone)

    const { data, error } = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token: otp,
      type: 'sms',
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const user = data.user
    if (!user) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Check if this user already has an email in profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', user.id)
      .single()

    if (profile?.email) {
      // Returning user — route by role
      router.push(profile.role === 'creator' ? '/dashboard' : '/')
    } else {
      // New user — collect email
      setStep('email')
    }
    setLoading(false)
  }

  // Step 3: Collect email + run matching
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Upsert profile with email
    await supabase
      .from('profiles')
      .upsert({ id: user.id, email, phone_number: user.phone })

    // Run the matching function
    const { data: role, error: matchError } = await supabase.rpc('match_user_to_entities', {
      p_user_id: user.id,
      p_email: email,
    })

    if (matchError) {
      setError(matchError.message)
      setLoading(false)
      return
    }

    sessionStorage.removeItem('pending_phone')
    router.push(role === 'creator' ? '/dashboard' : '/')
  }

  const stepIndex = { phone: 0, otp: 1, email: 2 }[step]

  return (
    <>
      <style>{STYLES}</style>
      <div className="wrap">
        <div className="card">
          <div className="wordmark">The <em>785</em></div>

          {/* Step indicators */}
          <div className="step-indicator">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={`step-dot ${i === stepIndex ? 'active' : i < stepIndex ? 'done' : ''}`}
              />
            ))}
          </div>

          {/* ── STEP 1: Phone ── */}
          {step === 'phone' && (
            <>
              <h1 className="heading">Sign<br />In</h1>
              <p className="sub">Enter your phone number and we'll send you a verification code.</p>
              <form onSubmit={handleSendOTP}>
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="(785) 000-0000"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                />
                {error && <div className="error">{error}</div>}
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Code'}
                </button>
              </form>
              <a href="/" className="back-link">← Back to The 785</a>
            </>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === 'otp' && (
            <>
              <h1 className="heading">Enter<br />Code</h1>
              <p className="sub">We sent a 6-digit code to <strong style={{color: 'rgba(255,255,255,0.8)'}}>{phone}</strong>.</p>
              <form onSubmit={handleVerifyOTP}>
                <label htmlFor="otp">Verification Code</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  className="otp-input"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  autoComplete="one-time-code"
                />
                {error && <div className="error">{error}</div>}
                <button type="submit" className="btn" disabled={loading || otp.length < 6}>
                  {loading ? 'Verifying…' : 'Verify Code'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => { setStep('phone'); setOtp(''); setError('') }}>
                  ← Change Number
                </button>
              </form>
              <div className="hint">Didn't get it? Check that your number is correct and try again.</div>
            </>
          )}

          {/* ── STEP 3: Email ── */}
          {step === 'email' && (
            <>
              <h1 className="heading">Your<br />Email</h1>
              <p className="sub">Enter the email address associated with your artist, venue, or event page. This connects you to your profile.</p>
              <form onSubmit={handleEmailSubmit}>
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                {error && <div className="error">{error}</div>}
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? 'Checking…' : 'Continue'}
                </button>
              </form>
              <div className="hint">Don't have a profile yet? <strong>No worries</strong> — you'll be taken to the home page and can explore The 785.</div>
            </>
          )}

        </div>
      </div>
    </>
  )
}
