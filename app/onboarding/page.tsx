'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'

const supabase = createClient()

type Step = 'profile' | 'seller'

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile fields
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // Seller step
  const [wantsToSell, setWantsToSell] = useState<null | boolean>(null)
  const [connecting, setConnecting] = useState(false)

  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // Already fully onboarded? Send to dashboard.
      if (
        profile?.onboarding_completed &&
        profile?.username &&
        profile?.email &&
        profile?.phone_number
      ) {
        router.push('/dashboard')
        return
      }

      setFullName(profile?.full_name || '')
      setUsername(profile?.username || '')
      setEmail(profile?.email || user.email || '')
      setPhone(profile?.phone_number || user.phone || '')
      setLoading(false)
    }
    load()
  }, [router])

  // ── Step 1: profile ──────────────────────────────────────────────
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error: authError } = await supabase.auth.updateUser({
      email,
      phone,
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
        phone_number: phone,
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
  const finishOnboarding = async (next: 'dashboard' | 'stripe') => {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase
      .from('profiles')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (next === 'stripe') {
      setConnecting(true)
      try {
        const res = await fetch('/api/stripe/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ returnPath: '/dashboard/settings/payouts' }),
        })
        const json = await res.json()
        if (!res.ok || !json.url) throw new Error(json.error || 'Stripe error')
        window.location.href = json.url
        return
      } catch (err: any) {
        setError(err?.message || 'Could not start Stripe onboarding — you can connect later from Settings.')
        setConnecting(false)
        setSaving(false)
        // Fall through to dashboard so they aren't stuck
        router.push('/dashboard')
        return
      }
    }

    setSaving(false)
    router.push('/dashboard')
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
          <input
            required
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
          />

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
            onClick={() => setWantsToSell(true)}
            className={`w-full p-4 rounded text-left border transition ${
              wantsToSell === true
                ? 'border-pink-500 bg-pink-600/10'
                : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
            }`}
          >
            <div className="font-semibold">Yes — set me up to sell</div>
            <div className="text-sm text-zinc-400 mt-1">
              Connect Stripe (3–5 min). You'll need a U.S. bank account, your
              legal name, date of birth, and last 4 of your SSN.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setWantsToSell(false)}
            className={`w-full p-4 rounded text-left border transition ${
              wantsToSell === false
                ? 'border-zinc-400 bg-zinc-800'
                : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
            }`}
          >
            <div className="font-semibold">Not right now</div>
            <div className="text-sm text-zinc-400 mt-1">
              I'm just here to attend events and follow artists. I can connect
              Stripe later if I change my mind.
            </div>
          </button>
        </div>

        {error && <div className="text-red-400">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep('profile')}
            disabled={saving || connecting}
            className="px-5 py-3 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            disabled={wantsToSell === null || saving || connecting}
            onClick={() => finishOnboarding(wantsToSell ? 'stripe' : 'dashboard')}
            className="flex-1 p-3 rounded bg-pink-600 disabled:opacity-50"
          >
            {connecting
              ? 'Opening Stripe…'
              : saving
                ? 'Finishing up…'
                : wantsToSell === true
                  ? 'Continue to Stripe →'
                  : wantsToSell === false
                    ? 'Take me to my dashboard'
                    : 'Choose an option'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => finishOnboarding('dashboard')}
          disabled={saving || connecting}
          className="w-full text-sm text-zinc-500 hover:text-zinc-300 mt-2"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
