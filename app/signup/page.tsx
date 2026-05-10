'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

const supabase = createClient()

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f5f4f1' }} />}>
      <SignupInner />
    </Suspense>
  )
}

function SignupInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/dashboard'

  const [mode, setMode] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const normalizePhone = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.startsWith('1')) return `+${digits}`
    return `+1${digits}`
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (error) { setError(error.message); return }
    setStep('otp')
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const normalized = normalizePhone(phone)
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized })
    setLoading(false)
    if (error) { setError(error.message); return }
    setPhone(normalized)
    setStep('otp')
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = mode === 'email'
      ? await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
      : await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })

    setLoading(false)
    if (error) { setError(error.message); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Could not load user.'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, email, phone_number, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()

    // New users (or anyone with incomplete profile) → onboarding
    if (
      !profile?.username ||
      !profile?.email ||
      !profile?.phone_number ||
      !profile?.onboarding_completed
    ) {
      router.push('/onboarding')
      return
    }

    // Already-complete returning users → wherever they were headed
    router.push(nextPath)
  }

  const resetToInput = () => {
    setStep('input')
    setOtp('')
    setError('')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg:     #f5f4f1;
          --white:  #ffffff;
          --text:   #1a1a1a;
          --muted:  #6b6b6b;
          --hint:   #aaaaaa;
          --border: rgba(0,0,0,0.08);
          --borders:rgba(0,0,0,0.12);
          --brand:  #C80650;
          --yellow: #FFCE03;
          --serif:  'Oswald', sans-serif;
          --sans:   'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--bg); color: var(--text); font-family: var(--sans); -webkit-font-smoothing: antialiased; min-height: 100vh; }

        .topbar { background: var(--white); border-bottom: 0.5px solid var(--borders); display: flex; align-items: center; padding: 0 20px; height: 52px; position: sticky; top: 0; z-index: 100; }
        .wordmark { font-family: var(--serif); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; text-decoration: none; color: rgba(0,0,0,0.35); }
        .wordmark em { font-style: normal; color: var(--brand); }
        .topbar-right { margin-left: auto; }
        .topbar-link { font-size: 0.75rem; font-weight: 600; padding: 7px 13px; border-radius: 6px; border: 0.5px solid var(--borders); text-decoration: none; color: var(--text); }

        .layout { display: grid; grid-template-columns: 1.1fr 1fr; min-height: calc(100vh - 52px); max-width: 1100px; margin: 0 auto; }

        /* ── BENEFITS SIDE ─────────────────────────────────────────── */
        .pitch { padding: 60px 56px; display: flex; flex-direction: column; justify-content: center; }
        .pitch-eyebrow { font-size: 0.68rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand); font-weight: 700; margin-bottom: 12px; }
        .pitch-title { font-family: var(--serif); font-size: 3rem; font-weight: 700; line-height: 1; color: var(--text); margin-bottom: 14px; letter-spacing: -0.01em; }
        .pitch-sub { font-size: 0.95rem; color: var(--muted); line-height: 1.55; margin-bottom: 36px; max-width: 380px; }

        .benefits { display: flex; flex-direction: column; gap: 22px; max-width: 420px; }
        .benefit { display: flex; gap: 14px; }
        .benefit-num { font-family: var(--serif); font-size: 0.95rem; font-weight: 700; color: var(--brand); line-height: 1.4; min-width: 20px; }
        .benefit-body { flex: 1; }
        .benefit-title { font-size: 0.95rem; font-weight: 600; color: var(--text); margin-bottom: 3px; line-height: 1.35; }
        .benefit-desc { font-size: 0.82rem; color: var(--muted); line-height: 1.5; }

        .pitch-foot { margin-top: 36px; padding-top: 24px; border-top: 0.5px solid var(--borders); font-size: 0.78rem; color: var(--hint); max-width: 380px; }
        .pitch-foot a { color: var(--brand); text-decoration: none; font-weight: 600; }

        /* ── FORM SIDE ─────────────────────────────────────────────── */
        .form-side { background: var(--white); border-left: 0.5px solid var(--borders); padding: 60px 56px; display: flex; flex-direction: column; justify-content: center; }
        .form-wrap { width: 100%; max-width: 360px; }
        .form-title { font-family: var(--serif); font-size: 1.6rem; font-weight: 700; color: var(--text); margin-bottom: 6px; letter-spacing: 0.01em; }
        .form-sub { font-size: 0.85rem; color: var(--muted); margin-bottom: 28px; line-height: 1.5; }

        .mode-toggle { display: flex; gap: 6px; margin-bottom: 18px; }
        .mode-btn { flex: 1; padding: 10px; border-radius: 6px; border: 0.5px solid var(--borders); background: var(--bg); font-size: 0.78rem; font-weight: 600; color: var(--muted); cursor: pointer; transition: all 0.15s; }
        .mode-btn.active { background: var(--text); color: #fff; border-color: var(--text); }

        .input { width: 100%; padding: 13px 15px; background: var(--bg); border: 0.5px solid var(--borders); border-radius: 8px; font-family: var(--sans); font-size: 0.92rem; color: var(--text); outline: none; transition: border-color 0.15s; }
        .input:focus { border-color: var(--text); }
        .input.otp { text-align: center; font-size: 1.4rem; letter-spacing: 0.4em; padding: 14px; font-family: var(--serif); }

        .submit-btn { width: 100%; padding: 13px; background: var(--brand); color: #fff; border: none; border-radius: 8px; font-family: var(--sans); font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s; margin-top: 14px; }
        .submit-btn:hover:not(:disabled) { opacity: 0.9; }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .form-error { font-size: 0.82rem; color: var(--brand); margin-top: 8px; }

        .form-foot { font-size: 0.78rem; color: var(--muted); margin-top: 18px; text-align: center; }
        .form-foot a { color: var(--brand); text-decoration: none; font-weight: 600; }

        .reset-btn { width: 100%; padding: 10px; background: transparent; border: none; font-size: 0.78rem; color: var(--muted); cursor: pointer; margin-top: 6px; }
        .reset-btn:hover { color: var(--text); }

        /* ── RESPONSIVE ────────────────────────────────────────────── */
        @media (max-width: 860px) {
          .layout { grid-template-columns: 1fr; }
          .pitch { padding: 40px 24px 30px; text-align: center; }
          .pitch-sub { margin-left: auto; margin-right: auto; }
          .benefits { margin: 0 auto; text-align: left; }
          .pitch-foot { margin-left: auto; margin-right: auto; }
          .form-side { padding: 30px 24px 60px; border-left: none; border-top: 0.5px solid var(--borders); }
          .form-wrap { margin: 0 auto; }
          .pitch-title { font-size: 2.2rem; }
        }
      `}</style>

      <header className="topbar">
        <a href="/" className="wordmark"><em>785</em>MAGAZINE</a>
        <div className="topbar-right">
          <a href="/login" className="topbar-link">Sign In</a>
        </div>
      </header>

      <div className="layout">

        {/* ── LEFT: pitch ──────────────────────────────────────────── */}
        <section className="pitch">
          <div className="pitch-eyebrow">Join 785</div>
          <h1 className="pitch-title">
            Your local scene,<br/>in one place.
          </h1>
          <p className="pitch-sub">
            seveneightfive is the home of arts, music, and events
            in Topeka and beyond. Free to join — always.
          </p>

          <div className="benefits">
            <div className="benefit">
              <div className="benefit-num">01</div>
              <div className="benefit-body">
                <div className="benefit-title">Tickets &amp; RSVPs in one place</div>
                <div className="benefit-desc">
                  Buy tickets to local events, RSVP to free ones,
                  and keep them all in your pocket.
                </div>
              </div>
            </div>

            <div className="benefit">
              <div className="benefit-num">02</div>
              <div className="benefit-body">
                <div className="benefit-title">Follow artists &amp; venues</div>
                <div className="benefit-desc">
                  Get notified when the people and places you care
                  about announce new events or releases.
                </div>
              </div>
            </div>

            <div className="benefit">
              <div className="benefit-num">03</div>
              <div className="benefit-body">
                <div className="benefit-title">Sell, promote, publish</div>
                <div className="benefit-desc">
                  Run your own events, take ticket payments, place
                  ads, and post announcements — all from your dashboard.
                </div>
              </div>
            </div>
          </div>

          <div className="pitch-foot">
            Already have an account? <a href="/login">Sign in here →</a>
          </div>
        </section>

        {/* ── RIGHT: form ──────────────────────────────────────────── */}
        <section className="form-side">
          <div className="form-wrap">
            {step === 'input' ? (
              <>
                <div className="form-title">Create your account</div>
                <div className="form-sub">
                  We'll send a 6-digit code to verify it's you.
                  No password needed.
                </div>

                <div className="mode-toggle">
                  <button
                    type="button"
                    onClick={() => { setMode('email'); setError('') }}
                    className={`mode-btn${mode === 'email' ? ' active' : ''}`}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('phone'); setError('') }}
                    className={`mode-btn${mode === 'phone' ? ' active' : ''}`}
                  >
                    Phone
                  </button>
                </div>

                {mode === 'email' ? (
                  <form onSubmit={handleEmailSubmit}>
                    <input
                      type="email"
                      required
                      placeholder="you@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="input"
                      autoFocus
                    />
                    {error && <div className="form-error">{error}</div>}
                    <button type="submit" disabled={loading} className="submit-btn">
                      {loading ? 'Sending…' : 'Send 6-digit code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handlePhoneSubmit}>
                    <input
                      type="tel"
                      required
                      placeholder="(785) 555-1234"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="input"
                      autoFocus
                    />
                    {error && <div className="form-error">{error}</div>}
                    <button type="submit" disabled={loading} className="submit-btn">
                      {loading ? 'Sending…' : 'Send 6-digit code'}
                    </button>
                  </form>
                )}

                <div className="form-foot">
                  By continuing, you agree to our{' '}
                  <a href="/terms">Terms</a> and{' '}
                  <a href="/privacy">Privacy Policy</a>.
                </div>
              </>
            ) : (
              <>
                <div className="form-title">Check your {mode === 'email' ? 'inbox' : 'phone'}</div>
                <div className="form-sub">
                  We sent a 6-digit code to <strong>{mode === 'email' ? email : phone}</strong>.
                </div>

                <form onSubmit={handleVerify}>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="input otp"
                    autoFocus
                  />
                  {error && <div className="form-error">{error}</div>}
                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="submit-btn"
                  >
                    {loading ? 'Verifying…' : 'Verify & Continue'}
                  </button>
                </form>

                <button type="button" onClick={resetToInput} className="reset-btn">
                  Use a different {mode === 'email' ? 'email' : 'phone number'}
                </button>
              </>
            )}
          </div>
        </section>

      </div>
    </>
  )
}
