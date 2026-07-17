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
}

const sectionHeadingCls =
  'mb-4 border-b border-gray-100 pb-3 font-display text-xl font-bold uppercase tracking-wide text-gray-900 dark:border-gray-800 dark:text-white'

export default function EventMarketingTab({ eventId, eventSlug, eventTitle }: Props) {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const supabase = createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://seveneightfive.com'
  const eventUrl = `${siteUrl}/events/${eventSlug}`
  const qrUrl = `${eventUrl}?ref=qr`

  useEffect(() => {
    async function loadData() {
      try {
        // Generate QR code for event page
        const qr = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 })
        setQrDataUrl(qr)

        // Load analytics from aggregation table (fast!)
        const { data: analyticsData } = await supabase
          .from('event_analytics')
          .select('*')
          .eq('event_id', eventId)
          .maybeSingle()

        setAnalytics({
          totalViews: analyticsData?.total_page_views || 0,
          qrScans: analyticsData?.views_qr || 0,
          directViews: analyticsData?.views_direct || 0,
          socialViews: analyticsData?.views_social || 0,
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
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className={sectionHeadingCls}>Event URL</h3>
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
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className={sectionHeadingCls}>QR Code</h3>
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
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className={sectionHeadingCls}>Share on Social</h3>
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

      {/* Analytics Section — Tickets Sold / Check-Ins / Check-In Rate now
          live under the Ticketing tab instead, next to the rest of the
          ticketing numbers. This stays focused on traffic sources. */}
      {analytics && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className={sectionHeadingCls}>Analytics</h3>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total Views', value: analytics.totalViews, color: 'text-blue-600' },
              { label: 'QR', value: analytics.qrScans, color: 'text-green-600' },
              { label: 'Direct', value: analytics.directViews, color: 'text-purple-600' },
              { label: 'Social', value: analytics.socialViews, color: 'text-pink-600' },
            ].map((stat, i) => (
              <div key={i} className="rounded-lg bg-gray-50 p-4 dark:bg-white/[0.02]">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {stat.label}
                </div>
                <div className={`mt-1 text-2xl font-bold ${stat.color}`}>
                  {stat.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
