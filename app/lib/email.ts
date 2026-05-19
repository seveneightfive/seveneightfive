import { Resend } from 'resend'
import QRCode from 'qrcode'
import { ticketConfirmationEmail } from './emails/ticketConfirmation'

export const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Public site URL (no trailing slash) used to build absolute links in
 * outgoing emails. Falls back to a Vercel preview URL or hardcoded
 * production URL.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`

  return 'https://seveneightfive.com'
}

/**
 * From-address used for all transactional ticket emails.
 *
 * NOTE: The domain `seveneightfive.com` must be verified in Resend
 * (Resend → Domains → Add Domain → add the provided SPF / DKIM / DMARC
 * DNS records) before this will deliver to anyone other than the
 * Resend account owner. Until verified, deliveries will be limited /
 * bounce.
 */
const TICKET_FROM = '785 Tickets <noreply@seveneightfive.com>'

export type TicketEmailTicket = {
  qr_token: string
  ticket_tier_name: string
}

export type SendTicketEmailArgs = {
  to: string
  buyerName: string | null
  event: {
    title: string
    date: string | null // ISO yyyy-mm-dd
    startTime: string | null // HH:MM or HH:MM:SS
    endTime: string | null
    image_url: string | null
    slug: string
    venueName: string | null
    venueAddress: string | null
    venueCityState: string | null
  }
  tickets: TicketEmailTicket[]
  amountPaid: number | null
  orderRef: string // session id or payment intent id, shown to user
}

/**
 * Send a single confirmation email to the buyer containing one QR code
 * per ticket purchased.
 *
 * Returns the Resend response { data, error }. Errors are NOT thrown —
 * callers should log them and decide whether to retry. We never want
 * an email failure to fail the webhook (Stripe would retry and double-
 * mint tickets).
 */
export async function sendTicketEmail(args: SendTicketEmailArgs) {
  // Generate one inline PNG per ticket. Resend supports CID attachments
  // via inline images; we use data: URIs in the HTML which works in
  // Gmail, Apple Mail, and Outlook web. Avoids the CID attachment
  // dance entirely.
  const qrDataUris = await Promise.all(
    args.tickets.map((t) =>
      QRCode.toDataURL(t.qr_token, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 280,
        color: { dark: '#1a1814', light: '#ffffff' },
      })
    )
  )

  const html = ticketConfirmationEmail({
    ...args,
    qrDataUris,
    siteUrl: siteUrl(),
  })

  // Plain-text fallback (some clients prefer this; spam-filters like it)
  const text = buildPlainText(args)

  return resend.emails.send({
    from: TICKET_FROM,
    to: args.to,
    subject: `Your ticket${args.tickets.length > 1 ? 's' : ''} for ${args.event.title}`,
    html,
    text,
    tags: [
      { name: 'category', value: 'ticket_confirmation' },
      { name: 'event_slug', value: args.event.slug },
    ],
  })
}

function buildPlainText(args: SendTicketEmailArgs): string {
  const url = siteUrl()
  const lines: string[] = [
    `Thanks${args.buyerName ? `, ${args.buyerName}` : ''}!`,
    '',
    `You're confirmed for ${args.event.title}.`,
    '',
  ]

  if (args.event.date) lines.push(`Date: ${formatDate(args.event.date)}`)
  if (args.event.startTime) lines.push(`Time: ${formatTime(args.event.startTime)}`)
  if (args.event.venueName) {
    const v = [args.event.venueName, args.event.venueAddress, args.event.venueCityState]
      .filter(Boolean)
      .join(', ')
    lines.push(`Venue: ${v}`)
  }

  lines.push('', `Your ${args.tickets.length} ticket${args.tickets.length > 1 ? 's' : ''}:`)

  args.tickets.forEach((t, i) => {
    lines.push('')
    lines.push(`  Ticket ${i + 1}: ${t.ticket_tier_name}`)
    lines.push(`  View / scan: ${url}/tickets/${t.qr_token}`)
  })

  lines.push('')
  lines.push(`Order reference: ${args.orderRef}`)
  lines.push('')
  lines.push('Present the QR code at the entrance — print it or have it')
  lines.push('ready on your phone.')

  return lines.join('\n')
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function formatTime(raw: string): string {
  // accepts HH:MM or HH:MM:SS
  const [hStr, mStr] = raw.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ? parseInt(mStr, 10) : 0
  if (Number.isNaN(h)) return raw
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`
}
