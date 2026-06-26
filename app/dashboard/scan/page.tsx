'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, Keyboard, CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react'
import jsQR from 'jsqr'

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

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cooldownRef = useRef(false)
  const lastTokenRef = useRef<string | null>(null)

  const [tab, setTab] = useState<'camera' | 'manual'>('camera')
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'error'>('idle')
  const [cameraError, setCameraError] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [validating, setValidating] = useState(false)
  const [result, setResult] = useState<ScanResult>({ state: 'idle' })

  const validate = useCallback(async (token: string) => {
    const trimmed = token.trim()
    if (!trimmed || cooldownRef.current) return

    setValidating(true)
    setResult({ state: 'scanning' })
    cooldownRef.current = true

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
      setTimeout(() => { cooldownRef.current = false }, 4000)
    }
  }, [])

  const startScanLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })
        if (code && code.data && code.data !== lastTokenRef.current && !cooldownRef.current) {
          lastTokenRef.current = code.data
          validate(code.data)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [validate])

  const startCamera = useCallback(async () => {
    setCameraState('starting')
    setCameraError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } },
      })
      streamRef.current = stream

      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }

      setCameraState('active')
      startScanLoop()
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings, or use Manual Entry.'
          : err?.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : 'Could not start camera. Use Manual Entry instead.'
      setCameraState('error')
      setCameraError(msg)
    }
  }, [startScanLoop])

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraState('idle')
  }, [])

  const reset = useCallback(() => {
    setResult({ state: 'idle' })
    setManualToken('')
    lastTokenRef.current = null
    cooldownRef.current = false
  }, [])

  // Start/stop camera when switching tabs
  useEffect(() => {
    if (tab === 'camera') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  const isIdle = result.state === 'idle'
  const isSuccess = result.state === 'success'
  const isError = result.state === 'error'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
          Operations
        </p>
        <h1 className="mb-2 font-display text-3xl font-bold leading-none text-gray-900 dark:text-white">
          Scan Tickets
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Validate attendee tickets at the door using QR codes.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-white/[0.02]">
        <button
          type="button"
          onClick={() => { setTab('camera'); setResult({ state: 'idle' }) }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase transition ${
            tab === 'camera'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-white/[0.1] dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          Camera
        </button>
        <button
          type="button"
          onClick={() => { setTab('manual'); setResult({ state: 'idle' }) }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase transition ${
            tab === 'manual'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-white/[0.1] dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Keyboard className="h-3.5 w-3.5" />
          Manual
        </button>
      </div>

      {/* Camera view */}
      {tab === 'camera' && (
        <>
          {cameraState === 'starting' && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white px-6 py-16 dark:border-gray-700 dark:bg-white/[0.02]">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Starting camera…</p>
            </div>
          )}

          {cameraState === 'error' && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-gray-300 bg-white px-6 py-12 dark:border-gray-700 dark:bg-white/[0.02]">
              <XCircle className="h-8 w-8 text-brand-500" />
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">{cameraError}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  <Camera className="h-4 w-4" /> Try Again
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('manual'); setResult({ state: 'idle' }) }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300"
                >
                  <Keyboard className="h-4 w-4" /> Manual Entry
                </button>
              </div>
            </div>
          )}

          {(cameraState === 'active' || cameraState === 'idle') && (
            <div className="relative overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="block aspect-square w-full object-cover"
              />
              {/* Hidden canvas used for jsQR frame decoding */}
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`h-3/5 w-3/5 rounded-xl border-2 border-white/60 shadow-lg ${
                  result.state === 'scanning' ? 'animate-pulse' : ''
                }`} />
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/50">
                {result.state === 'scanning' ? 'Validating…' : 'Point at ticket QR code'}
              </div>
            </div>
          )}
        </>
      )}

      {/* Manual entry */}
      {tab === 'manual' && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600 dark:text-gray-300">
            Paste or type ticket ID
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') validate(manualToken) }}
              autoFocus
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => validate(manualToken)}
              disabled={validating || !manualToken.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check In'}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {(isSuccess || isError) && (
        <>
          {isSuccess && result.state === 'success' && (
            <div className={`rounded-2xl border p-4 ${
              result.fresh
                ? 'border-success-200 bg-success-50 dark:border-success-500/30 dark:bg-success-500/10'
                : 'border-warning-200 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/10'
            }`}>
              <div className="mb-3 flex items-start gap-3">
                {result.fresh
                  ? <CheckCircle className="h-5 w-5 shrink-0 text-success-600 dark:text-success-400" />
                  : <AlertCircle className="h-5 w-5 shrink-0 text-warning-600 dark:text-warning-400" />
                }
                <div>
                  <p className={`font-semibold ${result.fresh ? 'text-success-900 dark:text-success-300' : 'text-warning-900 dark:text-warning-300'}`}>
                    {result.fresh ? 'Checked In!' : 'Already Used'}
                  </p>
                  <p className={`mt-0.5 text-xs ${result.fresh ? 'text-success-700 dark:text-success-400' : 'text-warning-700 dark:text-warning-400'}`}>
                    {result.fresh ? 'Ticket is valid — welcome!' : 'This ticket was already scanned'}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-gray-400">Name</span>
                  <span className={result.fresh ? 'text-success-900 dark:text-success-200' : 'text-warning-900 dark:text-warning-200'}>
                    {result.ticket.buyer_name}
                  </span>
                </div>
                {result.ticket.tier_name && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-gray-400">Tier</span>
                    <span className={result.fresh ? 'text-success-900 dark:text-success-200' : 'text-warning-900 dark:text-warning-200'}>
                      {result.ticket.tier_name}
                    </span>
                  </div>
                )}
                {result.ticket.event_title && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-gray-400">Event</span>
                    <span className={`max-w-[60%] text-right ${result.fresh ? 'text-success-900 dark:text-success-200' : 'text-warning-900 dark:text-warning-200'}`}>
                      {result.ticket.event_title}
                    </span>
                  </div>
                )}
                {result.ticket.event_date && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-gray-400">Date</span>
                    <span className={result.fresh ? 'text-success-900 dark:text-success-200' : 'text-warning-900 dark:text-warning-200'}>
                      {formatDate(result.ticket.event_date)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {isError && result.state === 'error' && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
                <div>
                  <p className="font-semibold text-brand-900 dark:text-brand-300">Invalid Ticket</p>
                  <p className="mt-0.5 text-xs text-brand-700 dark:text-brand-400">{result.message}</p>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
          >
            Scan Next Ticket
          </button>
        </>
      )}

      {isIdle && tab === 'manual' && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Enter the ticket ID shown below the QR code on the attendee&apos;s ticket.
        </p>
      )}
    </div>
  )
}
