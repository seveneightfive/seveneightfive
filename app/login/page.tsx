'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'

const supabase = createClient()

export default function LoginPage() {
  const router = useRouter()

  const [step, setStep] = useState<'phone' | 'otp'>('phone')

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const normalizePhone = (value: string) => {
    const digits = value.replace(/\D/g, '')

    if (digits.startsWith('1')) {
      return `+${digits}`
    }

    return `+1${digits}`
  }

  const sendOtp = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizePhone(phone),
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setStep('otp')
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

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single()

    if (!profile?.onboarding_completed) {
      router.push('/onboarding')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1814] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">

        <h1 className="text-5xl font-bold uppercase">
          The 785
        </h1>

        {step === 'phone' && (
          <>
            <input
              className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
              placeholder="(785) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <button
              onClick={sendOtp}
              disabled={loading || !phone}
              className="w-full p-4 rounded bg-pink-600"
            >
              {loading ? 'Sending...' : 'Continue'}
            </button>
          </>
        )}

        {step === 'otp' && (
          <>
            <input
              className="w-full p-4 rounded bg-zinc-900 border border-zinc-700 text-center tracking-[0.3em]"
              placeholder="000000"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, ''))
              }
              maxLength={6}
            />

            <button
              onClick={verifyOtp}
              disabled={loading || otp.length < 6}
              className="w-full p-4 rounded bg-pink-600"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            <button
              onClick={() => setStep('phone')}
              className="w-full p-4 rounded border border-zinc-700"
            >
              Change Number
            </button>
          </>
        )}

        {error && (
          <div className="text-red-400 text-sm">
            {error}
          </div>
        )}

      </div>
    </div>
  )
}
