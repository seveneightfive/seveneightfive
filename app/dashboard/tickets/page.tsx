import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabaseServerAuth'

export default async function DashboardTicketsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tickets } = await supabase
    .from('my_tickets')
    .select('*')
    .order('event_date', { ascending: true })

  const now = new Date()
  const upcoming = (tickets || []).filter(t => new Date(t.event_date + 'T23:59:59') >= now)
  const past = (tickets || []).filter(t => new Date(t.event_date + 'T23:59:59') < now)

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatMonth = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })
  const formatDay = (d: string) => new Date(d + 'T12:00:00').getDate()

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink2: #221f1b; --white: #fff;
          --surface: rgba(255,255,255,0.04); --border: rgba(255,255,255,0.08);
          --border2: rgba(255,255,255,0.14); --dim: rgba(255,255,255,0.6);
          --faint: rgba(255,255,255,0.28); --accent: #C80650;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
        .topbar { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 52px; background: rgba(26,24,20,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
        .back-link { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); text-decoration: none; }
        .back-link:hover { color: rgba(255,255,255,0.7); }
        .page-title { font-family: var(--serif); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
        .content { max-width: 600px; margin: 0 auto; padding: 0 0 60px; }
        .section-head { padding: 24px 20px 12px; }
        .section-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.35); }
        .ticket-list { padding: 0 20px; display: flex; flex-direction: column; gap: 10px; }
        .ticket-card { display: flex; gap: 14px; align-items: center; padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--white); transition: background 0.15s; }
        .ticket-card:hover { background: rgba(255,255,255,0.07); border-color: var(--border2); }
        .ticket-card.past { opacity: 0.55; }
        .ticket-date { flex-shrink: 0; width: 44px; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .ticket-month { font-size: 0.55rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
        .ticket-day { font-family: var(--serif); font-size: 1.6rem; font-weight: 700; line-height: 1; }
        .ticket-info { flex: 1; min-width: 0; }
        .ticket-title { font-family: var(--serif); font-size: 0.95rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ticket-meta { font-size: 0.75rem; color: var(--dim); margin-top: 3px; }
        .ticket-tier { display: inline-block; margin-top: 5px; padding: 2px 8px; background: rgba(200,6,80,0.12); border: 1px solid rgba(200,6,80,0.25); border-radius: 100px; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); }
        .ticket-status { flex-shrink: 0; }
        .status-badge { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 4px 8px; border-radius: 100px; }
        .status-valid { background: rgba(45,122,45,0.15); color: #7ecf7e; border: 1px solid rgba(45,122,45,0.3); }
        .status-used { background: rgba(255,255,255,0.06); color: var(--faint); border: 1px solid var(--border); }
        .status-refunded { background: rgba(200,6,80,0.1); color: var(--accent); border: 1px solid rgba(200,6,80,0.2); }
        .empty { margin: 12px 20px 0; padding: 24px 20px; background: var(--surface); border: 1px dashed var(--border2); border-radius: 12px; text-align: center; }
        .empty p { font-size: 0.85rem; color: var(--dim); line-height: 1.6; }
        .empty a { color: var(--accent); text-decoration: none; font-weight: 500; }
        .divider { height: 1px; background: var(--border); margin: 8px 0; }
      `}</style>

      <div className="topbar">
        <a href="/dashboard" className="back-link">← Dashboard</a>
        <span className="page-title">My Tickets</span>
        <div style={{ width: 80 }} />
      </div>

      <div className="content">

        {/* Upcoming */}
        <div className="section-head">
          <span className="section-label">Upcoming</span>
        </div>

        {upcoming.length === 0 ? (
          <div className="empty">
            <p>No upcoming tickets. <a href="/events">Browse events →</a></p>
          </div>
        ) : (
          <div className="ticket-list">
            {upcoming.map(ticket => (
              <a
                key={ticket.id}
                href={`/dashboard/tickets/${ticket.id}`}
                className="ticket-card"
              >
                <div className="ticket-date">
                  <span className="ticket-month">{formatMonth(ticket.event_date)}</span>
                  <span className="ticket-day">{formatDay(ticket.event_date)}</span>
                </div>
                <div className="ticket-info">
                  <div className="ticket-title">{ticket.event_title}</div>
                  <div className="ticket-meta">
                    {ticket.event_start_time && `${ticket.event_start_time} · `}
                    {ticket.venue_name || 'Venue TBA'}
                  </div>
                  <span className="ticket-tier">{ticket.tier_name}</span>
                </div>
                <div className="ticket-status">
                  <span className={`status-badge status-${ticket.status}`}>
                    {ticket.status === 'valid' ? 'Valid' : ticket.status}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <div className="divider" style={{ margin: '24px 0 0' }} />
            <div className="section-head">
              <span className="section-label">Past</span>
            </div>
            <div className="ticket-list">
              {past.map(ticket => (
                <a
                  key={ticket.id}
                  href={`/dashboard/tickets/${ticket.id}`}
                  className="ticket-card past"
                >
                  <div className="ticket-date">
                    <span className="ticket-month">{formatMonth(ticket.event_date)}</span>
                    <span className="ticket-day">{formatDay(ticket.event_date)}</span>
                  </div>
                  <div className="ticket-info">
                    <div className="ticket-title">{ticket.event_title}</div>
                    <div className="ticket-meta">
                      {formatDate(ticket.event_date)}
                      {ticket.venue_name && ` · ${ticket.venue_name}`}
                    </div>
                    <span className="ticket-tier">{ticket.tier_name}</span>
                  </div>
                  <div className="ticket-status">
                    <span className={`status-badge status-${ticket.status}`}>
                      {ticket.status === 'used' ? 'Attended' : ticket.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </>
        )}

      </div>
    </>
  )
}
