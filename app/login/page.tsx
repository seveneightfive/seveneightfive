'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'

const supabase = createClient()

export default function LoginPage() {
  const router = useRouter()

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

  // ── EMAIL: send 6-digit code (no magic link) ───────────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // shouldCreateUser left at default true so signup uses the same flow
        // No emailRedirectTo: forces Supabase to send a 6-digit code instead
        // of a clickable magic link that email pre-fetchers can burn.
      },
    })

    setLoading(false)
    if (error) { setError(error.message); return }
    setStep('otp')
  }

  // ── PHONE: send 6-digit code (unchanged) ───────────────────────────
  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const normalizedPhone = normalizePhone(phone)
    const { error } = await supabase.auth.signInWithOtp({ phone: normalizedPhone })

    setLoading(false)
    if (error) { setError(error.message); return }

    setPhone(normalizedPhone)
    setStep('otp')
  }

  // ── VERIFY: works for both email and phone ─────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
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
      .select('*')
      .eq('id', user.id)
      .single()

    if (
      !profile?.username ||
      !profile?.email ||
      !profile?.phone_number ||
      !profile?.onboarding_completed
    ) {
      router.push('/onboarding')
      return
    }

    router.push('/dashboard')
  }

  // ── Resend / change destination ────────────────────────────────────
  const resetToInput = () => {
    setStep('input')
    setOtp('')
    setError('')
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        <div className="mb-10">
          <h1 className="text-5xl font-bold mb-3">Welcome</h1>
          <p className="text-zinc-400">
            {step === 'otp'
              ? `Enter the 6-digit code we sent to ${mode === 'email' ? email : phone}.`
              : 'Sign in to your account.'}
          </p>
        </div>

        {/* Mode toggle (only when entering email/phone) */}
        {step === 'input' && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setMode('email'); setError('') }}
              className={`flex-1 p-3 rounded ${mode === 'email' ? 'bg-pink-600' : 'bg-zinc-900'}`}
            >
              Email
            </button>
            <button
              onClick={() => { setMode('phone'); setError('') }}
              className={`flex-1 p-3 rounded ${mode === 'phone' ? 'bg-pink-600' : 'bg-zinc-900'}`}
            >
              Phone
            </button>
          </div>
        )}

        {/* Step 1: enter email */}
        {step === 'input' && mode === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <input
              type="email"
              required
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
            />
            {error && <div className="text-red-400">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full p-4 rounded bg-pink-600 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send 6-Digit Code'}
            </button>
          </form>
        )}

        {/* Step 1: enter phone */}
        {step === 'input' && mode === 'phone' && (
          <form onSubmit={handlePhoneLogin} className="space-y-4">
            <input
              type="tel"
              required
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
            />
            {error && <div className="text-red-400">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full p-4 rounded bg-pink-600 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send 6-Digit Code'}
            </button>
          </form>
        )}

        {/* Step 2: verify code (used for both email and phone) */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full p-4 rounded bg-zinc-900 border border-zinc-700 text-center text-2xl tracking-[0.4em]"
              autoFocus
            />
            {error && <div className="text-red-400">{error}</div>}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full p-4 rounded bg-pink-600 disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={resetToInput}
              disabled={loading}
              className="w-full text-sm text-zinc-500 hover:text-zinc-300"
            >
              Use a different {mode === 'email' ? 'email' : 'phone number'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
