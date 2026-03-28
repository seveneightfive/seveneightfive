'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import QRCode from 'qrcode'

type Ticket = {
  id: string
  qr_token: string
  status: string
  payment_status: string
  amount_paid: number | null
  event_title: string
  event_date: string
  event_start_time: string | null
  event_slug: string
  tier_name: string
  venue_name: string | null
  venue_address: string | null
}

export default function TicketSuccessInner() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState(0)
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!sessionId) { setLoading(false); return }

    // Poll for the ticket — webhook may take a few seconds
    let tries = 0
    const poll = async () => {
      tries++
      const supabase = createClient()
      const { data } = await supabase
        .from('my_tickets')
        .select('*')
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false })
        .limit(4)

      if (data && data.length > 0) {
        setTickets(data)
        // Generate QR data URLs for each ticket
        const urls: Record<string, string> = {}
        await Promise.all(data.map(async (t: Ticket) => {
          urls[t.id] = await QRCode.toDataURL(t.qr_token, { width: 200, margin: 2 })
        }))
        setQrDataUrls(urls)
        setLoading(false)
      } else if (tries < 8) {
        setAttempts(tries)
        setTimeout(poll, 1500)
      } else {
        setLoading(false)
      }
    }
    poll()
  }, [sessionId])

  const STYLES = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --ink: #1a1814; --white: #fff; --accent: #C80650;
      --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
    }
    html, body { min-height: 100vh; background: var(--ink); color: var(--white); font-family: var(--sans); }
    .wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; }
    .card { width: 100%; max-width: 440px; }
    .check { font-size: 3rem; margin-bottom: 16px; }
    .heading { font-family: var(--serif); font-size: 2.5rem; font-weight: 700; text-transform: uppercase; line-height: 1; margin-bottom: 8px; }
    .sub { font-size: 0.88rem; color: rgba(255,255,255,0.5); margin-bottom: 32px; line-height: 1.6; }
    .ticket-card {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px; overflow: hidden; margin-bottom: 12px;
    }
    .ticket-stripe { height: 4px; background: var(--accent); }
    .ticket-body { padding: 20px; }
    .ticket-event { font-family: var(--serif); font-size: 1.2rem; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
    .ticket-meta { font-size: 0.82rem; color: rgba(255,255,255,0.5); line-height: 1.6; }
    .ticket-tier { display: inline-block; margin-top: 10px; padding: 3px 10px; background: rgba(200,6,80,0.15); border: 1px solid rgba(200,6,80,0.3); border-radius: 100px; font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); }
    .qr-wrap { padding: 20px; border-top: 1px dashed rgba(255,255,255,0.1); display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .qr-img { width: 160px; height: 160px; border-radius: 8px; display: block; }
    .qr-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 4px; text-align: center; }
    .qr-token { font-family: monospace; font-size: 0.65rem; color: rgba(255,255,255,0.35); word-break: break-all; text-align: center; }
    .actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
    .btn { display: block; width: 100%; padding: 13px; border-radius: 8px; font-family: var(--sans); font-size: 0.82rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; text-align: center; text-decoration: none; cursor: pointer; transition: opacity 0.15s; border: none; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-ghost { background: transparent; border: 1.5px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.6); }
    .btn:hover { opacity: 0.85; }
    .loading-spinner { width: 28px; height: 28px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `

  if (loading) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="wrap">
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="loading-spinner" />
            <div className="heading">Confirming</div>
            <p className="sub">
              {attempts > 2
                ? 'Almost there, just a moment…'
                : 'Processing your payment…'}
            </p>
          </div>
        </div>
      </>
    )
  }

  if (tickets.length === 0) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="wrap">
          <div className="card">
            <div className="check">✓</div>
            <div className="heading">Payment Complete</div>
            <p className="sub">
              Your ticket is being processed. You'll receive a confirmation email shortly.
              You can also view your tickets in your dashboard.
            </p>
            <div className="actions">
              <a href="/dashboard" className="btn btn-primary">Go to Dashboard</a>
              <a href="/events" className="btn btn-ghost">Browse Events</a>
            </div>
          </div>
        </div>
      </>
    )
  }

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="wrap">
        <div className="card">
          <div className="check">🎟</div>
          <div className="heading">You're In!</div>
          <p className="sub">
            Your {tickets.length === 1 ? 'ticket is' : 'tickets are'} confirmed.
            Show your QR code at the door.
          </p>

          {tickets.map(ticket => (
            <div className="ticket-card" key={ticket.id}>
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
              <div className="qr-wrap">
                {qrDataUrls[ticket.id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrls[ticket.id]} alt="Ticket QR code" className="qr-img" />
                )}
                <div className="qr-label">Show this at the door</div>
                <div className="qr-token">{ticket.qr_token}</div>
              </div>
            </div>
          ))}

          <div className="actions">
            <a href="/dashboard/tickets" className="btn btn-primary">View All My Tickets</a>
            <a href="/events" className="btn btn-ghost">Browse More Events</a>
          </div>
        </div>
      </div>
    </>
  )
}
