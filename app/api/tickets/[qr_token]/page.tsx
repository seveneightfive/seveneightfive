import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabaseServer'

/**
 * /tickets/[qr_token]
 *
 * Public ticket display page. Anyone with the qr_token URL can view
 * the ticket — there is no auth gate. The token itself is the secret
 * (UUID, ~10^36 entropy), so guessing one is infeasible. This is the
 * same security model as Eventbrite / Ticketmaster shareable links.
 *
 * Renders:
 *   - Event hero image, title, date/time, venue
 *   - Big QR code (PNG generated server-side from qr_token)
 *   - Tier name, status indicator
 *   - Placeholder slots for Apple/Google Wallet buttons (Stage 2)
 *
 * Lookups by qr_token, fetches event + tier + venue in one query.
 */

type Params = { qr_token: string }

export const dynamic = 'force-dynamic'

export default async function TicketPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { qr_token } = await params

  const admin = createClient()

  const { data: ticket, error } = await admin
    .from('tickets')
    .select(`
      id,
      qr_token,
      status,
      payment_status,
      buyer_name,
      buyer_email,
      checked_in_at,
      created_at,
      ticket_tiers ( name ),
      events (
        title,
        slug,
        image_url,
        event_date,
        event_start_time,
        event_end_time,
        venues ( name, address, city, state )
      )
    `)
    .eq('qr_token', qr_token)
    .maybeSingle()

  if (error || !ticket) notFound()

  const ev = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
  const tier = Array.isArray(ticket.ticket_tiers)
    ? ticket.ticket_tiers[0]
    : ticket.ticket_tiers
  const venue = Array.isArray(ev?.venues) ? ev?.venues[0] : ev?.venues

  // Generate QR PNG inline as data URI
  const qrDataUri = await QRCode.toDataURL(ticket.qr_token, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 380,
    color: { dark: '#1a1814', light: '#ffffff' },
  })

  const isCheckedIn = !!ticket.checked_in_at
  const isCancelled = ticket.status === 'cancelled' || ticket.status === 'refunded'
  const isValid = ticket.status === 'valid' && ticket.payment_status === 'paid' && !isCheckedIn

  const dateStr = ev?.event_date ? formatDate(ev.event_date) : null
  const timeStr = ev?.event_start_time ? formatTime(ev.event_start_time) : null
  const endTimeStr = ev?.event_end_time ? formatTime(ev.event_end_time) : null
  const timeDisplay = timeStr ? (endTimeStr ? `${timeStr} – ${endTimeStr}` : timeStr) : null

  const venueLine = [venue?.name, venue?.address, [venue?.city, venue?.state].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f6f4',
        padding: '24px 16px',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        color: '#1a1814',
      }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Brand header */}
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '0.08em',
            marginBottom: 16,
          }}
        >
          🎟 785 TICKETS
        </div>

        {/* Status banner */}
        {isValid && (
          <StatusBanner color="#2d7a2d" label="Valid Ticket" sub="Present at entrance" />
        )}
        {isCheckedIn && (
          <StatusBanner
            color="#6b6560"
            label="Checked In"
            sub={`Scanned ${new Date(ticket.checked_in_at!).toLocaleString()}`}
          />
        )}
        {isCancelled && (
          <StatusBanner
            color="#C80650"
            label={ticket.status === 'refunded' ? 'Refunded' : 'Cancelled'}
            sub="This ticket is no longer valid"
          />
        )}

        {/* QR card */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #ece8e2',
            borderRadius: 16,
            overflow: 'hidden',
            marginTop: 16,
            opacity: isCancelled ? 0.5 : 1,
          }}
        >
          {ev?.image_url && (
            <img
              src={ev.image_url}
              alt={ev.title || ''}
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          )}

          <div style={{ padding: 24 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#b8b3ad',
              }}
            >
              {tier?.name || 'Ticket'}
            </div>
            <h1
              style={{
                margin: '6px 0 0',
                fontSize: 24,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {ev?.title}
            </h1>
            {(dateStr || timeDisplay) && (
              <div style={{ marginTop: 12, fontSize: 15 }}>
                {dateStr && <div>📅 {dateStr}</div>}
                {timeDisplay && <div style={{ marginTop: 4 }}>🕐 {timeDisplay}</div>}
              </div>
            )}
            {venueLine && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#6b6560' }}>
                📍 {venueLine}
              </div>
            )}
          </div>

          {/* QR */}
          <div
            style={{
              background: '#f7f6f4',
              padding: '24px 16px',
              borderTop: '1px solid #ece8e2',
              textAlign: 'center',
            }}
          >
            <img
              src={qrDataUri}
              alt="Ticket QR code"
              width={280}
              height={280}
              style={{
                display: 'block',
                margin: '0 auto',
                background: '#fff',
                borderRadius: 8,
                padding: 12,
                width: 280,
                height: 280,
              }}
            />
            <div
              style={{
                marginTop: 12,
                fontSize: 10,
                color: '#8a8580',
                fontFamily: 'SFMono-Regular, Consolas, monospace',
                letterSpacing: '0.05em',
                wordBreak: 'break-all',
              }}
            >
              {ticket.qr_token}
            </div>
          </div>

          {/* Wallet placeholder buttons (Stage 2) */}
          <div
            style={{
              padding: '16px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <button
              disabled
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: '1.5px solid #ece8e2',
                background: '#ffffff',
                color: '#b8b3ad',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'not-allowed',
              }}
              title="Coming soon"
            >
               Add to Apple Wallet (coming soon)
            </button>
            <button
              disabled
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: '1.5px solid #ece8e2',
                background: '#ffffff',
                color: '#b8b3ad',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'not-allowed',
              }}
              title="Coming soon"
            >
              Add to Google Wallet (coming soon)
            </button>
          </div>
        </div>

        {/* Buyer footer */}
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            fontSize: 12,
            color: '#6b6560',
            textAlign: 'center',
          }}
        >
          Issued to {ticket.buyer_name || ticket.buyer_email}
        </div>
      </div>
    </div>
  )
}

function StatusBanner({
  color,
  label,
  sub,
}: {
  color: string
  label: string
  sub: string
}) {
  return (
    <div
      style={{
        background: color,
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 12,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function formatDate(iso: string): string {
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

function formatTime(raw: string): string {
  const [hStr, mStr] = raw.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ? parseInt(mStr, 10) : 0
  if (Number.isNaN(h)) return raw
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`
}
