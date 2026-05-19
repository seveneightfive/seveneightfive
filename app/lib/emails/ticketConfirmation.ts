import type { SendTicketEmailArgs } from '../email'
import { formatDate, formatTime } from '../email'

/**
 * Build the HTML body for a ticket confirmation email.
 *
 * Hand-rolled HTML with inline styles — no React Email or build step.
 * Tested in Gmail (web + iOS), Apple Mail, Outlook web. Uses table-
 * based layout because Outlook desktop ignores most modern CSS.
 *
 * Each ticket renders as its own card with a QR code below event
 * metadata. QR codes are embedded as data: URIs (max ~10KB each),
 * which is well under Resend / Gmail's 30MB cap even for 10+ tickets.
 */
export function ticketConfirmationEmail(args: SendTicketEmailArgs & {
  qrDataUris: string[]
  siteUrl: string
}): string {
  const {
    buyerName,
    event,
    tickets,
    amountPaid,
    orderRef,
    qrDataUris,
    siteUrl,
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

  const venueLine = [event.venueName, event.venueAddress, event.venueCityState]
  .filter((s): s is string => Boolean(s))
  .map(escapeHtml)
  .join(' · ')

  const heroImg = event.image_url
    ? `<img src="${escapeHtml(event.image_url)}" alt="${escapeHtml(event.title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px 12px 0 0;border:0;" />`
    : ''

  const ticketCards = tickets
    .map((t, i) => {
      const ticketUrl = `${siteUrl}/tickets/${encodeURIComponent(t.qr_token)}`
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
                  <img src="${qrDataUris[i]}" alt="QR code for ticket ${i + 1}" width="240" height="240" style="display:block;width:240px;height:240px;border:0;" />
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
            <!-- Brand header -->
            <tr>
              <td style="padding:0 0 16px;">
                <div style="font-family:'Oswald',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;font-size:18px;font-weight:600;letter-spacing:0.08em;color:#1a1814;">
                  🎟 785 TICKETS
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
                        dateStr || timeDisplay
                          ? `<div style="margin-top:12px;font-size:15px;color:#1a1814;">
                              ${dateStr ? `<div>📅 ${dateStr}</div>` : ''}
                              ${timeDisplay ? `<div style="margin-top:4px;">🕐 ${timeDisplay}</div>` : ''}
                            </div>`
                          : ''
                      }
                      ${
                        venueLine
                          ? `<div style="margin-top:12px;font-size:14px;color:#6b6560;">📍 ${venueLine}</div>`
                          : ''
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Greeting -->
            <tr>
              <td style="padding:0 4px 16px;">
                <div style="font-size:16px;color:#1a1814;">${greeting}</div>
                <div style="margin-top:6px;font-size:14px;color:#6b6560;line-height:1.5;">
                  Your ${tickets.length === 1 ? 'ticket is' : `${tickets.length} tickets are`} ready. Show the QR code${tickets.length > 1 ? 's' : ''} below at the entrance — either from this email or by tapping <em>View ticket online</em>.
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

            <!-- Footer -->
            <tr>
              <td style="padding:24px 4px;text-align:center;border-top:1px solid #ece8e2;">
                <div style="font-size:12px;color:#8a8580;line-height:1.6;">
                  Questions about the event? Reply to the organizer.<br />
                  Questions about your order or this email? Visit
                  <a href="${siteUrl}" style="color:#C80650;text-decoration:underline;">${siteUrl.replace(/^https?:\/\//, '')}</a>.
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
