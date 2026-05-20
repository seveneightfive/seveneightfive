'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import { Loader2 } from 'lucide-react'
import jsQR from 'jsqr'

type TicketInfo = {
  id: string
  qr_token: string
  buyer_name: string | null
  buyer_email: string
  tier_name: string
  payment_status: string
  checked_in: boolean
  checked_in_at: string | null
}

type SearchResult = TicketInfo & {
  matchType: 'qr' | 'id' | 'name'
}

export default function CheckInPage() {
  const params = useParams()
  const slug = params.slug as string

  const [eventId, setEventId] = useState<string | null>(null)
  const [eventTitle, setEventTitle] = useState<string>('')
  const [staffName, setStaffName] = useState('')
  const [staffNameSubmitted, setStaffNameSubmitted] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const [lastScanned, setLastScanned] = useState<SearchResult | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const supabase = createClient()

  // Load event and restore staff name from localStorage
  useEffect(() => {
    async function loadEvent() {
      const { data: event } = await supabase
        .from('events')
        .select('id, title')
        .eq('slug', slug)
        .single()

      if (event) {
        setEventId(event.id)
        setEventTitle(event.title)
      }

      const savedStaffName = localStorage.getItem('checkinStaffName')
      if (savedStaffName) {
        setStaffName(savedStaffName)
        setStaffNameSubmitted(true)
      }
    }

    loadEvent()
  }, [slug, supabase])

  const handleStaffNameSubmit = (name: string) => {
    if (!name.trim()) return
    localStorage.setItem('checkinStaffName', name)
    setStaffName(name)
    setStaffNameSubmitted(true)
  }

  const startCamera = async () => {
    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setScanning(true)

        // Start QR scanning loop
        const intervalId = setInterval(() => {
          if (canvasRef.current && videoRef.current) {
            const context = canvasRef.current.getContext('2d')
            if (context) {
              canvasRef.current.width = videoRef.current.videoWidth
              canvasRef.current.height = videoRef.current.videoHeight
              context.drawImage(videoRef.current, 0, 0)

              const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
              const code = jsQR(imageData.data, imageData.width, imageData.height)

              if (code) {
                handleScannedQR(code.data)
              }
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
      stream.getTracks().forEach(track => track.stop())
    }
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
    setScanning(false)
  }

  const handleScannedQR = async (qrToken: string) => {
    stopCamera()
    await checkInTicket(qrToken, 'qr')
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId || !searchQuery.trim()) return

    setSearching(true)
    const query = searchQuery.toLowerCase().trim()

    try {
      // Try to find by QR token (exact match)
      let { data: ticket } = await supabase
        .from('tickets')
        .select(`
          id,
          qr_token,
          buyer_name,
          buyer_email,
          ticket_tiers(name),
          payment_status,
          check_ins(id)
        `)
        .eq('event_id', eventId)
        .eq('qr_token', query)
        .maybeSingle()

      if (ticket) {
        const result: SearchResult = {
          id: ticket.id,
          qr_token: ticket.qr_token,
          buyer_name: ticket.buyer_name,
          buyer_email: ticket.buyer_email,
          tier_name: (ticket.ticket_tiers as any)?.name || 'Ticket',
          payment_status: ticket.payment_status,
          checked_in: (ticket.check_ins as any)?.length > 0,
          checked_in_at: null,
          matchType: 'qr',
        }
        setSearchResults([result])
        setSearching(false)
        return
      }

      // Try to find by ticket ID (partial match)
      const { data: ticketsById } = await supabase
        .from('tickets')
        .select(`
          id,
          qr_token,
          buyer_name,
          buyer_email,
          ticket_tiers(name),
          payment_status,
          check_ins(id)
        `)
        .eq('event_id', eventId)
        .ilike('id', `%${query}%`)
        .limit(10)

      if (ticketsById?.length) {
        setSearchResults(
          ticketsById.map(t => ({
            id: t.id,
            qr_token: t.qr_token,
            buyer_name: t.buyer_name,
            buyer_email: t.buyer_email,
            tier_name: (t.ticket_tiers as any)?.name || 'Ticket',
            payment_status: t.payment_status,
            checked_in: (t.check_ins as any)?.length > 0,
            checked_in_at: null,
            matchType: 'id',
          }))
        )
        setSearching(false)
        return
      }

      // Try to find by last name
      const { data: ticketsByName } = await supabase
        .from('tickets')
        .select(`
          id,
          qr_token,
          buyer_name,
          buyer_email,
          ticket_tiers(name),
          payment_status,
          check_ins(id)
        `)
        .eq('event_id', eventId)
        .ilike('buyer_name', `%${query}%`)
        .limit(10)

      if (ticketsByName?.length) {
        setSearchResults(
          ticketsByName.map(t => ({
            id: t.id,
            qr_token: t.qr_token,
            buyer_name: t.buyer_name,
            buyer_email: t.buyer_email,
            tier_name: (t.ticket_tiers as any)?.name || 'Ticket',
            payment_status: t.payment_status,
            checked_in: (t.check_ins as any)?.length > 0,
            checked_in_at: null,
            matchType: 'name',
          }))
        )
        setSearching(false)
        return
      }

      setSearchResults([])
      setFeedback({ type: 'warning', message: 'No tickets found matching that search' })
    } catch (err) {
      console.error('Search error:', err)
      setFeedback({ type: 'error', message: 'Search failed' })
    }

    setSearching(false)
  }

  const checkInTicket = async (qrTokenOrId: string, source: 'qr' | 'id' | 'name') => {
    if (!eventId || !staffName) return

    try {
      // Look up ticket
      let query = supabase
        .from('tickets')
        .select(`
          id,
          qr_token,
          buyer_name,
          buyer_email,
          ticket_tiers(name),
          payment_status,
          check_ins(id)
        `)
        .eq('event_id', eventId)

      if (source === 'qr') {
        query = query.eq('qr_token', qrTokenOrId)
      } else if (source === 'id') {
        query = query.eq('id', qrTokenOrId)
      } else {
        query = query.ilike('buyer_name', `%${qrTokenOrId}%`)
      }

      const { data: tickets } = await query.limit(1)

      if (!tickets?.length) {
        setFeedback({ type: 'error', message: 'Ticket not found' })
        return
      }

      const ticket = tickets[0]
      const isAlreadyCheckedIn = (ticket.check_ins as any)?.length > 0

      if (isAlreadyCheckedIn) {
        setFeedback({
          type: 'warning',
          message: `Already checked in: ${ticket.buyer_name || ticket.buyer_email}`,
        })
        return
      }

      // Create check-in record
      const { error: checkInError } = await supabase.from('check_ins').insert([
        {
          ticket_id: ticket.id,
          checked_in_by_name: staffName,
        },
      ])

      if (checkInError) throw checkInError

      const result: SearchResult = {
        id: ticket.id,
        qr_token: ticket.qr_token,
        buyer_name: ticket.buyer_name,
        buyer_email: ticket.buyer_email,
        tier_name: (ticket.ticket_tiers as any)?.name || 'Ticket',
        payment_status: ticket.payment_status,
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        matchType: source,
      }

      setLastScanned(result)
      setFeedback({
        type: 'success',
        message: `Checked in: ${ticket.buyer_name || ticket.buyer_email}`,
      })

      // Clear feedback after 3 seconds
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      console.error('Check-in error:', err)
      setFeedback({ type: 'error', message: 'Check-in failed' })
    }
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
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Your Name
            </label>
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
        {/* Header */}
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

        {/* Feedback Messages */}
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

        {/* Last Scanned Ticket */}
        {lastScanned && (
          <div className="mb-6 rounded-lg border-2 border-green-500 bg-green-50 p-4 dark:bg-green-500/10">
            <div className="text-sm text-green-700 dark:text-green-400">
              <div className="font-semibold">{lastScanned.buyer_name || lastScanned.buyer_email}</div>
              <div className="mt-1 text-xs">{lastScanned.tier_name} | Just checked in</div>
            </div>
          </div>
        )}

        {/* Camera Scanner */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-800">
          <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">
            Scan QR Code
          </h2>

          {scanning ? (
            <div className="space-y-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg bg-black"
                style={{ maxHeight: '400px', objectFit: 'cover' }}
              />
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
            <button
              onClick={startCamera}
              className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700"
            >
              Start Camera
            </button>
          )}
        </div>

        {/* Manual Search */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-800">
          <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">
            Manual Lookup
          </h2>

          <form onSubmit={handleSearch} className="space-y-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket ID, QR token, or buyer name..."
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

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-3">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {result.buyer_name || result.buyer_email}
                      </div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {result.tier_name} | {result.matchType.toUpperCase()} match
                      </div>
                      {result.checked_in && (
                        <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                          Already checked in
                        </div>
                      )}
                    </div>
                    {!result.checked_in && (
                      <button
                        onClick={() => checkInTicket(result.id, 'id')}
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
