'use client'

import { useState } from 'react'

type Props = {
  accountStatus: string | null // 'pending' | 'restricted' | 'enabled' | null
  returnPath?: string
}

export default function StripeConnectButton({ accountStatus, returnPath = '/dashboard' }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Something went wrong'); setLoading(false); return }
      window.location.href = json.url
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const isEnabled = accountStatus === 'enabled'
  const isPending = accountStatus === 'pending' || accountStatus === 'restricted'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <style>{`
        .scb-wrap { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 10px; border: 1.5px solid; }
        .scb-enabled { background: rgba(45,122,45,0.08); border-color: rgba(45,122,45,0.25); }
        .scb-pending { background: rgba(255,206,3,0.06); border-color: rgba(255,206,3,0.2); }
        .scb-none { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.1); }
        .scb-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .scb-dot-green { background: #7ecf7e; }
        .scb-dot-yellow { background: #ffce03; }
        .scb-dot-gray { background: rgba(255,255,255,0.2); }
        .scb-info { flex: 1; }
        .scb-label { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 2px; }
        .scb-label-green { color: #7ecf7e; }
        .scb-label-yellow { color: #ffce03; }
        .scb-label-gray { color: rgba(255,255,255,0.4); }
        .scb-sub { font-size: 0.75rem; color: rgba(255,255,255,0.4); line-height: 1.4; }
        .scb-btn { padding: 8px 16px; border-radius: 8px; border: none; font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: opacity 0.15s; white-space: nowrap; flex-shrink: 0; }
        .scb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .scb-btn-primary { background: #635BFF; color: #fff; }
        .scb-btn-primary:hover:not(:disabled) { opacity: 0.85; }
        .scb-btn-secondary { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.12); }
        .scb-btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
        .scb-error { font-size: 0.78rem; color: #ff9ab0; padding: 0 2px; }
      `}</style>

      <div className={`scb-wrap ${isEnabled ? 'scb-enabled' : isPending ? 'scb-pending' : 'scb-none'}`}>
        <div className={`scb-dot ${isEnabled ? 'scb-dot-green' : isPending ? 'scb-dot-yellow' : 'scb-dot-gray'}`} />
        <div className="scb-info">
          <div className={`scb-label ${isEnabled ? 'scb-label-green' : isPending ? 'scb-label-yellow' : 'scb-label-gray'}`}>
            {isEnabled ? 'Stripe Connected' : isPending ? 'Setup Incomplete' : 'Not Connected'}
          </div>
          <div className="scb-sub">
            {isEnabled
              ? 'You can sell tickets. Payouts go to your connected bank account.'
              : isPending
                ? 'Finish setting up your Stripe account to start selling.'
                : 'Connect Stripe to sell tickets and receive payouts directly.'}
          </div>
        </div>
        {!isEnabled && (
          <button
            className="scb-btn scb-btn-primary"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? '…' : isPending ? 'Finish Setup' : 'Connect Stripe'}
          </button>
        )}
        {isEnabled && (
          <button
            className="scb-btn scb-btn-secondary"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? '…' : 'Manage'}
          </button>
        )}
      </div>

      {error && <div className="scb-error">{error}</div>}
    </div>
  )
}
