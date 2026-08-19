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
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

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

  const startCamera = async () => {
    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setScanning(true)

        const intervalId = setInterval(() => {
          if (canvasRef.current && videoRef.current) {
            const context = canvasRef.current.getContext('2d')
            if (context) {
              canvasRef.current.width = videoRef.current.videoWidth
              canvasRef.current.height = videoRef.current.videoHeight
              context.drawImage(videoRef.current, 0, 0)
              const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
              const code = jsQR(imageData.data, imageData.width, imageData.height)
              if (code) handleScannedQR(code.data)
            }
          }
        }, 200)
        scanIntervalRef.current = intervalId
      }
    } catch (err: any) {
      setCameraError(err.message || 'Could not access camera')
      setScanning(false)
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
    }
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
    setScanning(false)
  }

  const handleScannedQR = async (qrToken: string) => {
    stopCamera()
    setSearching(true)
    try {
      const json = await callApi('search', { query: qrToken })
      if (json.results?.length === 1) {
        await performCheckIn(json.results[0])
      } else {
        setFeedback({ type: 'error', message: 'Ticket not found' })
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Scan failed' })
    } finally {
      setSearching(false)
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

          {scanning ? (
            <div className="space-y-4">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black" style={{ maxHeight: '400px', objectFit: 'cover' }} />
              <canvas ref={canvasRef} className="hidden" />
              <button
                onClick={stopCamera}
                className="w-full rounded-lg border border-red-500 bg-red-50 px-4 py-2 font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
              >
                Stop Camera
              </button>
            </div>
          ) : cameraError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <strong>Camera Error:</strong> {cameraError}
            </div>
          ) : (
            <button onClick={startCamera} className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700">
              Start Camera
            </button>
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
