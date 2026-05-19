import { Resend } from 'resend'
import QRCode from 'qrcode'
import { ticketConfirmationEmail } from './emails/ticketConfirmation'

export const resend = new Resend(process.env.RESEND_API_KEY)

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`

  return 'https://seveneightfive.com'
}

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
  orderRef: string // session id or payment intent id
  // Organizer contact info
  organizerName: string | null
  organizerEmail: string | null
}

/**
 * Send a single confirmation email to the buyer containing one QR code
 * per ticket purchased.
 *
 * QR codes are generated via qr.io service (URL-based, works in all clients).
 * Organizer contact info is included at the bottom so buyers can reach out
 * with questions.
 */
export async function sendTicketEmail(args: SendTicketEmailArgs) {
  // Generate dummy data URIs (we don't actually use them, but the function
  // signature still expects them for backward compatibility)
  const qrDataUris = args.tickets.map(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')

  const html = ticketConfirmationEmail({
    ...args,
    qrDataUris,
    siteUrl: siteUrl(),
  })

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

  if (args.event.date) lines.push(`DATE: ${formatDate(args.event.date)}`)
  if (args.event.startTime) lines.push(`TIME: ${formatTime(args.event.startTime)}`)
  
  const venueLine = [args.event.venueName, args.event.venueAddress]
    .filter(Boolean)
    .join(' · ')
  if (venueLine) lines.push(`WHERE: ${venueLine}`)

  lines.push('', `Your ${args.tickets.length} ticket${args.tickets.length > 1 ? 's' : ''}:`)

  args.tickets.forEach((t, i) => {
    lines.push('')
    lines.push(`  Ticket ${i + 1}: ${t.ticket_tier_name}`)
    lines.push(`  View / scan: ${url}/tickets/${t.qr_token}`)
  })

  lines.push('')
  lines.push(`Order reference: ${args.orderRef}`)
  lines.push('')
  lines.push('Show the QR code at the entrance, either from this email or by')
  lines.push('visiting the link above.')
  lines.push('')
  lines.push('Cheers!')
  lines.push('785 Magazine')
  lines.push('')

  if (args.organizerName || args.organizerEmail) {
    lines.push('Questions about the event? Contact ' + 
      (args.organizerName ? args.organizerName : 'the organizer') +
      (args.organizerEmail ? ` at ${args.organizerEmail}` : ''))
  }

  lines.push('Questions about your order? Send to kerrice@seveneightfive.com')

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
