import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabaseServerAuth'
import QRCode from 'qrcode'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ticket } = await supabase
    .from('my_tickets')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!ticket) notFound()

  const qrDataUrl = await QRCode.toDataURL(ticket.qr_token, {
    width: 280,
    margin: 2,
    color: { dark: '#1a1814', light: '#ffffff' },
  })

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })

  const statusLabel = ticket.status === 'used' ? 'Checked In' : ticket.status === 'refunded' ? 'Refunded' : 'Valid'
  const statusClass = ticket.status === 'valid' ? 'status-valid' : ticket.status === 'used' ? 'status-used' : 'status-refunded'

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --white: #fff; --accent: #C80650;
          --surface: rgba(255,255,255,0.04); --border: rgba(255,255,255,0.08);
          --border2: rgba(255,255,255,0.14); --dim: rgba(255,255,255,0.55);
          --faint: rgba(255,255,255,0.25);
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { min-height: 100vh; background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
        .topbar { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 52px; background: rgba(26,24,20,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
        .back-link { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); text-decoration: none; transition: color 0.15s; }
        .back-link:hover { color: var(--white); }
        .page-title { font-family: var(--serif); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
        .wrap { display: flex; flex-direction: column; align-items: center; padding: 32px 20px 80px; }
        .ticket { width: 100%; max-width: 340px; background: var(--surface); border: 1px solid var(--border2); border-radius: 16px; overflow: hidden; }
        .ticket-stripe { height: 5px; background: var(--accent); }
        .ticket-body { padding: 20px; }
        .ticket-event { font-family: var(--serif); font-size: 1.3rem; font-weight: 700; text-transform: uppercase; line-height: 1.1; margin-bottom: 8px; }
        .ticket-meta { font-size: 0.82rem; color: var(--dim); line-height: 1.6; }
        .ticket-tier { display: inline-block; margin-top: 10px; padding: 3px 10px; background: rgba(200,6,80,0.15); border: 1px solid rgba(200,6,80,0.3); border-radius: 100px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); }
        .divider { height: 1px; border: none; border-top: 1px dashed rgba(255,255,255,0.12); margin: 0; }
        .qr-section { padding: 24px 20px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .qr-img { width: 200px; height: 200px; border-radius: 10px; display: block; }
        .qr-status { display: flex; align-items: center; gap: 8px; }
        .status-badge { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 5px 12px; border-radius: 100px; }
        .status-valid { background: rgba(45,122,45,0.15); color: #7ecf7e; border: 1px solid rgba(45,122,45,0.3); }
        .status-used { background: rgba(255,255,255,0.06); color: var(--faint); border: 1px solid var(--border); }
        .status-refunded { background: rgba(200,6,80,0.1); color: var(--accent); border: 1px solid rgba(200,6,80,0.2); }
        .token-wrap { width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; }
        .token-label { font-size: 0.55rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--faint); margin-bottom: 4px; }
        .token-text { font-family: monospace; font-size: 0.72rem; color: var(--dim); word-break: break-all; }
        .used-notice { margin-top: 24px; padding: 14px 16px; background: rgba(255,255,255,0.04); border: 1px solid var(--border2); border-radius: 10px; text-align: center; font-size: 0.82rem; color: var(--dim); line-height: 1.5; max-width: 340px; width: 100%; }
        .back-btn { margin-top: 20px; display: block; width: 100%; max-width: 340px; padding: 13px; border-radius: 8px; background: rgba(255,255,255,0.07); border: 1px solid var(--border2); color: var(--dim); font-family: var(--sans); font-size: 0.82rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; text-align: center; text-decoration: none; transition: background 0.15s; }
        .back-btn:hover { background: rgba(255,255,255,0.11); }
      `}</style>

      <div className="topbar">
        <a href="/dashboard/tickets" className="back-link">← My Tickets</a>
        <span className="page-title">Your Ticket</span>
        <div style={{ width: 80 }} />
      </div>

      <div className="wrap">
        <div className="ticket">
          <div className="ticket-stripe" />
          <div className="ticket-body">
            <div className="ticket-event">{ticket.event_title}</div>
            <div className="ticket-meta">
              {formatDate(ticket.event_date)}
              {ticket.event_start_time && ` · ${ticket.event_start_time}`}
              {ticket.venue_name && <><br />{ticket.venue_name}</>}
              {ticket.venue_address && <><br />{ticket.venue_address}</>}
            </div>
            <span className="ticket-tier">{ticket.tier_name}</span>
          </div>

          <div className="divider" />

          <div className="qr-section">
            {ticket.status === 'refunded' ? (
              <div style={{ textAlign: 'center', color: 'var(--accent)', fontSize: '0.88rem', padding: '12px 0' }}>
                This ticket has been refunded.
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Ticket QR code" className="qr-img" />
            )}

            <div className="qr-status">
              <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
            </div>

            <div className="token-wrap">
              <div className="token-label">Ticket ID</div>
              <div className="token-text">{ticket.qr_token}</div>
            </div>
          </div>
        </div>

        {ticket.status === 'used' && (
          <div className="used-notice">
            This ticket was scanned at the door. Thanks for coming!
          </div>
        )}

        <a href="/dashboard/tickets" className="back-btn">← Back to My Tickets</a>
      </div>
    </>
  )
}
