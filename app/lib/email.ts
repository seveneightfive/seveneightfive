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
  // Per-attendee name, when the order collected one. Optional because
  // free RSVPs / older orders may not have per-ticket names.
  attendee_name?: string | null
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
    lines.push(`  Ticket ${i + 1}: ${t.ticket_tier_name}${t.attendee_name ? ` — ${t.attendee_name}` : ''}`)
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

export type AttendeeTicketEmailArgs = {
  to: string
  attendeeName: string | null
  purchaserName: string | null
  event: SendTicketEmailArgs['event']
  ticket: TicketEmailTicket
  amountPaid: number | null
  organizerName: string | null
  organizerEmail: string | null
}

/**
 * Sends a lightweight single-ticket notification to an attendee who
 * isn't the purchaser (e.g. someone bought a ticket for a friend and
 * gave that friend's email at checkout). Distinct from
 * sendTicketEmail — the purchaser still gets the full order
 * confirmation with every ticket; this is just "hey, you've got a
 * ticket to this thing," addressed to the attendee, with only their
 * own QR code.
 */
export async function sendAttendeeTicketEmail(args: AttendeeTicketEmailArgs) {
  const { to, attendeeName, purchaserName, event, ticket, organizerName, organizerEmail } = args
  const url = siteUrl()
  const ticketUrl = `${url}/tickets/${encodeURIComponent(ticket.qr_token)}`
  const qrUrl = `https://qr.io/?qr=${encodeURIComponent(ticket.qr_token)}`

  const dateStr = event.date ? formatDate(event.date) : null
  const timeStr = event.startTime ? formatTime(event.startTime) : null
  const venueLine = [event.venueName, event.venueAddress].filter(Boolean).join(' · ')

  const greeting = attendeeName ? `Hey ${escapeHtml(attendeeName)},` : 'Hey,'
  const gaveByLine = purchaserName
    ? `${escapeHtml(purchaserName)} got you a ticket to <strong>${escapeHtml(event.title)}</strong>.`
    : `You've got a ticket to <strong>${escapeHtml(event.title)}</strong>.`

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap');</style>
    <title>Your ticket for ${escapeHtml(event.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1814;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f6f4;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;width:100%;">
            <tr>
              <td style="padding:0 0 16px;">
                <div style="font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;letter-spacing:0.12em;color:#1a1814;text-transform:uppercase;">785 Tickets</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 4px 16px;">
                <div style="font-size:16px;">${greeting}</div>
                <div style="margin-top:6px;font-size:14px;color:#6b6560;line-height:1.6;">${gaveByLine}</div>
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1.5px solid #ece8e2;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="padding:24px 24px 16px;">
                      <div style="font-size:16px;font-weight:600;color:#1a1814;">${escapeHtml(ticket.ticket_tier_name)}</div>
                      ${dateStr || timeStr || venueLine ? `<div style="margin-top:10px;font-size:13px;color:#6b6560;line-height:1.6;">` : ''}
                        ${dateStr ? `<div>${dateStr}</div>` : ''}
                        ${timeStr ? `<div>${timeStr}</div>` : ''}
                        ${venueLine ? `<div>${escapeHtml(venueLine)}</div>` : ''}
                      ${dateStr || timeStr || venueLine ? `</div>` : ''}
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 24px 16px;">
                      <img src="${qrUrl}" alt="QR code" width="220" height="220" style="display:block;width:220px;height:220px;border:0;background:#fff;padding:8px;border-radius:4px;" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 24px 24px;">
                      <a href="${escapeHtml(ticketUrl)}" style="display:inline-block;font-size:13px;color:#C80650;text-decoration:underline;">View ticket online</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 4px;font-size:12px;color:#8a8580;line-height:1.6;">
                Show this QR code at the entrance.
                ${organizerName || organizerEmail ? `<div style="margin-top:8px;"><strong style="color:#1a1814;">Questions about the event?</strong> Contact${organizerName ? ` <strong>${escapeHtml(organizerName)}</strong>` : ' the organizer'}${organizerEmail ? ` at <a href="mailto:${escapeHtml(organizerEmail)}" style="color:#C80650;text-decoration:underline;">${escapeHtml(organizerEmail)}</a>` : ''}</div>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    attendeeName ? `Hey ${attendeeName},` : 'Hey,',
    '',
    purchaserName ? `${purchaserName} got you a ticket to ${event.title}.` : `You've got a ticket to ${event.title}.`,
    '',
    ticket.ticket_tier_name,
    dateStr || '',
    timeStr || '',
    venueLine || '',
    '',
    `View / scan: ${ticketUrl}`,
    '',
    'Show this QR code at the entrance.',
  ].filter(Boolean).join('\n')

  return resend.emails.send({
    from: TICKET_FROM,
    to,
    subject: `You've got a ticket for ${event.title}`,
    html,
    text,
    tags: [
      { name: 'category', value: 'attendee_ticket_notification' },
      { name: 'event_slug', value: event.slug },
    ],
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
