import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabaseServerAuth'
import AvatarMenu from './AvatarMenu'
import StripeConnectButton from '@/app/components/StripeConnectButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: artists }, { data: venues }, { data: profile }] = await Promise.all([
    supabase
      .from('artists')
      .select('id, name, slug, tagline, image_url, avatar_url, artist_type, verified')
      .eq('auth_user_id', user.id),
    supabase
      .from('venues')
      .select('id, name, slug, venue_type, image_url, logo')
      .eq('auth_user_id', user.id),
    supabase
      .from('profiles')
      .select('full_name, email, phone_number, role, stripe_account_id, stripe_account_status')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  // Also fetch via junction tables (covers entities where auth_user_id isn't set but user is linked)
  const [{ data: venueUserLinks }, { data: artistUserLinks }] = await Promise.all([
    supabase.from('venue_users').select('venue_id').eq('user_id', user.id),
    supabase.from('artist_users').select('artist_id').eq('user_id', user.id),
  ])

  const extraVenueIds = (venueUserLinks || [])
    .map((r: any) => r.venue_id)
    .filter((id: string) => !(venues || []).some((v: any) => v.id === id))

  const extraArtistIds = (artistUserLinks || [])
    .map((r: any) => r.artist_id)
    .filter((id: string) => !(artists || []).some((a: any) => a.id === id))

  const [{ data: extraVenues }, { data: extraArtists }] = await Promise.all([
    extraVenueIds.length
      ? supabase.from('venues').select('id, name, slug, venue_type, image_url, logo').in('id', extraVenueIds)
      : Promise.resolve({ data: [] as any[] }),
    extraArtistIds.length
      ? supabase.from('artists').select('id, name, slug, tagline, image_url, avatar_url, artist_type, verified').in('id', extraArtistIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const allVenues = [...(venues || []), ...(extraVenues || [])]
  const allArtists = [...(artists || []), ...(extraArtists || [])]

  // Fetch followed artists + venues for the feed
  const { data: follows } = await supabase
    .from('follows')
    .select('entity_type, entity_id')
    .eq('follower_id', user.id)
    .in('entity_type', ['artist', 'venue'])

  const followedArtistIds = (follows || []).filter(f => f.entity_type === 'artist').map(f => f.entity_id)
  const followedVenueIds = (follows || []).filter(f => f.entity_type === 'venue').map(f => f.entity_id)

  const [{ data: followedArtists }, { data: followedVenues }] = await Promise.all([
    followedArtistIds.length
      ? supabase.from('artists').select('id, name, slug, avatar_url, artist_type').in('id', followedArtistIds)
      : Promise.resolve({ data: [] as any[] }),
    followedVenueIds.length
      ? supabase.from('venues').select('id, name, slug, logo, image_url, venue_type').in('id', followedVenueIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Fetch upcoming tickets
  const { data: tickets } = await supabase
    .from('my_tickets')
    .select('id, event_title, event_date, event_slug, tier_name, venue_name, status')
    .eq('payment_status', 'paid')
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true })
    .limit(3)

  const isCreator = allArtists.length > 0 || allVenues.length > 0
  const firstName = profile?.full_name?.split(' ')[0] || 'There'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const TYPE_LABEL: Record<string, string> = {
    Musician: 'Musician', Visual: 'Visual Artist', Performance: 'Performer', Literary: 'Literary Artist',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink2: #221f1b; --ink3: #2a2721;
          --surface: rgba(255,255,255,0.04);
          --border: rgba(255,255,255,0.08); --border2: rgba(255,255,255,0.14);
          --white: #fff; --dim: rgba(255,255,255,0.6); --faint: rgba(255,255,255,0.28);
          --accent: #C80650; --accent2: rgba(200,6,80,0.12);
          --gold: #ffce03; --gold2: rgba(255,206,3,0.1);
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

        /* ── TOPBAR ── */
        .topbar {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px; height: 52px;
          background: rgba(26,24,20,0.95); backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }
        .wordmark {
          font-family: var(--serif); font-size: 0.68rem; font-weight: 600;
          letter-spacing: 0.22em; text-transform: uppercase;
          text-decoration: none; color: rgba(255,255,255,0.35);
        }
        .wordmark em { font-style: normal; color: var(--accent); }

        /* ── CONTENT ── */
        .content { max-width: 600px; margin: 0 auto; padding: 0 0 60px; }

        /* ── GREETING ── */
        .greeting { padding: 28px 20px 24px; border-bottom: 1px solid var(--border); }
        .greeting-eyebrow {
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em;
          text-transform: uppercase; color: var(--accent); margin-bottom: 6px;
        }
        .greeting-name {
          font-family: var(--serif); font-size: 2.2rem; font-weight: 700;
          text-transform: uppercase; line-height: 0.95; letter-spacing: -0.01em;
        }
        .greeting-sub {
          margin-top: 8px; font-size: 0.82rem; font-weight: 300;
          color: var(--dim); line-height: 1.5;
        }

        /* ── SECTION HEAD ── */
        .section-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 20px 12px;
        }
        .section-label {
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em;
          text-transform: uppercase; color: rgba(255,255,255,0.35);
        }
        .section-action {
          font-size: 0.7rem; font-weight: 500; color: var(--accent);
          text-decoration: none; letter-spacing: 0.04em;
        }

        /* ── CREATE GRID ── */
        .create-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 10px; padding: 4px 20px 16px;
        }
        .create-btn {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 6px; padding: 16px 12px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; cursor: pointer; text-decoration: none;
          transition: background 0.15s, border-color 0.15s;
        }
        .create-btn:hover { background: rgba(255,255,255,0.07); border-color: var(--border2); }
        .create-btn.yellow { background: rgba(255,206,3,0.08); border-color: rgba(255,206,3,0.28); }
        .create-btn.yellow:hover { background: rgba(255,206,3,0.15); }
        .create-btn.red { background: rgba(200,6,80,0.08); border-color: rgba(200,6,80,0.28); }
        .create-btn.red:hover { background: rgba(200,6,80,0.15); }
        .create-icon {
          font-size: 1.4rem; font-weight: 300; line-height: 1;
          color: var(--white); font-family: var(--serif);
        }
        .create-btn.yellow .create-icon { color: var(--gold); }
        .create-btn.red .create-icon { color: var(--accent); }
        .create-label {
          font-family: var(--serif); font-size: 0.78rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: rgba(255,255,255,0.7); text-align: center;
        }
        .create-btn.yellow .create-label { color: var(--gold); }
        .create-btn.red .create-label { color: var(--accent); }

        /* ── DIVIDER ── */
        .divider { height: 1px; background: var(--border); margin: 8px 0; }

        /* ── FOLLOWING SCROLL ── */
        .hscroll {
          display: flex; gap: 10px; overflow-x: auto;
          padding: 0 20px 16px; scrollbar-width: none;
        }
        .hscroll::-webkit-scrollbar { display: none; }
        .follow-card {
          flex-shrink: 0; width: 80px;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          cursor: pointer;
        }
        .follow-img {
          width: 64px; height: 64px; border-radius: 50%;
          background: var(--ink3); border: 2px solid var(--border2);
          display: flex; align-items: center; justify-content: center; font-size: 1.3rem;
        }
        .follow-img.venue { border-radius: 12px; }
        .follow-name {
          font-size: 0.68rem; font-weight: 400; text-align: center;
          color: rgba(255,255,255,0.7); line-height: 1.3;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
        }
        .follow-type {
          font-size: 0.52rem; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--faint); margin-top: -4px;
        }
        .empty-follow {
          margin: 0 20px 16px; padding: 20px;
          background: var(--surface); border: 1px dashed var(--border2);
          border-radius: 12px; text-align: center;
        }
        .empty-follow p { font-size: 0.82rem; color: var(--dim); line-height: 1.6; }
        .empty-follow a { color: var(--accent); text-decoration: none; font-weight: 500; }

        /* ── EVENT CARDS ── */
        .event-list { padding: 0 20px; display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
        .event-card {
          display: flex; gap: 14px; align-items: center;
          padding: 12px; background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; cursor: pointer; text-decoration: none;
          transition: background 0.15s, border-color 0.15s;
        }
        .event-card:hover { background: rgba(255,255,255,0.07); border-color: var(--border2); }
        .event-date {
          flex-shrink: 0; width: 44px; text-align: center;
          display: flex; flex-direction: column; align-items: center;
        }
        .event-month {
          font-size: 0.55rem; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--accent);
        }
        .event-day {
          font-family: var(--serif); font-size: 1.6rem; font-weight: 700; line-height: 1;
        }
        .event-info { flex: 1; min-width: 0; }
        .event-title {
          font-family: var(--serif); font-size: 0.95rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.03em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .event-meta { font-size: 0.75rem; color: var(--dim); margin-top: 3px; }
        .event-img {
          flex-shrink: 0; width: 52px; height: 52px; border-radius: 8px;
          background: var(--ink3); overflow: hidden;
          display: flex; align-items: center; justify-content: center; font-size: 1.2rem;
        }
        .event-img img { width: 100%; height: 100%; object-fit: cover; }
        .empty-events {
          margin: 0 20px 16px; padding: 20px;
          background: var(--surface); border: 1px dashed var(--border2);
          border-radius: 12px; text-align: center;
        }
        .empty-events p { font-size: 0.82rem; color: var(--dim); line-height: 1.6; }

        /* ── CREATOR SECTION ── */
        .creator-head {
          padding: 20px 20px 4px; display: flex; align-items: center; gap: 10px;
        }
        .creator-title {
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em;
          text-transform: uppercase; color: rgba(255,255,255,0.35);
        }
        .creator-badge {
          font-size: 0.55rem; font-weight: 700; letter-spacing: 0.16em;
          text-transform: uppercase; padding: 4px 10px; border-radius: 20px;
          background: rgba(255,206,3,0.12); color: var(--gold);
          border: 1px solid rgba(255,206,3,0.25);
        }

        /* ── ENTITY CARDS ── */
        .entity-cards { padding: 12px 20px; display: flex; flex-direction: column; gap: 10px; }
        .entity-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden;
        }
        .entity-card-header {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-bottom: 1px solid var(--border);
        }
        .entity-thumb {
          width: 44px; height: 44px; border-radius: 10px;
          background: var(--ink3); display: flex; align-items: center;
          justify-content: center; font-size: 1.1rem; flex-shrink: 0;
          overflow: hidden;
        }
        .entity-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .entity-card-name {
          font-family: var(--serif); font-size: 1rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.02em;
        }
        .entity-card-type {
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--accent); margin-top: 2px;
        }
        .entity-actions { display: flex; }
        .entity-action {
          flex: 1; padding: 11px 8px; text-align: center; cursor: pointer;
          font-size: 0.65rem; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--dim);
          border-right: 1px solid var(--border);
          transition: color 0.15s, background 0.15s;
          text-decoration: none; display: flex; flex-direction: column;
          align-items: center; gap: 4px;
        }
        .entity-action:last-child { border-right: none; }
        .entity-action:hover { color: var(--white); background: rgba(255,255,255,0.04); }
        .entity-action-icon { font-size: 0.9rem; }
      `}</style>

      {/* ── TOPBAR ── */}
      <div className="topbar">
        <a href="/" className="wordmark"><em>785</em>MAGAZINE</a>
        <AvatarMenu
          initials={initials}
          fullName={profile?.full_name || 'Your Account'}
          phoneOrEmail={profile?.phone_number || profile?.email || ''}
        />
      </div>

      <div className="content">

        {/* ── GREETING ── */}
        <div className="greeting">
          <div className="greeting-eyebrow">Your 785</div>
          <div className="greeting-name">Hey,<br />{firstName}</div>
          <div className="greeting-sub">Your personal feed of artists, venues & events.</div>
        </div>

        {/* ── CREATE GRID ── */}
        <div className="section-head" style={{paddingBottom: '4px'}}>
          <span className="section-label">Create</span>
        </div>
        <div className="create-grid">
          <a href="/dashboard/events/edit" className="create-btn yellow">
            <span className="create-icon">+</span>
            <span className="create-label">Event</span>
          </a>
          <a href="/dashboard/announcements/new" className="create-btn red">
            <span className="create-icon">+</span>
            <span className="create-label">Announcement</span>
          </a>
          <a href="/dashboard/artists/new" className="create-btn">
            <span className="create-icon">+</span>
            <span className="create-label">Artist Page</span>
          </a>
          <a href="/dashboard/venues/new" className="create-btn">
            <span className="create-icon">+</span>
            <span className="create-label">Venue Page</span>
          </a>
        </div>

        <div className="divider" />

        {/* ── MY TICKETS ── */}
        <div className="section-head">
          <span className="section-label">🎟 My Tickets</span>
          <a href="/dashboard/tickets" className="section-action">All →</a>
        </div>

        {!tickets || tickets.length === 0 ? (
          <div className="empty-follow">
            <p>No upcoming tickets. <a href="/events">Browse events →</a></p>
          </div>
        ) : (
          <div className="event-list">
            {tickets.map((ticket: any) => {
              const d = new Date(ticket.event_date + 'T12:00:00')
              const month = d.toLocaleDateString('en-US', { month: 'short' })
              const day = d.getDate()
              return (
                <a key={ticket.id} href={`/events/${ticket.event_slug}`} className="event-card">
                  <div className="event-date">
                    <span className="event-month">{month}</span>
                    <span className="event-day">{day}</span>
                  </div>
                  <div className="event-info">
                    <div className="event-title">{ticket.event_title}</div>
                    <div className="event-meta">{ticket.venue_name || 'Venue TBA'} · {ticket.tier_name}</div>
                  </div>
                  <div className="event-img">🎟</div>
                </a>
              )
            })}
          </div>
        )}

        <div className="divider" />

        {/* ── FOLLOWING ── */}
        <div className="section-head">
          <span className="section-label">Following</span>
          <a href="/artists" className="section-action">Explore →</a>
        </div>

        {(!followedArtists || followedArtists.length === 0) && (!followedVenues || followedVenues.length === 0) ? (
          <div className="empty-follow">
            <p>You're not following anyone yet.<br />
            <a href="/artists">Discover artists</a> and <a href="/venues">venues</a> to follow.</p>
          </div>
        ) : (
          <div className="hscroll">
            {(followedArtists || []).map((a: any) => (
              <a key={a.id} href={`/artists/${a.slug}`} className="follow-card" style={{textDecoration:'none',color:'inherit'}}>
                <div className="follow-img">
                  {a.avatar_url
                    ? <img src={a.avatar_url} alt={a.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} />
                    : '🎨'}
                </div>
                <div className="follow-name">{a.name}</div>
                <div className="follow-type">{a.artist_type || 'Artist'}</div>
              </a>
            ))}
            {(followedVenues || []).map((v: any) => (
              <a key={v.id} href={`/venues/${v.slug}`} className="follow-card" style={{textDecoration:'none',color:'inherit'}}>
                <div className="follow-img venue">
                  {v.logo || v.image_url
                    ? <img src={v.logo || v.image_url} alt={v.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'12px'}} />
                    : '🏛️'}
                </div>
                <div className="follow-name">{v.name}</div>
                <div className="follow-type">Venue</div>
              </a>
            ))}
          </div>
        )}

        {/* ── CREATOR TOOLS ── only shows if user has artist or venue linked ── */}
        {isCreator && (
          <>
            <div className="creator-head">
              <span className="creator-title">Your Pages</span>
              <span className="creator-badge">✦ Creator</span>
            </div>

            {/* ── STRIPE CONNECT ── */}
            <div style={{ padding: '0 20px 16px' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
                785 Tickets — Payouts
              </div>
              <StripeConnectButton
                accountStatus={profile?.stripe_account_status || null}
                returnPath="/dashboard"
              />
            </div>

            <div className="entity-cards">

              {/* Artist cards */}
              {allArtists.map(artist => (
                <div className="entity-card" key={artist.id}>
                  <div className="entity-card-header">
                    <div className="entity-thumb">
                      {artist.avatar_url || artist.image_url
                        ? <img src={artist.avatar_url || artist.image_url} alt={artist.name} />
                        : '🎨'}
                    </div>
                    <div>
                      <div className="entity-card-name">{artist.name}</div>
                      <div className="entity-card-type">{TYPE_LABEL[artist.artist_type || ''] || 'Artist'}</div>
                    </div>
                  </div>
                  <div className="entity-actions">
                    <a href={`/dashboard/edit?id=${artist.id}`} className="entity-action">
                      <span className="entity-action-icon">◉</span>
                      Edit
                    </a>
                    <a href="/dashboard/appearances" className="entity-action">
                      <span className="entity-action-icon">★</span>
                      Shows
                    </a>
                    {artist.slug && (
                      <a href={`/artists/${artist.slug}`} className="entity-action" target="_blank" rel="noopener noreferrer">
                        <span className="entity-action-icon">↗</span>
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {/* Venue cards */}
              {allVenues.map(venue => (
                <div className="entity-card" key={venue.id}>
                  <div className="entity-card-header">
                    <div className="entity-thumb">
                      {venue.logo || venue.image_url
                        ? <img src={venue.logo || venue.image_url} alt={venue.name} />
                        : '🏛️'}
                    </div>
                    <div>
                      <div className="entity-card-name">{venue.name}</div>
                      <div className="entity-card-type">{venue.venue_type || 'Venue'}</div>
                    </div>
                  </div>
                  <div className="entity-actions">
                    <a href={`/dashboard/venue?id=${venue.id}`} className="entity-action">
                      <span className="entity-action-icon">◎</span>
                      Edit
                    </a>
                    <a href="/dashboard/events" className="entity-action">
                      <span className="entity-action-icon">◷</span>
                      Events
                    </a>
                    <a href="/dashboard/tickets/sales" className="entity-action">
                      <span className="entity-action-icon">🎟</span>
                      Tickets
                    </a>
                    {venue.slug && (
                      <a href={`/venues/${venue.slug}`} className="entity-action" target="_blank" rel="noopener noreferrer">
                        <span className="entity-action-icon">↗</span>
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))}

            </div>
          </>
        )}

      </div>

    </>
  )
}
