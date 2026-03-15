import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdmin } from '@/lib/supabaseServer'

export default async function TicketSalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdmin()

  // Get all events created by this user that have ticketing enabled
  const { data: events } = await supabase
    .from('events')
    .select('id, title, event_date, slug, ticketing_enabled')
    .eq('auth_user_id', user.id)
    .eq('ticketing_enabled', true)
    .order('event_date', { ascending: false })

  // For each event, get tier summaries and ticket counts
  const eventIds = (events || []).map(e => e.id)

  const [{ data: tiers }, { data: tickets }] = await Promise.all([
    eventIds.length
      ? admin.from('ticket_tiers').select('id, event_id, name, price, quantity, quantity_sold').in('event_id', eventIds)
      : Promise.resolve({ data: [] as any[] }),
    eventIds.length
      ? admin.from('tickets').select('id, event_id, tier_name: ticket_tier_id, buyer_name, buyer_email, amount_paid, status, payment_status, created_at, ticket_tiers(name)').in('event_id', eventIds).eq('payment_status', 'paid').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ])

  const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const formatTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --white: #fff; --accent: #C80650;
          --surface: rgba(255,255,255,0.04); --border: rgba(255,255,255,0.08);
          --border2: rgba(255,255,255,0.14); --dim: rgba(255,255,255,0.55);
          --faint: rgba(255,255,255,0.25); --gold: #ffce03;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
        .topbar { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 52px; background: rgba(26,24,20,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
        .back-link { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); text-decoration: none; transition: color 0.15s; }
        .back-link:hover { color: var(--white); }
        .page-title { font-family: var(--serif); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
        .content { max-width: 680px; margin: 0 auto; padding: 24px 20px 80px; }
        .event-block { margin-bottom: 40px; }
        .event-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid var(--border2); margin-bottom: 16px; }
        .event-name { font-family: var(--serif); font-size: 1.2rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
        .event-date { font-size: 0.75rem; color: var(--dim); margin-top: 3px; }
        .event-link { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); text-decoration: none; white-space: nowrap; margin-left: 12px; padding-top: 4px; }
        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
        .stat { padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
        .stat-val { font-family: var(--serif); font-size: 1.5rem; font-weight: 700; line-height: 1; }
        .stat-val.green { color: #7ecf7e; }
        .stat-val.gold { color: var(--gold); }
        .stat-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); margin-top: 4px; }
        .tiers-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.82rem; }
        .tiers-table th { text-align: left; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); padding: 0 12px 8px; border-bottom: 1px solid var(--border); }
        .tiers-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--dim); }
        .tiers-table tr:last-child td { border-bottom: none; }
        .tier-name { font-weight: 500; color: var(--white); }
        .progress-bar { width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 4px; }
        .progress-fill { height: 100%; background: var(--accent); border-radius: 2px; }
        .buyers-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); margin-bottom: 8px; padding: 0 2px; }
        .buyer-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 6px; }
        .buyer-name { font-size: 0.88rem; font-weight: 500; }
        .buyer-email { font-size: 0.72rem; color: var(--faint); margin-top: 1px; }
        .buyer-right { text-align: right; }
        .buyer-amount { font-family: var(--serif); font-size: 0.95rem; font-weight: 600; color: #7ecf7e; }
        .buyer-tier { font-size: 0.65rem; color: var(--faint); margin-top: 2px; }
        .buyer-time { font-size: 0.65rem; color: var(--faint); }
        .empty-state { padding: 40px 20px; text-align: center; }
        .empty-title { font-family: var(--serif); font-size: 1.5rem; font-weight: 700; text-transform: uppercase; margin-bottom: 10px; color: rgba(255,255,255,0.3); }
        .empty-sub { font-size: 0.85rem; color: var(--faint); line-height: 1.6; }
        .empty-sub a { color: var(--accent); text-decoration: none; }
      `}</style>

      <div className="topbar">
        <a href="/dashboard" className="back-link">← Dashboard</a>
        <span className="page-title">Ticket Sales</span>
        <div style={{ width: 80 }} />
      </div>

      <div className="content">

        {(!events || events.length === 0) ? (
          <div className="empty-state">
            <div className="empty-title">No Ticketed Events</div>
            <p className="empty-sub">
              Enable 785 Tickets on an event to start selling.<br />
              <a href="/dashboard/events">Go to my events →</a>
            </p>
          </div>
        ) : (
          (events || []).map(event => {
            const eventTiers = (tiers || []).filter(t => t.event_id === event.id)
            const eventTickets = (tickets || []).filter(t => t.event_id === event.id)
            const totalSold = eventTickets.length
            const totalRevenue = eventTickets.reduce((sum, t) => sum + (parseFloat(t.amount_paid) || 0), 0)
            const totalCapacity = eventTiers.reduce((sum, t) => sum + (t.quantity || 0), 0)

            return (
              <div className="event-block" key={event.id}>
                <div className="event-header">
                  <div>
                    <div className="event-name">{event.title}</div>
                    <div className="event-date">{formatDate(event.event_date)}</div>
                  </div>
                  <a href={`/dashboard/events/edit?id=${event.id}`} className="event-link">
                    Edit Event →
                  </a>
                </div>

                {/* Stats */}
                <div className="stats-row">
                  <div className="stat">
                    <div className="stat-val gold">{totalSold}</div>
                    <div className="stat-label">Tickets Sold</div>
                  </div>
                  <div className="stat">
                    <div className="stat-val green">${totalRevenue.toFixed(2)}</div>
                    <div className="stat-label">Gross Revenue</div>
                  </div>
                  <div className="stat">
                    <div className="stat-val">${(totalRevenue * 0.95).toFixed(2)}</div>
                    <div className="stat-label">Your Payout (est.)</div>
                  </div>
                </div>

                {/* Tier breakdown */}
                {eventTiers.length > 0 && (
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
                        const remaining = tier.quantity ? tier.quantity - tier.quantity_sold : null
                        const pct = tier.quantity ? (tier.quantity_sold / tier.quantity) * 100 : 0
                        return (
                          <tr key={tier.id}>
                            <td><span className="tier-name">{tier.name}</span></td>
                            <td>{tier.price === 0 ? 'Free' : `$${parseFloat(tier.price).toFixed(2)}`}</td>
                            <td>
                              {tier.quantity_sold}
                              {tier.quantity && (
                                <div className="progress-bar">
                                  <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                              )}
                            </td>
                            <td>{remaining !== null ? remaining : '∞'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}

                {/* Buyer list */}
                {eventTickets.length > 0 && (
                  <>
                    <div className="buyers-label">Attendees ({totalSold})</div>
                    {eventTickets.map(ticket => {
                      const tierName = Array.isArray(ticket.ticket_tiers)
                        ? ticket.ticket_tiers[0]?.name
                        : ticket.ticket_tiers?.name
                      return (
                        <div className="buyer-row" key={ticket.id}>
                          <div>
                            <div className="buyer-name">{ticket.buyer_name || 'Guest'}</div>
                            <div className="buyer-email">{ticket.buyer_email}</div>
                          </div>
                          <div className="buyer-right">
                            <div className="buyer-amount">
                              {ticket.amount_paid ? `$${parseFloat(ticket.amount_paid).toFixed(2)}` : 'Free'}
                            </div>
                            <div className="buyer-tier">{tierName}</div>
                            <div className="buyer-time">{formatTime(ticket.created_at)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {eventTickets.length === 0 && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--faint)', padding: '8px 2px' }}>
                    No tickets sold yet.
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
