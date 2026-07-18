'use client'

// app/sellers/[slug]/ManageTicketsButton.tsx
//
// Same magic-link approach as /tickets/lookup, but as an in-page modal
// instead of a navigation — so clicking "Manage Tickets" on a seller page
// doesn't take you away from it. The standalone /tickets/lookup page still
// exists separately (useful for direct links, e.g. in an email), this
// component just doesn't route there anymore.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

export default function ManageTicketsButton() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  // Esc to close, lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function reset() {
    setEmail('')
    setStatus('idle')
    setError('')
  }

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
    <>
      <button type="button" onClick={() => setOpen(true)} className="utilityBar__manage">
        Manage Tickets
      </button>

      {open && (
        <div
          className="mtModal__backdrop"
          onClick={() => { setOpen(false); reset() }}
        >
          <div className="mtModal__card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { setOpen(false); reset() }}
              className="mtModal__close"
              aria-label="Close"
            >
              ✕
            </button>

            <h2 className="mtModal__title">Manage Your Tickets</h2>
            <p className="mtModal__body">
              Enter the email you used to buy your tickets and we&apos;ll send you a secure
              link to view them — no password needed.
            </p>

            {status === 'sent' ? (
              <div className="mtModal__sent">
                <strong>Check your inbox.</strong> We sent a sign-in link to <strong>{email}</strong>.
                Click it to see your tickets — the link works on any device.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mtModal__form">
                <label htmlFor="mt-email" className="mtModal__label">Email address</label>
                <input
                  id="mt-email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mtModal__input"
                />
                {status === 'error' && <p className="mtModal__error">{error}</p>}
                <button type="submit" disabled={status === 'sending'} className="mtModal__submit">
                  {status === 'sending' ? 'Sending…' : 'Send me a secure link'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        .mtModal__backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center;
          padding: 1.25rem;
        }
        .mtModal__card {
          position: relative;
          width: 100%; max-width: 440px;
          background: #1c1815;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 2rem;
          color: #f5f3f0;
        }
        .mtModal__close {
          position: absolute; top: 1rem; right: 1rem;
          background: none; border: none; color: rgba(245,243,240,0.6);
          font-size: 1.1rem; cursor: pointer; line-height: 1;
        }
        .mtModal__close:hover { color: #f5f3f0; }
        .mtModal__title {
          font-family: var(--font-oswald), system-ui, sans-serif;
          font-size: 1.4rem; font-weight: 700; text-transform: uppercase;
          margin: 0 0 0.6rem;
        }
        .mtModal__body {
          font-size: 0.92rem; color: rgba(245,243,240,0.65);
          margin: 0 0 1.4rem; line-height: 1.5;
        }
        .mtModal__form { display: flex; flex-direction: column; gap: 0.6rem; }
        .mtModal__label {
          font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(245,243,240,0.6);
        }
        .mtModal__input {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 8px; padding: 0.75rem 0.9rem;
          font-size: 1rem; color: #f5f3f0; outline: none;
        }
        .mtModal__input:focus { border-color: #f30963; }
        .mtModal__input::placeholder { color: rgba(245,243,240,0.35); }
        .mtModal__error { color: #ff6b9d; font-size: 0.85rem; margin: 0; }
        .mtModal__submit {
          margin-top: 0.4rem;
          background: #f30963; color: #fff; border: none;
          border-radius: 999px; padding: 0.85rem 1.2rem;
          font-family: var(--font-oswald), system-ui, sans-serif;
          font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
          font-size: 0.85rem; cursor: pointer;
        }
        .mtModal__submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .mtModal__sent {
          background: rgba(0,200,120,0.1);
          border: 1px solid rgba(0,200,120,0.3);
          border-radius: 10px; padding: 1rem 1.1rem;
          font-size: 0.9rem; line-height: 1.5;
        }
      `}</style>
    </>
  )
}
