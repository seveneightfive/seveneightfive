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
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [error, setError] = useState('')

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
      setEmail(
        profile?.email || user.email || ''
      )
      setPhone(
        profile?.phone_number ||
          user.phone ||
          ''
      )

      setLoading(false)
    }

    load()
  }, [router])

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    setSaving(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { error: authError } =
      await supabase.auth.updateUser({
        email,
        phone,
        data: {
          full_name: fullName,
        },
      })

    if (authError) {
      setError(authError.message)
      setSaving(false)
      return
    }

    const { error: profileError } =
      await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          username,
          email,
          phone_number: phone,
          onboarding_completed: true,
          onboarding_completed_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4"
      >
        <div className="mb-8">
          <h1 className="text-5xl font-bold mb-3">
            Complete Your Profile
          </h1>

          <p className="text-zinc-400">
            Finish setting up your account.
          </p>
        </div>

        <input
          required
          placeholder="Full Name"
          value={fullName}
          onChange={(e) =>
            setFullName(e.target.value)
          }
          className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
        />

        <input
          required
          placeholder="Username"
          value={username}
          onChange={(e) =>
            setUsername(e.target.value)
          }
          className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
        />

        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
        />

        <input
          required
          type="tel"
          placeholder="Phone Number"
          value={phone}
          onChange={(e) =>
            setPhone(e.target.value)
          }
          className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
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
            ? 'Saving...'
            : 'Continue'}
        </button>
      </form>
    </div>
  )
}
