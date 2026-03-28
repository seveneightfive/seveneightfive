'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

type ScanResult =
  | { state: 'idle' }
  | { state: 'scanning' }
  | { state: 'success'; ticket: TicketInfo; fresh: boolean }
  | { state: 'error'; message: string }

type TicketInfo = {
  buyer_name: string
  buyer_email: string
  tier_name: string | null
  event_title: string | null
  event_date: string | null
  amount_paid: number | null
  status: string
}

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #1a1814; --white: #fff; --accent: #C80650;
    --surface: rgba(255,255,255,0.04); --border: rgba(255,255,255,0.08);
    --border2: rgba(255,255,255,0.14); --dim: rgba(255,255,255,0.55);
    --faint: rgba(255,255,255,0.25); --green: #7ecf7e; --gold: #ffce03;
    --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
  }
  html, body { background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  .topbar { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 52px; background: rgba(26,24,20,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
  .back-link { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); text-decoration: none; }
  .back-link:hover { color: var(--white); }
  .page-title { font-family: var(--serif); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
  .content { max-width: 520px; margin: 0 auto; padding: 24px 20px 80px; }

  /* Camera */
  .camera-wrap { position: relative; width: 100%; border-radius: 14px; overflow: hidden; background: #000; aspect-ratio: 1; margin-bottom: 20px; }
  .camera-wrap video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .camera-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
  .scan-frame { width: 60%; aspect-ratio: 1; border: 2px solid rgba(255,255,255,0.6); border-radius: 12px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.45); }
  .camera-hint { position: absolute; bottom: 14px; left: 0; right: 0; text-align: center; font-size: 0.72rem; color: rgba(255,255,255,0.5); letter-spacing: 0.05em; }
  .camera-off { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 200px; background: rgba(255,255,255,0.03); border: 1px dashed var(--border2); border-radius: 14px; flex-direction: column; gap: 10px; margin-bottom: 20px; padding: 24px; text-align: center; }
  .camera-off-icon { font-size: 2rem; opacity: 0.3; }
  .camera-off-text { font-size: 0.82rem; color: var(--dim); line-height: 1.5; }

  /* Result card */
  .result-card { border-radius: 14px; overflow: hidden; margin-bottom: 16px; }
  .result-card.success { background: rgba(45,122,45,0.12); border: 1px solid rgba(45,122,45,0.35); }
  .result-card.already-used { background: rgba(255,255,255,0.04); border: 1px solid var(--border2); }
  .result-card.error { background: rgba(200,6,80,0.08); border: 1px solid rgba(200,6,80,0.3); }
  .result-header { padding: 16px 18px 12px; display: flex; align-items: center; gap: 12px; }
  .result-icon { font-size: 1.5rem; flex-shrink: 0; }
  .result-title { font-family: var(--serif); font-size: 1.1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .result-sub { font-size: 0.75rem; color: var(--dim); margin-top: 2px; }
  .result-body { padding: 0 18px 16px; display: flex; flex-direction: column; gap: 8px; }
  .result-row { display: flex; justify-content: space-between; align-items: baseline; }
  .result-label { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); }
  .result-value { font-size: 0.85rem; color: var(--white); text-align: right; }

  /* Manual entry */
  .manual-section { margin-top: 8px; }
  .manual-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--faint); margin-bottom: 8px; }
  .manual-row { display: flex; gap: 8px; }
  .manual-input { flex: 1; background: var(--surface); border: 1px solid var(--border2); border-radius: 8px; padding: 11px 14px; color: var(--white); font-family: monospace; font-size: 0.8rem; outline: none; transition: border-color 0.15s; }
  .manual-input:focus { border-color: rgba(255,255,255,0.35); }
  .manual-input::placeholder { color: var(--faint); }
  .btn { padding: 11px 18px; border-radius: 8px; font-family: var(--sans); font-size: 0.78rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; border: none; cursor: pointer; transition: opacity 0.15s; white-space: nowrap; }
  .btn:hover { opacity: 0.82; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-ghost { background: rgba(255,255,255,0.07); color: var(--dim); border: 1px solid var(--border2); }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Next scan */
  .next-btn { display: block; width: 100%; margin-top: 14px; padding: 13px; border-radius: 10px; background: rgba(255,255,255,0.07); border: 1px solid var(--border2); color: var(--dim); font-family: var(--sans); font-size: 0.82rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; text-align: center; cursor: pointer; transition: background 0.15s; }
  .next-btn:hover { background: rgba(255,255,255,0.11); color: var(--white); }

  /* Tab toggle */
  .tabs { display: flex; gap: 4px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 10px; padding: 4px; margin-bottom: 20px; }
  .tab { flex: 1; padding: 8px; border-radius: 7px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; text-align: center; cursor: pointer; transition: background 0.15s, color 0.15s; color: var(--faint); background: transparent; border: none; font-family: var(--sans); }
  .tab.active { background: rgba(255,255,255,0.1); color: var(--white); }

  /* Spinner */
  .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Scanning pulse */
  .scan-pulse { animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
`

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const lastTokenRef = useRef<string | null>(null)
  const cooldownRef = useRef(false)

  const [tab, setTab] = useState<'camera' | 'manual'>('camera')
  const [cameraSupported, setCameraSupported] = useState(true)
  const [cameraActive, setCameraActive] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [validating, setValidating] = useState(false)
  const [result, setResult] = useState<ScanResult>({ state: 'idle' })

  // Validate a QR token against the API
  const validate = useCallback(async (token: string) => {
    if (validating || cooldownRef.current) return
    const trimmed = token.trim()
    if (!trimmed) return

    setValidating(true)
    setResult({ state: 'scanning' })

    try {
      const res = await fetch('/api/tickets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_token: trimmed }),
      })
      const data = await res.json()

      if (!res.ok) {
        setResult({ state: 'error', message: data.error || 'Invalid ticket' })
      } else if (data.already_used) {
        setResult({ state: 'success', ticket: data.ticket, fresh: false })
      } else {
        setResult({ state: 'success', ticket: data.ticket, fresh: true })
      }
    } catch {
      setResult({ state: 'error', message: 'Network error — check connection' })
    } finally {
      setValidating(false)
      // Prevent re-scanning the same code for 4 seconds
      cooldownRef.current = true
      setTimeout(() => { cooldownRef.current = false }, 4000)
    }
  }, [validating])

  // Camera scanning loop using BarcodeDetector
  const startScanLoop = useCallback(() => {
    if (!detectorRef.current || !videoRef.current) return

    const scan = async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(scan)
        return
      }

      try {
        const codes = await detectorRef.current.detect(video)
        if (codes.length > 0) {
          const token = codes[0].rawValue
          if (token && token !== lastTokenRef.current && !cooldownRef.current) {
            lastTokenRef.current = token
            await validate(token)
          }
        }
      } catch {
        // Detection error on a frame — ignore and continue
      }

      rafRef.current = requestAnimationFrame(scan)
    }

    rafRef.current = requestAnimationFrame(scan)
  }, [validate])

  const startCamera = useCallback(async () => {
    // Check BarcodeDetector support
    if (!('BarcodeDetector' in window)) {
      setCameraSupported(false)
      setTab('manual')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      setCameraActive(true)
      startScanLoop()
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setCameraSupported(false)
        setTab('manual')
      }
    }
  }, [startScanLoop])

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  const reset = useCallback(() => {
    setResult({ state: 'idle' })
    setManualToken('')
    lastTokenRef.current = null
    cooldownRef.current = false
    if (tab === 'camera' && !cameraActive) startCamera()
  }, [tab, cameraActive, startCamera])

  // Start/stop camera based on tab
  useEffect(() => {
    if (tab === 'camera') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => { stopCamera() }
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  const isIdle = result.state === 'idle'
  const isSuccess = result.state === 'success'
  const isError = result.state === 'error'

  return (
    <>
      <style>{STYLES}</style>

      <div className="topbar">
        <a href="/dashboard" className="back-link">← Dashboard</a>
        <span className="page-title">Scan Tickets</span>
        <div style={{ width: 80 }} />
      </div>

      <div className="content">

        <div className="tabs">
          <button className={`tab ${tab === 'camera' ? 'active' : ''}`} onClick={() => { setTab('camera'); setResult({ state: 'idle' }) }}>
            Camera
          </button>
          <button className={`tab ${tab === 'manual' ? 'active' : ''}`} onClick={() => { setTab('manual'); setResult({ state: 'idle' }) }}>
            Manual Entry
          </button>
        </div>

        {/* Camera view */}
        {tab === 'camera' && (
          cameraActive ? (
            <div className="camera-wrap">
              <video ref={videoRef} playsInline muted />
              <div className="camera-overlay">
                <div className={`scan-frame ${result.state === 'scanning' ? 'scan-pulse' : ''}`} />
              </div>
              <div className="camera-hint">
                {result.state === 'scanning' ? 'Validating…' : 'Point at ticket QR code'}
              </div>
            </div>
          ) : (
            <div className="camera-off">
              <div className="camera-off-icon">📷</div>
              <div className="camera-off-text">
                {cameraSupported
                  ? 'Starting camera…'
                  : 'Camera not available on this browser.\nUse Manual Entry instead.'}
              </div>
            </div>
          )
        )}

        {/* Manual entry */}
        {tab === 'manual' && (
          <div className="manual-section">
            <div className="manual-label">Paste or type ticket ID</div>
            <div className="manual-row">
              <input
                className="manual-input"
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') validate(manualToken) }}
                autoFocus
              />
              <button
                className="btn btn-primary"
                onClick={() => validate(manualToken)}
                disabled={validating || !manualToken.trim()}
              >
                {validating ? <span className="spinner" /> : 'Check In'}
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {(isSuccess || isError) && (
          <>
            {isSuccess && result.state === 'success' && (
              <div className={`result-card ${result.fresh ? 'success' : 'already-used'}`}>
                <div className="result-header">
                  <span className="result-icon">{result.fresh ? '✅' : '⚠️'}</span>
                  <div>
                    <div className="result-title">
                      {result.fresh ? 'Checked In!' : 'Already Used'}
                    </div>
                    <div className="result-sub">
                      {result.fresh
                        ? 'Ticket is valid — welcome!'
                        : 'This ticket was already scanned'}
                    </div>
                  </div>
                </div>
                <div className="result-body">
                  <div className="result-row">
                    <span className="result-label">Name</span>
                    <span className="result-value">{result.ticket.buyer_name}</span>
                  </div>
                  {result.ticket.tier_name && (
                    <div className="result-row">
                      <span className="result-label">Tier</span>
                      <span className="result-value">{result.ticket.tier_name}</span>
                    </div>
                  )}
                  {result.ticket.event_title && (
                    <div className="result-row">
                      <span className="result-label">Event</span>
                      <span className="result-value" style={{ maxWidth: '60%' }}>{result.ticket.event_title}</span>
                    </div>
                  )}
                  {result.ticket.event_date && (
                    <div className="result-row">
                      <span className="result-label">Date</span>
                      <span className="result-value">{formatDate(result.ticket.event_date)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isError && result.state === 'error' && (
              <div className="result-card error">
                <div className="result-header">
                  <span className="result-icon">❌</span>
                  <div>
                    <div className="result-title">Invalid Ticket</div>
                    <div className="result-sub">{result.message}</div>
                  </div>
                </div>
              </div>
            )}

            <button className="next-btn" onClick={reset}>
              Scan Next Ticket
            </button>
          </>
        )}

        {isIdle && tab === 'manual' && (
          <p style={{ marginTop: 20, fontSize: '0.78rem', color: 'var(--faint)', lineHeight: 1.6 }}>
            Enter the ticket ID shown below the QR code on the attendee's ticket.
          </p>
        )}

      </div>
    </>
  )
}
