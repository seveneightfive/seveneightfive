'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'

type Step = 'phone' | 'otp' | 'onboarding' | 'loading'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  const [step, setStep] = useState<Step>('phone')

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const normalizePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizePhone(phone),
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setStep('otp')
    }

    setLoading(false)
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalizePhone(phone),
      token: otp,
      type: 'sms',
    })

    if (error || !data.user) {
      setError(error?.message || 'Login failed')
      setLoading(false)
      return
    }

    // check if profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, onboarding_completed')
      .eq('id', data.user.id)
      .maybeSingle()

    if (!profile) {
      setStep('onboarding')
    } else {
      router.push('/dashboard')
    }

    setLoading(false)
  }

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    // 1. create/update profile
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      email,
      full_name: `${firstName} ${lastName}`,
      onboarding_completed: true,
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    // 2. AUTO-CLAIM ARTISTS
    const { data: artists } = await supabase
      .from('artists')
      .select('id')
      .eq('artist_email', email)

    if (artists) {
      await Promise.all(
        artists.map((a) =>
          supabase.from('artist_users').upsert({
            artist_id: a.id,
            user_id: user.id,
            email,
            role: 'creator',
          })
        )
      )
    }

    // 3. AUTO-CLAIM EVENTS
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('creator_email', email)

    if (events) {
      await Promise.all(
        events.map((e) =>
          supabase.from('event_users').upsert({
            event_id: e.id,
            user_id: user.id,
            email,
            role: 'creator',
          })
        )
      )
    }

    // 4. (optional) venues if you add email field later
    const { data: venues } = await supabase
      .from('venues')
      .select('id')
      .eq('email', email)
      .catch(() => ({ data: null }))

    if (venues) {
      await Promise.all(
        venues.map((v) =>
          supabase.from('venue_users').upsert({
            venue_id: v.id,
            user_id: user.id,
            email,
            role: 'creator',
          })
        )
      )
    }

    setLoading(false)
    router.push('/dashboard')
  }

  return (
    <div style={{ padding: 24, maxWidth: 420, margin: '0 auto', color: '#fff' }}>
      <h1>Login</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* PHONE */}
      {step === 'phone' && (
        <form onSubmit={handleSendOTP}>
          <input
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button disabled={loading}>
            {loading ? 'Sending...' : 'Send Code'}
          </button>
        </form>
      )}

      {/* OTP */}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOTP}>
          <input
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button disabled={loading}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      )}

      {/* ONBOARDING */}
      {step === 'onboarding' && (
        <form onSubmit={handleOnboarding}>
          <input
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />

          <input
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />

          <input
            placeholder="Email (used to match pages)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button disabled={loading}>
            {loading ? 'Setting up...' : 'Finish Setup'}
          </button>
        </form>
      )}
    </div>
  )
}
