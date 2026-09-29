'use client'

// Door check-in link as a QR code. Volunteers scan it with their phone
// camera to open the check-in scanner — no typing a long URL, no account.
// Organizers can print a one-page sign-up sheet for the volunteer table,
// download the QR as a PNG, text the link, or copy it.

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Printer, Download, MessageSquare, Copy, Check } from 'lucide-react'

type Props = {
  checkInUrl: string
  loading: boolean
  eventTitle: string
  eventDateLabel: string
  eventSlug?: string | null
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export default function CheckInQrCard({ checkInUrl, loading, eventTitle, eventDateLabel, eventSlug }: Props) {
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!checkInUrl) { setQr(null); return }
    QRCode.toDataURL(checkInUrl, { width: 640, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(null))
  }, [checkInUrl])

  const copy = () => {
    if (!checkInUrl) return
    navigator.clipboard.writeText(checkInUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = `${eventSlug || 'event'}-check-in-qr.png`
    a.click()
  }

  // One printable page: big QR, event name, three-step instructions.
  const print = () => {
    if (!qr) return
    const w = window.open('', '_blank', 'width=800,height=1000')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>Check-in — ${escapeHtml(eventTitle)}</title>
<style>
  @page { size: letter; margin: 0.6in; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; text-align: center; margin: 0; }
  .kicker { font-size: 13px; letter-spacing: .18em; text-transform: uppercase; color: #C80650; font-weight: 700; margin-top: 12px; }
  h1 { font-size: 30px; margin: 8px 0 4px; }
  .date { font-size: 15px; color: #555; margin-bottom: 20px; }
  img { width: 4.6in; height: 4.6in; }
  ol { text-align: left; max-width: 5in; margin: 22px auto 0; font-size: 16px; line-height: 1.6; padding-left: 1.2em; }
  .url { margin-top: 22px; font-size: 11px; color: #777; word-break: break-all; max-width: 6in; margin-left: auto; margin-right: auto; }
  .note { margin-top: 10px; font-size: 12px; color: #C80650; font-weight: 600; }
</style></head><body>
  <div class="kicker">Volunteer Check-In</div>
  <h1>${escapeHtml(eventTitle)}</h1>
  <div class="date">${escapeHtml(eventDateLabel)}</div>
  <img src="${qr}" alt="Check-in QR code" />
  <ol>
    <li>Open your phone's camera and point it at this code.</li>
    <li>Tap the link that pops up — no app or account needed.</li>
    <li>Scan each guest's ticket QR code to check them in.</li>
  </ol>
  <div class="url">${escapeHtml(checkInUrl)}</div>
  <div class="note">Keep this sheet with event staff — anyone with this code can check guests in.</div>
  <script>window.onload = () => { setTimeout(() => window.print(), 250) }</script>
</body></html>`)
    w.document.close()
  }

  const smsHref = checkInUrl
    ? `sms:?&body=${encodeURIComponent(`Check-in link for ${eventTitle}: ${checkInUrl}`)}`
    : undefined

  const btn =
    'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]'

  if (loading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">Setting up your check-in link…</div>
  }
  if (!checkInUrl) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Couldn&rsquo;t load the check-in link. Refresh the page to try again.
      </div>
    )
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[200px_1fr] sm:items-center">
      <div className="mx-auto w-[200px] rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-800">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Door check-in QR code" className="h-auto w-full" />
        ) : (
          <div className="aspect-square w-full animate-pulse rounded bg-gray-100" />
        )}
      </div>

      <div>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Volunteers scan this with their phone camera to open the door scanner — no account or
          typing needed. Print it for the check-in table, or text the link to your team.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={print} disabled={!qr} className={`${btn} col-span-2 !border-brand-600 !bg-brand-600 !text-white hover:!bg-brand-700`}>
            <Printer className="h-4 w-4" /> Print check-in sheet
          </button>
          <button onClick={download} disabled={!qr} className={btn}>
            <Download className="h-4 w-4" /> Download QR
          </button>
          <a href={smsHref} className={btn}>
            <MessageSquare className="h-4 w-4" /> Text link
          </a>
          <button onClick={copy} className={`${btn} col-span-2`}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Anyone with this code can check guests in, so share it only with your event staff.
        </p>
      </div>
    </div>
  )
}
