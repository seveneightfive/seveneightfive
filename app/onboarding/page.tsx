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

      if (profile?.onboarding_completed) {
        router.push('/dashboard')
        return
      }

      setFullName(profile?.full_name || '')
      setEmail(profile?.email || '')

      setLoading(false)
    }

    load()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
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

    // UPDATE AUTH EMAIL
    if (email && email !== user.email) {
      const { error: authError } = await supabase.auth.updateUser({
        email,
      })

      if (authError) {
        setError(authError.message)
        setSaving(false)
        return
      }
    }

    // UPDATE PROFILE
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        username,
        email,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
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
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4"
      >
        <h1 className="text-4xl font-bold">
          Complete Your Profile
        </h1>

        <input
          className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <input
          className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
