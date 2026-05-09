'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'

const supabase = createClient()

export default function OnboardingPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')

  const [step, setStep] = useState<'profile' | 'verify-phone'>('profile')

  const [error, setError] = useState('')

  const normalizePhone = (value: string) => {
    const digits = value.replace(/\D/g, '')

    if (digits.startsWith('1')) {
      return `+${digits}`
    }

    return `+1${digits}`
  }

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile?.onboarding_completed) {
        router.push('/dashboard')
        return
      }

      setFullName(profile?.full_name || '')
      setPhone(profile?.phone_number || '')

      setLoading(false)
    }

    load()
  }, [router])

  const sendPhoneVerification = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    setSaving(true)
    setError('')

    const normalizedPhone = normalizePhone(phone)

    const { error } = await supabase.auth.updateUser({
      phone: normalizedPhone,
    })

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    setStep('verify-phone')
    setSaving(false)
  }

  const verifyPhone = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    setSaving(true)
    setError('')

    const normalizedPhone = normalizePhone(phone)

    const { error: otpError } =
      await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp,
        type: 'phone_change',
      })

    if (otpError) {
      setError(otpError.message)
      setSaving(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        username,
        phone_number: normalizedPhone,
        onboarding_completed: true,
        onboarding_completed_at:
          new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (profileError) {
      setError(profileError.message)
      setSaving(false)
      return
    }

    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {step === 'profile' && (
          <form
            onSubmit={sendPhoneVerification}
            className="space-y-4"
          >
            <h1 className="text-5xl font-bold">
              Complete Your Profile
            </h1>

            <input
              className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) =>
                setFullName(e.target.value)
              }
              required
            />

            <input
              className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
              placeholder="Username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              required
            />

            <input
              className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
              placeholder="Phone Number"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value)
              }
              required
            />

            {error && (
              <div className="text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full p-4 rounded bg-pink-600"
            >
              {saving
                ? 'Sending Code...'
                : 'Continue'}
            </button>
          </form>
        )}

        {step === 'verify-phone' && (
          <form
            onSubmit={verifyPhone}
            className="space-y-4"
          >
            <h1 className="text-5xl font-bold">
              Verify Phone
            </h1>

            <input
              className="w-full p-4 rounded bg-zinc-900 border border-zinc-700 text-center tracking-[0.3em]"
              placeholder="000000"
              value={otp}
              onChange={(e) =>
                setOtp(
                  e.target.value.replace(/\D/g, '')
                )
              }
              maxLength={6}
            />

            {error && (
              <div className="text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || otp.length < 6}
              className="w-full p-4 rounded bg-pink-600"
            >
              {saving
                ? 'Verifying...'
                : 'Complete Setup'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
