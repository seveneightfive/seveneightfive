'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import jsQR from 'jsqr'

/**
 * /events/[slug]/checkin?token=...
 *
 * Volunteer-facing door check-in. No account needed — access is
 * gated entirely by the ?token= scanner link (see event_scanner_links
 * + /api/checkin/[token]), which the event owner shares from
 * /dashboard/events/[id]/tickets. Without a valid token this page
 * can't search or check in anyone; it shows an explanatory error
 * instead of a broken/empty search box.
 */

type TicketResult = {
  id: string
  qr_token: string
  buyer_name: string | null
  buyer_email: string
  attendee_email: string | null
  tier_name: string
  payment_status: string
  checked_in: boolean
  checked_in_at: string | null
  match_type: 'qr' | 'id' | 'name' | 'email'
}

function CheckInPageInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const token = searchParams.get('token')

  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking')
  const [tokenError, setTokenError] = useState('')
  const [eventTitle, setEventTitle] = useState('')

  const [staffName, setStaffName] = useState('')
  const [staffNameSubmitted, setStaffNameSubmitted] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TicketResult[]>([])
  const [searching, setSearching] = useState(false)

  const [lastScanned, setLastScanned] = useState<TicketResult | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  // Stops the same ticket being processed over and over while it's still
  // in front of the camera, and pauses scanning while a check-in is saving.
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null)
  const busyRef = useRef(false)
  const [cameraStarting, setCameraStarting] = useState(false)

  // Turn off the camera when leaving the page
  useEffect(() => () => stopCamera(), []) // eslint-disable-line react-hooks/exhaustive-deps

  async function callApi(action: string, body: Record<string, any> = {}) {
    if (!token) throw new Error('Missing check-in token')
    const res = await fetch(`/api/checkin/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error || 'Request failed')
    return json
  }

  useEffect(() => {
    if (!token) {
      setTokenStatus('invalid')
      setTokenError('This check-in link is missing its access token. Ask the event organizer for the correct link from their dashboard.')
      return
    }
    callApi('info')
      .then((json) => {
        setEventTitle(json.eventTitle)
        setTokenStatus('valid')
      })
      .catch((err) => {
        setTokenStatus('invalid')
        setTokenError(err.message || 'This check-in link is invalid.')
      })

    const savedStaffName = localStorage.getItem('checkinStaffName')
    if (savedStaffName) {
      setStaffName(savedStaffName)
      setStaffNameSubmitted(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleStaffNameSubmit = (name: string) => {
    if (!name.trim()) return
    localStorage.setItem('checkinStaffName', name)
    setStaffName(name)
    setStaffNameSubmitted(true)
  }

  // Ticket QR codes come in two forms: the bare token (ticket page, My
  // Tickets) and a full link like https://seveneightfive.com/tickets/<token>
  // (confirmation + reminder emails). Pull the token out of either.
  const extractToken = (raw: string) => {
    const text = raw.trim()
    const m = text.match(/\/tickets\/([^/?#\s]+)/)
    if (m) {
      try { return decodeURIComponent(m[1]) } catch { return m[1] }
    }
    return text
  }

  const scanLoop = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !streamRef.current) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx && video.readyState === video.HAVE_ENOUGH_DATA && !busyRef.current) {
      // Scale down big camera frames — faster to decode, same accuracy
      const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
      if (code?.data) {
        const now = Date.now()
        const last = lastCodeRef.current
        if (!last || last.code !== code.data || now - last.at > 4000) {
          lastCodeRef.current = { code: code.data, at: now }
          handleScannedQR(code.data)
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop)
  }

  const startCamera = async () => {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "This browser can't open the camera. If you opened this link inside another app (Facebook, Instagram, Messages preview), tap the ⋯ or share icon and choose \"Open in Safari\" or \"Open in Chrome\". You can also use Manual Lookup below."
      )
      return
    }
    setCameraStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Camera view not ready — please try again.')
      video.srcObject = stream
      video.setAttribute('playsinline', 'true') // iOS: play inline, not fullscreen
      video.muted = true
      await video.play()
      setScanning(true)
      rafRef.current = requestAnimationFrame(scanLoop)
    } catch (err: any) {
      stopCamera()
      const name = err?.name
      setCameraError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Camera access was blocked. On iPhone: Settings → Safari → Camera → Allow (or tap "aA" in the address bar → Website Settings → Camera). On Android: tap the lock icon by the address bar → Permissions → Camera. Then tap Try Again.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? "We couldn't find a camera on this device. Use Manual Lookup below."
          : name === 'NotReadableError'
          ? 'Another app is using the camera. Close it and tap Try Again.'
          : err?.message || 'Could not start the camera.'
      )
    } finally {
      setCameraStarting(false)
    }
  }

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setScanning(false)
  }

  // Camera stays on between guests — scan, check in, next guest.
  const handleScannedQR = async (raw: string) => {
    busyRef.current = true
    setSearching(true)
    try {
      const json = await callApi('search', { query: extractToken(raw) })
      const hit = json.results?.length === 1 ? json.results[0] : null
      if (!hit || hit.match_type !== 'qr') {
        setFeedback({ type: 'error', message: "Ticket not found — this code isn't a ticket for this event." })
      } else if (hit.checked_in) {
        setFeedback({ type: 'warning', message: `Already checked in: ${hit.buyer_name || hit.buyer_email}` })
      } else {
        await performCheckIn(hit)
      }
      if (navigator.vibrate) navigator.vibrate(120)
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Scan failed' })
    } finally {
      setSearching(false)
      // short pause so the result can be read before the next scan
      setTimeout(() => { busyRef.current = false }, 1200)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setFeedback(null)
    try {
      const json = await callApi('search', { query: searchQuery.trim() })
      setSearchResults(json.results || [])
      if (!json.results?.length) {
        setFeedback({ type: 'warning', message: 'No tickets found matching that search' })
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Search failed' })
    } finally {
      setSearching(false)
    }
  }

  const performCheckIn = async (result: TicketResult) => {
    if (!staffName) return
    try {
      const json = await callApi('checkin', { ticketId: result.id, staffName })
      const checkedInTicket: TicketResult = { ...result, checked_in: true, checked_in_at: new Date().toISOString() }
      setLastScanned(checkedInTicket)
      setSearchResults((rs) => rs.map((r) => (r.id === result.id ? checkedInTicket : r)))
      setFeedback({ type: 'success', message: `Checked in: ${result.buyer_name || result.buyer_email}` })
      setTimeout(() => setFeedback(null), 3000)
    } catch (err: any) {
      if (err.message === 'Already checked in') {
        setFeedback({ type: 'warning', message: `Already checked in: ${result.buyer_name || result.buyer_email}` })
      } else {
        setFeedback({ type: 'error', message: err.message || 'Check-in failed' })
      }
    }
  }

  // ── Token invalid — explain why, don't show a broken search UI ──
  if (tokenStatus === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-8 text-center dark:border-red-500/30 dark:bg-gray-800">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <h1 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Check-in link unavailable</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{tokenError}</p>
        </div>
      </div>
    )
  }

  if (tokenStatus === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!staffNameSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-800">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">{eventTitle}</h1>
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">Door Check-In</p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleStaffNameSubmit(staffName)
            }}
          >
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Your Name</label>
            <input
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="e.g. Sarah"
              autoFocus
              className="mb-4 w-full rounded-lg border border-gray-200 px-4 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
            />
            <button
              type="submit"
              disabled={!staffName.trim()}
              className="w-full rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              Start Check-In
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{eventTitle}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Checked in as: <span className="font-semibold">{staffName}</span>
            <button
              onClick={() => {
                setStaffNameSubmitted(false)
                localStorage.removeItem('checkinStaffName')
              }}
              className="ml-2 text-xs text-brand-600 hover:underline dark:text-brand-400"
            >
              (change)
            </button>
          </p>
        </div>

        {feedback && (
          <div
            className={`mb-6 rounded-lg p-4 ${
              feedback.type === 'success'
                ? 'border border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400'
                : feedback.type === 'error'
                  ? 'border border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
                  : 'border border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400'
            }`}
          >
            <span>{feedback.message}</span>
          </div>
        )}

        {lastScanned && (
          <div className="mb-6 rounded-lg border-2 border-green-500 bg-green-50 p-4 dark:bg-green-500/10">
            <div className="text-sm text-green-700 dark:text-green-400">
              <div className="font-semibold">{lastScanned.buyer_name || lastScanned.buyer_email}</div>
              <div className="mt-1 text-xs">{lastScanned.tier_name} | Just checked in</div>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-800">
          <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Scan QR Code</h2>

          {/* The video element is always mounted (just hidden) so it exists
              when the camera starts — previously it only rendered after
              scanning began, so the stream had nowhere to go and the
              button appeared to do nothing. */}
          <div className={scanning ? 'space-y-4' : 'hidden'}>
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full"
                style={{ maxHeight: '420px', objectFit: 'cover' }}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-3/5 aspect-square rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              {searching && (
                <div className="absolute inset-x-0 bottom-0 bg-black/70 py-2 text-center text-sm font-semibold text-white">
                  Checking ticket…
                </div>
              )}
            </div>
            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
              Point the camera at the guest&rsquo;s ticket QR code. The camera stays on for the next guest.
            </p>
            <button
              onClick={stopCamera}
              className="w-full rounded-lg border border-red-500 bg-red-50 px-4 py-2 font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            >
              Stop Camera
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {!scanning && (
            <div className="space-y-3">
              {cameraError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                  <strong>Camera problem:</strong> {cameraError}
                </div>
              )}
              <button
                onClick={startCamera}
                disabled={cameraStarting}
                className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {cameraStarting ? 'Starting camera…' : cameraError ? 'Try Again' : 'Start Camera'}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-800">
          <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Manual Lookup</h2>

          <form onSubmit={handleSearch} className="space-y-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket ID, QR token, name, or email..."
              className="w-full rounded-lg border border-gray-200 px-4 py-2 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
            />
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="w-full rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {searching ? (
                <>
                  <Loader2 className="mb-1 inline-block h-4 w-4 animate-spin" /> Searching...
                </>
              ) : (
                'Search'
              )}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-3">
              {searchResults.map((result) => (
                <div key={result.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {result.buyer_name || result.buyer_email}
                      </div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {result.tier_name} | {result.match_type.toUpperCase()} match
                      </div>
                      {result.checked_in && (
                        <div className="mt-2 text-xs text-green-600 dark:text-green-400">Already checked in</div>
                      )}
                    </div>
                    {!result.checked_in && (
                      <button
                        onClick={() => performCheckIn(result)}
                        className="rounded-lg bg-green-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-green-700"
                      >
                        Check In
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      }
    >
      <CheckInPageInner />
    </Suspense>
  )
}
