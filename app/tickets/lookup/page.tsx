'use client'

// app/tickets/lookup/page.tsx
//
// Entry point for the "Manage Tickets" button on seller pages. Rather than
// building a bespoke email-lookup + hCaptcha + custom token system (what
// Ticket Tailor's popup does), this reuses Supabase's built-in passwordless
// magic-link sign-in. The buyer enters their email, gets a real sign-in
// link, and lands on /dashboard/tickets already authenticated — which
// creates an account automatically if they checked out as a guest. Same
// self-service outcome, but built on infrastructure that already exists
// instead of a parallel one-off system.

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import Link from 'next/link'

function LookupInner() {
  const searchParams = useSearchParams()
  const sellerSlug = searchParams.get('seller')

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('sending')
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard/tickets`,
      },
    })

    if (err) {
      setStatus('error')
      setError(err.message || 'Something went wrong. Please try again.')
      return
    }

    setStatus('sent')
  }

  return (
    <main className="lookup">
      <div className="lookup__card">
        <h1 className="lookup__title">Manage Your Tickets</h1>
        <p className="lookup__body">
          Enter the email you used to buy your tickets and we&apos;ll send you a secure
          link to view them — no password needed.
        </p>

        {status === 'sent' ? (
          <div className="lookup__sent">
            <p>
              <strong>Check your inbox.</strong> We sent a sign-in link to <strong>{email}</strong>.
              Click it to see your tickets — the link works on any device.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="lookup__form">
            <label htmlFor="email" className="lookup__label">Email address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="lookup__input"
            />
            {status === 'error' && <p className="lookup__error">{error}</p>}
            <button type="submit" disabled={status === 'sending'} className="lookup__submit">
              {status === 'sending' ? 'Sending…' : 'Send me a secure link'}
            </button>
          </form>
        )}

        {sellerSlug && (
          <p className="lookup__back">
            Got another question about this seller?{' '}
            <Link href={`/sellers/${sellerSlug}`}>Back to their page →</Link>
          </p>
        )}
      </div>
      <style>{styles}</style>
    </main>
  )
}

export default function TicketLookupPage() {
  return (
    <Suspense fallback={null}>
      <LookupInner />
    </Suspense>
  )
}

const styles = `
  .lookup {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.25rem;
    background: #f7f6f4;
    font-family: var(--font-dm-sans), system-ui, sans-serif;
    color: #14110f;
  }
  .lookup__card {
    width: 100%;
    max-width: 440px;
    background: #fff;
    border: 1px solid rgba(20,17,15,0.1);
    border-radius: 14px;
    padding: 2rem;
  }
  .lookup__title {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    text-transform: uppercase;
    margin: 0 0 0.6rem;
  }
  .lookup__body {
    font-size: 0.95rem;
    color: #6a635a;
    margin: 0 0 1.5rem;
    line-height: 1.5;
  }
  .lookup__form { display: flex; flex-direction: column; gap: 0.6rem; }
  .lookup__label {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6a635a;
  }
  .lookup__input {
    border: 1px solid rgba(20,17,15,0.18);
    border-radius: 8px;
    padding: 0.75rem 0.9rem;
    font-size: 1rem;
    outline: none;
  }
  .lookup__input:focus { border-color: #14110f; }
  .lookup__error {
    color: #c80650;
    font-size: 0.85rem;
    margin: 0;
  }
  .lookup__submit {
    margin-top: 0.4rem;
    background: #14110f;
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 0.85rem 1.2rem;
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .lookup__submit:disabled { opacity: 0.6; cursor: not-allowed; }
  .lookup__sent {
    background: rgba(0,150,80,0.08);
    border: 1px solid rgba(0,150,80,0.25);
    border-radius: 10px;
    padding: 1rem 1.1rem;
    font-size: 0.92rem;
    line-height: 1.5;
  }
  .lookup__back {
    margin-top: 1.5rem;
    font-size: 0.85rem;
    color: #6a635a;
  }
  .lookup__back a { color: #14110f; }
`
