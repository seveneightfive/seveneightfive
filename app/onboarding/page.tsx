'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'

const supabase = createClient()

type Step = 'profile' | 'seller'

// Formats raw digits into "(785) 555-1234" as the user types.
// US-only — caps at 10 digits, no country code shown or typed.
function formatPhoneDisplay(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// Converts a 10-digit US number to E.164 for Supabase Auth / DB.
// Returns null if it's not a complete 10-digit number.
function toE164(displayValue: string): string | null {
  const digits = displayValue.replace(/\D/g, '')
  if (digits.length !== 10) return null
  return `+1${digits}`
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageInner />
    </Suspense>
  )
}

function OnboardingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Final destination once onboarding is fully complete. Login passes this
  // through as ?next=<path> so a brand-new user still lands back where they
  // started (e.g. the ticket page they clicked "sign in" from) instead of
  // always being dropped on /dashboard.
  const returnPath = searchParams.get('next') || '/dashboard'
  // If the session drops mid-onboarding and we bounce to /login, carry the
  // same return path through login → onboarding again.
  const loginRedirect = `/login?next=${encodeURIComponent(
    `/onboarding${returnPath !== '/dashboard' ? `?next=${encodeURIComponent(returnPath)}` : ''}`
  )}`

  const [step, setStep] = useState<Step>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile fields
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('') // display format, e.g. "(785) 555-1234"

  // Seller step
  const [connecting, setConnecting] = useState(false)

  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(loginRedirect); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // Already fully onboarded? Send them on to their destination.
      if (
        profile?.onboarding_completed &&
        profile?.username &&
        profile?.email &&
        profile?.phone_number
      ) {
        router.push(returnPath)
        return
      }

      setFullName(profile?.full_name || '')
      setUsername(profile?.username || '')
      setEmail(profile?.email || user.email || '')
      // Existing stored numbers may already be E.164 ("+17855551234")
      // or a raw 10-digit string — normalize either to the display format.
      const existingPhone = profile?.phone_number || user.phone || ''
      setPhone(formatPhoneDisplay(existingPhone))
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneDisplay(e.target.value))
    if (error) setError('')
  }

  // ── Step 1: profile ──────────────────────────────────────────────
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const normalizedPhone = toE164(phone)
    if (!normalizedPhone) {
      setError('Please enter a valid 10-digit phone number.')
      return
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(loginRedirect); return }

    const { error: authError } = await supabase.auth.updateUser({
      email,
      phone: normalizedPhone,
      data: { full_name: fullName },
    })

    if (authError) {
      setError(authError.message)
      setSaving(false)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        username,
        email,
        phone_number: normalizedPhone,
        // We don't mark onboarding_completed here — only after step 2
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (profileError) {
      setError(profileError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setStep('seller')
  }

  // ── Step 2: finish (with or without Stripe) ──────────────────────
  // Called directly from the Yes/No buttons below — no separate
  // "Continue" click needed. sellerChoice='stripe' takes the user straight
  // into Stripe Connect onboarding; sellerChoice='dashboard' skips it and
  // sends them on to returnPath.
  const finishOnboarding = async (sellerChoice: 'dashboard' | 'stripe') => {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(loginRedirect); return }

    await supabase
      .from('profiles')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (sellerChoice === 'stripe') {
      setConnecting(true)
      try {
        const res = await fetch('/api/stripe/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ returnPath: '/dashboard/payouts' }),
        })
        const json = await res.json()
        if (!res.ok || !json.url) throw new Error(json.error || 'Stripe error')
        window.location.href = json.url
        return
      } catch (err: any) {
        setError(err?.message || 'Could not start Stripe onboarding — you can connect later from Settings.')
        setConnecting(false)
        setSaving(false)
        // Fall through to their destination so they aren't stuck
        router.push(returnPath)
        return
      }
    }

    setSaving(false)
    router.push(returnPath)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────
  if (step === 'profile') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <form onSubmit={handleProfileSubmit} className="w-full max-w-md space-y-4">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
              Step 1 of 2
            </div>
            <h1 className="text-5xl font-bold mb-3">Complete Your Profile</h1>
            <p className="text-zinc-400">Finish setting up your account.</p>
          </div>

          <input
            required
            placeholder="Full Name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
          />
          <input
            required
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
          />

          <div>
            <div className="flex gap-2">
              <div className="flex items-center px-3 rounded bg-zinc-900 border border-zinc-700 text-zinc-400 text-sm font-medium">
                🇺🇸 +1
              </div>
              <input
                required
                type="tel"
                inputMode="numeric"
                placeholder="(785) 000-0000"
                value={phone}
                onChange={handlePhoneChange}
                className="flex-1 p-4 rounded bg-zinc-900 border border-zinc-700"
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">U.S. numbers only — just enter the 10 digits.</p>
          </div>

          {error && <div className="text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={saving}
            className="w-full p-4 rounded bg-pink-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    )
  }

  // ── Step 2: seller question ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
            Step 2 of 2
          </div>
          <h1 className="text-4xl font-bold mb-3 leading-tight">
            Will you be selling tickets, taking donations, or running ads?
          </h1>
          <p className="text-zinc-400">
            We use Stripe Connect so payouts go straight to your bank.
            You can skip this and set it up later from Settings.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => finishOnboarding('stripe')}
            disabled={saving || connecting}
            className="w-full p-4 rounded text-left border border-pink-500 bg-pink-600/10 hover:bg-pink-600/20 transition disabled:opacity-50"
          >
            <div className="font-semibold">
              {connecting ? 'Opening Stripe…' : saving ? 'Setting up…' : 'Yes — set me up to sell'}
            </div>
            <div className="text-sm text-zinc-400 mt-1">
              You'll be sent to Stripe next (3–5 min). You'll need a U.S.
              bank account, your legal name, date of birth, and last 4 of
              your SSN.
            </div>
          </button>

          <button
            type="button"
            onClick={() => finishOnboarding('dashboard')}
            disabled={saving || connecting}
            className="w-full p-4 rounded text-left border border-zinc-700 bg-zinc-900 hover:border-zinc-500 transition disabled:opacity-50"
          >
            <div className="font-semibold">
              {saving && !connecting ? 'Taking you onward…' : 'Not right now'}
            </div>
            <div className="text-sm text-zinc-400 mt-1">
              I'm just here to attend events and follow artists. I can connect
              Stripe later from Settings if I change my mind.
            </div>
          </button>
        </div>

        {error && <div className="text-red-400">{error}</div>}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setStep('profile')}
            disabled={saving || connecting}
            className="px-5 py-3 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 disabled:opacity-50"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
