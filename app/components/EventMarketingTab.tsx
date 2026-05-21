'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { Loader2 } from 'lucide-react'
import QRCode from 'qrcode'

type Props = {
  eventId: string
  eventSlug: string
  eventTitle: string
}

type Analytics = {
  totalViews: number
  qrScans: number
  directViews: number
  socialViews: number
  checkIns: number
  checkInRate: number
  ticketsSold: number
}

export default function EventMarketingTab({ eventId, eventSlug, eventTitle }: Props) {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const supabase = createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://seveneightfive.com'
  const eventUrl = `${siteUrl}/events/${eventSlug}`
  const qrUrl = `${eventUrl}?ref=qr`
  const checkInUrl = `${siteUrl}/events/${eventSlug}/checkin`

  useEffect(() => {
    async function loadData() {
      try {
        // Generate QR code for event page
        const qr = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 })
        setQrDataUrl(qr)

        // Load analytics from aggregation table (fast!)
        const [analyticsRes, ticketsRes, checkInsRes] = await Promise.all([
          supabase
            .from('event_analytics')
            .select('*')
            .eq('event_id', eventId)
            .maybeSingle(),
          supabase
            .from('tickets')
            .select('id')
            .eq('event_id', eventId)
            .eq('payment_status', 'paid'),
          supabase
            .from('check_ins')
            .select('id')
            .in(
              'ticket_id',
              (await supabase
                .from('tickets')
                .select('id')
                .eq('event_id', eventId)
                .then((r) => r.data?.map((t) => t.id) || []))
            ),
        ])

        const analyticsData = analyticsRes.data
        const tickets = ticketsRes.data || []
        const checkins = checkInsRes.data || []

        const totalViews = analyticsData?.total_page_views || 0
        const qrScans = analyticsData?.views_qr || 0
        const directViews = analyticsData?.views_direct || 0
        const socialViews = analyticsData?.views_social || 0
        const checkInCount = checkins.length
        const ticketsSold = tickets.length
        const checkInRate = ticketsSold > 0 ? (checkInCount / ticketsSold) * 100 : 0

        setAnalytics({
          totalViews,
          qrScans,
          directViews,
          socialViews,
          checkIns: checkInCount,
          checkInRate,
          ticketsSold,
        })

        setLoading(false)
      } catch (err) {
        console.error('Error loading analytics:', err)
        setLoading(false)
      }
    }

    loadData()
  }, [eventId, supabase])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadQR = async () => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `${eventSlug}-qr.png`
    link.click()
  }

  const socialShareLinks = {
  facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${eventUrl}?ref=facebook`)}`,
  twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(`${eventUrl}?ref=twitter`)}&text=${encodeURIComponent(`Check out ${eventTitle} on 785 Magazine`)}`,
  linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${eventUrl}?ref=linkedin`)}`,
}

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Event URL Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Event URL</h3>
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Share this link with your audience:</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={eventUrl}
            readOnly
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-300"
          />
          <button
            onClick={() => copyToClipboard(eventUrl)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* QR Code Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">QR Code</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Share this QR code to drive traffic to your event:
        </p>
        {qrDataUrl && (
          <div className="mb-4 flex justify-center">
            <img src={qrDataUrl} alt="Event QR Code" className="h-48 w-48 rounded-lg border border-gray-200 dark:border-gray-800" />
          </div>
        )}
        <button
          onClick={downloadQR}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-300 dark:hover:bg-white/[0.04]"
        >
          Download QR Code
        </button>
      </div>

      {/* Social Share Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Share on Social</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Click to open share dialog on your preferred platform:
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { name: 'Facebook', key: 'facebook', color: 'bg-blue-600' },
            { name: 'Twitter', key: 'twitter', color: 'bg-black' },
            { name: 'LinkedIn', key: 'linkedin', color: 'bg-blue-700' },
          ].map((platform) => (
            <a
              key={platform.key}
              href={socialShareLinks[platform.key as keyof typeof socialShareLinks]}
              target="_blank"
              rel="noopener noreferrer"
              className={`${platform.color} inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold text-white transition hover:opacity-90`}
            >
              {platform.name}
            </a>
          ))}
        </div>
      </div>

      {/* Check-In Page Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Door Check-In</h3>
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Share this link with staff to check in attendees at the door. No app download needed:
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={checkInUrl}
            readOnly
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-300"
          />
          <button
            onClick={() => copyToClipboard(checkInUrl)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Analytics Section */}
      {analytics && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Analytics</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Total Page Views', value: analytics.totalViews, color: 'text-blue-600' },
              { label: 'QR Code Scans', value: analytics.qrScans, color: 'text-green-600' },
              { label: 'Direct Visits', value: analytics.directViews, color: 'text-purple-600' },
              { label: 'Social Visits', value: analytics.socialViews, color: 'text-pink-600' },
              { label: 'Tickets Sold', value: analytics.ticketsSold, color: 'text-orange-600' },
              { label: 'Check-Ins', value: analytics.checkIns, color: 'text-teal-600' },
              {
                label: 'Check-In Rate',
                value: `${analytics.checkInRate.toFixed(1)}%`,
                color: 'text-indigo-600',
              },
            ].map((stat, i) => (
              <div key={i} className="rounded-lg bg-gray-50 p-4 dark:bg-white/[0.02]">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {stat.label}
                </div>
                <div className={`mt-1 text-2xl font-bold ${stat.color}`}>
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
