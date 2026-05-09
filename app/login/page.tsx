'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'

const supabase = createClient()

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <h1 className="text-5xl font-bold">
            Check Your Email
          </h1>

          <p className="text-zinc-400">
            We sent a login link to:
          </p>

          <p className="text-white font-medium">
            {email}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">

        <h1 className="text-5xl font-bold uppercase">
          The 785
        </h1>

        <p className="text-zinc-400">
          Sign in or create an account
        </p>

        <input
          type="email"
          placeholder="you@example.com"
          className="w-full p-4 rounded bg-zinc-900 border border-zinc-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          onClick={handleLogin}
          disabled={loading || !email}
          className="w-full p-4 rounded bg-pink-600"
        >
          {loading ? 'Sending...' : 'Continue'}
        </button>

        {error && (
          <div className="text-red-400 text-sm">
            {error}
          </div>
        )}

      </div>
    </div>
  )
}
