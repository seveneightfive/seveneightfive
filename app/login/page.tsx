'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter, useSearchParams } from 'next/navigation'

type Mode = 'phone' | 'email'
type Step = 'auth' | 'otp' | 'magic_sent'

const supabase = createClient()

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1a1814; color: #fff; font-family: system-ui; }
  .wrap { min-height: 100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .card { width:100%; max-width:420px; }
  input { width:100%; padding:14px; margin-top:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.06); color:#fff; }
  button { width:100%; margin-top:12px; padding:14px; border:none; border-radius:8px; background:#C80650; color:#fff; font-weight:600; cursor:pointer; }
  button:disabled { opacity:0.5; }
  .tabs { display:flex; margin-bottom:20px; }
  .tabs button { flex:1; background:none; border:1px solid rgba(255,255,255,0.1); }
  .active { border-color:#C80650; }
  .error { color:#ff6b6b; margin-top:10px; }
`

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextUrl = searchParams.get('next') || '/dashboard'

  const [mode, setMode] = useState<Mode>('phone')
  const [step, setStep] = useState<Step>('auth')

  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const normalizePhone = (p: string) => {
    const digits = p.replace(/\D/g, '')
    return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
  }

  // ─────────────────────────────
  // PHONE OTP
  // ─────────────────────────────
  const sendOtp = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizePhone(phone),
    })

    if (error) setError(error.message)
    else setStep('otp')

    setLoading(false)
  }

  const verifyOtp = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.verifyOtp({
      phone: normalizePhone(phone),
      token: otp,
      type: 'sms',
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(nextUrl)
  }

  // ─────────────────────────────
  // EMAIL MAGIC LINK
  // ─────────────────────────────
  const sendMagicLink = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`
      }
    })

    if (error) {
      setError(error.message)
    } else {
      setStep('magic_sent')
    }

    setLoading(false)
  }

  return (
    <>
      <style>{STYLES}</style>

      <div className="wrap">
        <div className="card">

          {/* MODE TOGGLE */}
          {step === 'auth' && (
            <>
              <div className="tabs">
                <button
                  className={mode === 'phone' ? 'active' : ''}
                  onClick={() => setMode('phone')}
                >
                  Phone
                </button>
                <button
                  className={mode === 'email' ? 'active' : ''}
                  onClick={() => setMode('email')}
                >
                  Email
                </button>
              </div>

              {/* PHONE */}
              {mode === 'phone' && (
                <>
                  <h2>Phone Login</h2>
                  <input
                    placeholder="(785) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <button disabled={!phone || loading} onClick={sendOtp}>
                    {loading ? 'Sending...' : 'Send Code'}
                  </button>
                </>
              )}

              {/* EMAIL */}
              {mode === 'email' && (
                <>
                  <h2>Email Login</h2>
                  <input
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button disabled={!email || loading} onClick={sendMagicLink}>
                    {loading ? 'Sending...' : 'Send Magic Link'}
                  </button>
                </>
              )}

              {error && <div className="error">{error}</div>}
            </>
          )}

          {/* OTP STEP */}
          {step === 'otp' && (
            <>
              <h2>Enter Code</h2>
              <input
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              />
              <button disabled={otp.length < 6 || loading} onClick={verifyOtp}>
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <button
                onClick={() => {
                  setStep('auth')
                  setOtp('')
                }}
              >
                Back
              </button>

              {error && <div className="error">{error}</div>}
            </>
          )}

          {/* MAGIC LINK SENT */}
          {step === 'magic_sent' && (
            <>
              <h2>Check your email</h2>
              <p>We sent a login link to {email}</p>

              <button onClick={() => setStep('auth')}>
                Back
              </button>
            </>
          )}

        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  )
}
