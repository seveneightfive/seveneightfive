import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdmin } from '@/lib/supabaseServer'
import TicketTiersEditor from '@/app/components/TicketTiersEditor'

/**
 * /dashboard/events/[id]/tickets
 *
 * Dedicated per-event ticket management surface.
 *
 * Combines:
 *   - Stripe Connect status reminder (if not enabled)
 *   - The TicketTiersEditor for this event
 *   - Focused sales stats (just this event)
 *   - Tier breakdown with progress
 *   - Attendee list
 *   - Quick links to scanner and public event page
 *
 * Access: must be the event creator OR a venue owner whose venue hosts the event
 * OR an artist linked to the event.
 */

type Params = { params: Promise<{ id: string }> }

export default async function EventTicketsPage({ params }: Params) {
  const { id: eventId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/events/${eventId}/tickets`)

  const admin = createAdmin()

  // Load event + verify access
  const { data: event } = await admin
    .from('events')
    .select(`
      id, title, slug, event_date, ticketing_enabled,
      auth_user_id, venue_id,
      venues(id, name, auth_user_id)
    `)
    .eq('id', eventId)
    .maybeSingle()

  if (!event) notFound()

  // Access check
  let hasAccess = event.auth_user_id === user.id
  if (!hasAccess && event.venue_id) {
    const venue = Array.isArray(event.venues) ? event.venues[0] : event.venues
    if (venue?.auth_user_id === user.id) hasAccess = true
  }
  if (!hasAccess) {
    const { data: myArtists } = await admin
      .from('artists').select('id').eq('auth_user_id', user.id)
    const myArtistIds = (myArtists || []).map((a: any) => a.id)
    if (myArtistIds.length) {
      const { data: link } = await admin
        .from('event_artists')
        .select('artist_id')
        .eq('event_id', eventId)
        .in('artist_id', myArtistIds)
        .limit(1)
        .maybeSingle()
      if (link) hasAccess = true
    }
  }
  if (!hasAccess) redirect('/dashboard/events')

  // Load profile for stripe status
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_account_status')
    .eq('id', user.id)
    .single()

  // Load tiers + sold tickets for this event
  const [{ data: tiers }, { data: tickets }] = await Promise.all([
    admin
      .from('ticket_tiers')
      .select('id, name, price, quantity, quantity_sold, is_active')
      .eq('event_id', eventId)
      .order('sort_order'),
    admin
      .from('tickets')
      .select(`
        id, buyer_name, buyer_email, amount_paid, status, payment_status,
        created_at, ticket_tier_id,
        ticket_tiers(name)
      `)
      .eq('event_id', eventId)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false }),
  ])

  const eventTickets = tickets || []
  const eventTiers = tiers || []
  const totalSold = eventTickets.length
  const totalRevenue = eventTickets.reduce(
    (sum, t) => sum + (parseFloat(t.amount_paid as any) || 0), 0
  )
  const totalPayout = eventTickets.reduce((sum, t) => {
    const price = parseFloat(t.amount_paid as any) || 0
    return sum + (price - (price * 0.029) - 1.00)
  }, 0)
  const checkedIn = eventTickets.filter(t => t.status === 'used').length

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })
  const formatTime = (d: string) =>
    new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })

  const stripeReady = profile?.stripe_account_status === 'enabled'

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --white: #fff; --accent: #C80650;
          --surface: rgba(255,255,255,0.04); --border: rgba(255,255,255,0.08);
          --border2: rgba(255,255,255,0.14); --dim: rgba(255,255,255,0.55);
          --faint: rgba(255,255,255,0.25); --gold: #ffce03; --green: #7ecf7e;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
        .topbar { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 52px; background: rgba(26,24,20,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
        .back-link { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); text-decoration: none; transition: color 0.15s; }
        .back-link:hover { color: var(--white); }
        .page-title { font-family: var(--serif); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
        .actions-bar { display: flex; gap: 10px; }
        .action-btn { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 5px 10px; border-radius: 6px; text-decoration: none; transition: opacity 0.15s; }
        .action-btn.scan { background: rgba(255,206,3,0.12); color: var(--gold); border: 1px solid rgba(255,206,3,0.3); }
        .action-btn.public { color: var(--accent); border: 1px solid rgba(200,6,80,0.3); }
        .content { max-width: 720px; margin: 0 auto; padding: 24px 20px 80px; }
        .header { padding-bottom: 18px; border-bottom: 1px solid var(--border2); margin-bottom: 24px; }
        .event-name { font-family: var(--serif); font-size: 1.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; line-height: 1.1; }
        .event-meta { font-size: 0.8rem; color: var(--dim); margin-top: 6px; }
        .stripe-warn { padding: 14px 16px; background: rgba(255,206,3,0.06); border: 1px solid rgba(255,206,3,0.25); border-radius: 10px; font-size: 0.85rem; color: rgba(255,206,3,0.9); margin-bottom: 24px; line-height: 1.5; }
        .stripe-warn a { color: var(--gold); font-weight: 700; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 28px; }
        .stat { padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
        .stat-val { font-family: var(--serif); font-size: 1.5rem; font-weight: 700; line-height: 1; }
        .stat-val.gold { color: var(--gold); }
        .stat-val.green { color: var(--green); }
        .stat-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); margin-top: 4px; }
        .section-head { font-family: var(--serif); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--faint); margin: 32px 0 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
        .tiers-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 0.82rem; }
        .tiers-table th { text-align: left; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); padding: 0 12px 8px; border-bottom: 1px solid var(--border); }
        .tiers-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--dim); }
        .tier-name { font-weight: 500; color: var(--white); }
        .progress-bar { width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 4px; }
        .progress-fill { height: 100%; background: var(--accent); border-radius: 2px; }
        .buyer-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 6px; }
        .buyer-name { font-size: 0.88rem; font-weight: 500; }
        .buyer-email { font-size: 0.72rem; color: var(--faint); margin-top: 1px; }
        .buyer-right { text-align: right; }
        .buyer-amount { font-family: var(--serif); font-size: 0.95rem; font-weight: 600; color: var(--green); }
        .buyer-tier { font-size: 0.65rem; color: var(--faint); margin-top: 2px; }
        .buyer-status { display: inline-block; font-size: 0.55rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; margin-left: 6px; }
        .buyer-status.used { background: rgba(126,207,126,0.12); color: var(--green); }
        .buyer-status.valid { background: rgba(255,255,255,0.06); color: var(--faint); }
        .empty-state { padding: 30px 20px; text-align: center; color: var(--faint); font-size: 0.85rem; }
        @media (max-width: 640px) {
          .stats-row { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div className="topbar">
        <a href={`/dashboard/events/edit?id=${eventId}`} className="back-link">← Back to Event</a>
        <span className="page-title">Tickets</span>
        <div className="actions-bar">
          {event.slug && (
            <a
              href={`/events/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="action-btn public"
            >
              View ↗
            </a>
          )}
          <a href="/dashboard/scan" className="action-btn scan">Scan</a>
        </div>
      </div>

      <div className="content">
        <div className="header">
          <div className="event-name">{event.title}</div>
          <div className="event-meta">
            {formatDate(event.event_date)}
            {' · '}
            {event.ticketing_enabled ? '785 Tickets enabled' : '785 Tickets disabled'}
          </div>
        </div>

        {!stripeReady && event.ticketing_enabled && (
          <div className="stripe-warn">
            ⚠ Your Stripe account isn't connected yet. You can save tier
            settings, but no one can buy tickets until you{' '}
            <a href="/dashboard/settings/payouts">finish Stripe Connect →</a>
          </div>
        )}

        {/* Headline stats */}
        <div className="stats-row">
          <div className="stat">
            <div className="stat-val gold">{totalSold}</div>
            <div className="stat-label">Tickets Sold</div>
          </div>
          <div className="stat">
            <div className="stat-val">{checkedIn}</div>
            <div className="stat-label">Checked In</div>
          </div>
          <div className="stat">
            <div className="stat-val green">${totalRevenue.toFixed(2)}</div>
            <div className="stat-label">Gross Revenue</div>
          </div>
          <div className="stat">
            <div className="stat-val">${Math.max(0, totalPayout).toFixed(2)}</div>
            <div className="stat-label">Est. Payout</div>
          </div>
        </div>

        {/* Tier editor */}
        <TicketTiersEditor
          eventId={eventId}
          stripeAccountStatus={profile?.stripe_account_status || null}
        />

        {/* Tier breakdown (read-only mirror of sold counts) */}
        {eventTiers.length > 0 && (
          <>
            <div className="section-head">Tier Performance</div>
            <table className="tiers-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Price</th>
                  <th>Sold</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {eventTiers.map(tier => {
                  const remaining = tier.quantity != null
                    ? tier.quantity - tier.quantity_sold
                    : null
                  const pct = tier.quantity
                    ? (tier.quantity_sold / tier.quantity) * 100
                    : 0
                  return (
                    <tr key={tier.id}>
                      <td><span className="tier-name">{tier.name}</span></td>
                      <td>{Number(tier.price) === 0 ? 'Free' : `$${Number(tier.price).toFixed(2)}`}</td>
                      <td>
                        {tier.quantity_sold}
                        {tier.quantity != null && (
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        )}
                      </td>
                      <td>{remaining != null ? remaining : '∞'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {/* Attendees */}
        <div className="section-head">Attendees</div>
        {eventTickets.length === 0 ? (
          <div className="empty-state">
            No tickets sold yet.
            {!event.slug && ' Save the event with a slug so it has a public URL.'}
          </div>
        ) : (
          eventTickets.map(t => {
            const tierName = Array.isArray(t.ticket_tiers)
              ? t.ticket_tiers[0]?.name
              : (t.ticket_tiers as any)?.name
            return (
              <div className="buyer-row" key={t.id}>
                <div>
                  <div className="buyer-name">
                    {t.buyer_name || 'Guest'}
                    <span className={`buyer-status ${t.status === 'used' ? 'used' : 'valid'}`}>
                      {t.status === 'used' ? 'Checked in' : 'Valid'}
                    </span>
                  </div>
                  <div className="buyer-email">{t.buyer_email}</div>
                </div>
                <div className="buyer-right">
                  <div className="buyer-amount">
                    {t.amount_paid ? `$${parseFloat(t.amount_paid as any).toFixed(2)}` : 'Free'}
                  </div>
                  <div className="buyer-tier">{tierName}</div>
                  <div className="buyer-tier">{formatTime(t.created_at)}</div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
