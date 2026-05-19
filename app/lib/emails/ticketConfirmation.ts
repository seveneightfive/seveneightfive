import type { SendTicketEmailArgs } from '../email'
import { formatDate, formatTime } from '../email'

/**
 * Build the HTML body for a ticket confirmation email.
 *
 * Hand-rolled HTML with inline styles — no React Email or build step.
 * QR codes are generated via qr.io service (URL-based, reliable in all clients).
 * Organizer contact pulled from the event creator's profile.
 */
export function ticketConfirmationEmail(args: SendTicketEmailArgs & {
  qrDataUris: string[] // Still passed in but we'll use URLs instead
  siteUrl: string
  organizerName: string | null
  organizerEmail: string | null
}): string {
  const {
    buyerName,
    event,
    tickets,
    amountPaid,
    orderRef,
    siteUrl,
    organizerName,
    organizerEmail,
  } = args

  const greeting = buyerName ? `Thanks, ${escapeHtml(buyerName)}!` : 'Thanks!'

  const dateStr = event.date ? formatDate(event.date) : null
  const timeStr = event.startTime ? formatTime(event.startTime) : null
  const endTimeStr = event.endTime ? formatTime(event.endTime) : null
  const timeDisplay = timeStr
    ? endTimeStr
      ? `${timeStr} – ${endTimeStr}`
      : timeStr
    : null

  // Type guard narrows (string | null)[] -> string[] for TS strict mode.
  // Venue address already contains city/state, so don't duplicate it.
  const venueLine = [event.venueName, event.venueAddress]
    .filter((s): s is string => Boolean(s))
    .map(escapeHtml)
    .join(' · ')

  const heroImg = event.image_url
    ? `<img src="${escapeHtml(event.image_url)}" alt="${escapeHtml(event.title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px 12px 0 0;border:0;" />`
    : ''

  const ticketCards = tickets
    .map((t, i) => {
      const ticketUrl = `${siteUrl}/tickets/${encodeURIComponent(t.qr_token)}`
      // Generate QR via qr.io service — URL-based, works in all email clients
      const qrUrl = `https://qr.io/?qr=${encodeURIComponent(t.qr_token)}`
      
      return `
        <tr>
          <td style="padding:0 0 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1.5px solid #ece8e2;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:24px 24px 16px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#b8b3ad;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                    Ticket ${i + 1} of ${tickets.length}
                  </div>
                  <div style="margin-top:6px;font-size:16px;font-weight:600;color:#1a1814;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                    ${escapeHtml(t.ticket_tier_name)}
                  </div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 24px 16px;">
                  <img src="${qrUrl}" alt="QR code for ticket ${i + 1}" width="240" height="240" style="display:block;width:240px;height:240px;border:0;background:#ffffff;padding:8px;border-radius:4px;" />
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 24px 24px;">
                  <div style="font-size:11px;color:#8a8580;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;letter-spacing:0.05em;word-break:break-all;">
                    ${escapeHtml(t.qr_token)}
                  </div>
                  <a href="${escapeHtml(ticketUrl)}" style="display:inline-block;margin-top:12px;font-size:13px;color:#C80650;text-decoration:underline;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                    View ticket online
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap');
    </style>
    <title>Your ticket${tickets.length > 1 ? 's' : ''} for ${escapeHtml(event.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1814;">
    <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f7f6f4;line-height:1px;">
      Your ${tickets.length} ticket${tickets.length > 1 ? 's' : ''} for ${escapeHtml(event.title)} — show the QR at the door.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f6f4;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
            <!-- Brand header: 785 TICKETS in Oswald font -->
            <tr>
              <td style="padding:0 0 16px;">
                <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;letter-spacing:0.12em;color:#1a1814;text-transform:uppercase;">
                  785 Tickets
                </div>
              </td>
            </tr>

            <!-- Hero card -->
            <tr>
              <td style="padding:0 0 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1.5px solid #ece8e2;border-radius:12px;overflow:hidden;">
                  ${heroImg ? `<tr><td>${heroImg}</td></tr>` : ''}
                  <tr>
                    <td style="padding:24px;">
                      <div style="font-size:22px;font-weight:700;color:#1a1814;line-height:1.25;">
                        ${escapeHtml(event.title)}
                      </div>
                      ${
                        dateStr || timeDisplay || venueLine
                          ? `<div style="margin-top:16px;font-size:14px;color:#1a1814;line-height:1.6;">`
                          : ''
                      }
                        ${dateStr ? `<div><strong>DATE:</strong> ${dateStr}</div>` : ''}
                        ${timeDisplay ? `<div style="margin-top:4px;"><strong>TIME:</strong> ${timeDisplay}</div>` : ''}
                        ${venueLine ? `<div style="margin-top:4px;"><strong>WHERE:</strong> ${venueLine}</div>` : ''}
                      ${dateStr || timeDisplay || venueLine ? `</div>` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Greeting -->
            <tr>
              <td style="padding:0 4px 16px;">
                <div style="font-size:16px;color:#1a1814;">${greeting}</div>
                <div style="margin-top:6px;font-size:14px;color:#6b6560;line-height:1.6;">
                  Your ticket${tickets.length > 1 ? 's are' : ' is'} below. Show the QR code at the entrance, either from this email or by tapping View Ticket Online.
                </div>
              </td>
            </tr>

            <!-- Ticket cards -->
            ${ticketCards}

            <!-- Order details -->
            <tr>
              <td style="padding:8px 4px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #ece8e2;padding-top:16px;">
                  <tr>
                    <td style="font-size:13px;color:#6b6560;">
                      ${
                        amountPaid !== null
                          ? `<div>Order total: <strong style="color:#1a1814;">$${amountPaid.toFixed(2)}</strong></div>`
                          : ''
                      }
                      <div style="margin-top:4px;">Order reference: <span style="font-family:'SFMono-Regular',Consolas,monospace;font-size:12px;">${escapeHtml(orderRef)}</span></div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Closing -->
            <tr>
              <td style="padding:16px 4px;">
                <div style="font-size:14px;color:#1a1814;">Cheers!</div>
                <div style="margin-top:2px;font-size:13px;color:#1a1814;font-weight:500;">785 Magazine</div>
              </td>
            </tr>

            <!-- Footer: Event organizer + platform support -->
            <tr>
              <td style="padding:24px 4px;text-align:left;border-top:1px solid #ece8e2;">
                <div style="font-size:12px;color:#8a8580;line-height:1.6;">
                  <div style="margin-bottom:8px;">
                    <strong style="color:#1a1814;">Questions about the event?</strong> Contact
                    ${organizerName ? ` <strong>${escapeHtml(organizerName)}</strong>` : ' the organizer'}
                    ${organizerEmail ? ` at <a href="mailto:${escapeHtml(organizerEmail)}" style="color:#C80650;text-decoration:underline;">${escapeHtml(organizerEmail)}</a>` : ''}
                  </div>
                  <div>
                    <strong style="color:#1a1814;">Questions about your order or this email?</strong> Send to
                    <a href="mailto:kerrice@seveneightfive.com" style="color:#C80650;text-decoration:underline;">kerrice@seveneightfive.com</a>
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
