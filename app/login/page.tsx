'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #c0bab3;
          --white: #fff; --off: #f7f6f4; --border: #ece8e2;
          --accent: #C80650;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { min-height: 100vh; background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
        .wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
        .card { width: 100%; max-width: 400px; }
        .wordmark { font-family: var(--serif); font-size: 0.72rem; font-weight: 400; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 48px; text-align: center; }
        .wordmark em { font-style: normal; color: var(--accent); font-weight: 600; }
        .heading { font-family: var(--serif); font-size: clamp(2rem, 8vw, 3rem); font-weight: 700; text-transform: uppercase; line-height: 0.95; letter-spacing: -0.01em; margin-bottom: 10px; }
        .sub { font-size: 0.88rem; font-weight: 300; color: rgba(255,255,255,0.5); line-height: 1.6; margin-bottom: 40px; }
        label { display: block; font-size: 0.65rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 8px; }
        input[type=email] {
          width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.06);
          border: 1.5px solid rgba(255,255,255,0.12); border-radius: 8px;
          font-family: var(--sans); font-size: 1rem; color: #fff; outline: none;
          transition: border-color 0.15s;
        }
        input[type=email]::placeholder { color: rgba(255,255,255,0.25); }
        input[type=email]:focus { border-color: rgba(255,255,255,0.4); }
        .btn {
          margin-top: 16px; width: 100%; padding: 14px; background: var(--accent);
          border: none; border-radius: 8px; font-family: var(--sans); font-size: 0.82rem;
          font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
          color: #fff; cursor: pointer; transition: opacity 0.15s;
        }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn:hover:not(:disabled) { opacity: 0.88; }
        .error { margin-top: 14px; font-size: 0.82rem; color: #ff6b6b; }
        .sent-icon { font-size: 2.5rem; margin-bottom: 16px; }
        .sent-heading { font-family: var(--serif); font-size: 1.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 12px; }
        .sent-body { font-size: 0.9rem; font-weight: 300; color: rgba(255,255,255,0.55); line-height: 1.7; }
        .sent-body strong { color: rgba(255,255,255,0.85); font-weight: 500; }
        .back-link { display: inline-block; margin-top: 32px; font-size: 0.78rem; color: rgba(255,255,255,0.35); text-decoration: none; transition: color 0.15s; }
        .back-link:hover { color: rgba(255,255,255,0.7); }
      `}</style>

      <div className="wrap">
        <div className="card">
          <div className="wordmark">The <em>785</em></div>

          {sent ? (
            <>
              <div className="sent-icon">✉</div>
              <div className="sent-heading">Check Your Email</div>
              <p className="sent-body">
                We sent a login link to <strong>{email}</strong>.<br />
                Click the link to access your artist dashboard.
              </p>
              <a href="/" className="back-link">← Back to The 785</a>
            </>
          ) : (
            <>
              <h1 className="heading">Artist<br />Login</h1>
              <p className="sub">Enter the email address on your artist profile.<br />We'll send you a login link — no password needed.</p>
              <form onSubmit={handleSubmit}>
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                {error && <div className="error">{error}</div>}
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Magic Link'}
                </button>
              </form>
              <a href="/" className="back-link">← Back to The 785</a>
            </>
          )}
        </div>
      </div>
    </>
  )
}
