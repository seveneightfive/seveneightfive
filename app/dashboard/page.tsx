import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabaseServerAuth'
import AvatarMenu from './AvatarMenu'

export default async function DashboardPage() {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: artists }, { data: venues }, { data: profile }] = await Promise.all([
    supabase.from('artists').select('id, name, slug, tagline, image_url, avatar_url, artist_type, verified').eq('auth_user_id', user!.id),
    supabase.from('venues').select('id, name, slug, venue_type, image_url, logo').eq('auth_user_id', user!.id),
    supabase.from('profiles').select('full_name, email, phone_number, role, stripe_account_id, stripe_account_status, avatar_url').eq('id', user!.id).maybeSingle(),
  ])

  const [{ data: venueUserLinks }, { data: artistUserLinks }] = await Promise.all([
    supabase.from('venue_users').select('venue_id').eq('user_id', user!.id),
    supabase.from('artist_users').select('artist_id').eq('user_id', user!.id),
  ])

  const extraVenueIds = (venueUserLinks || []).map((r: any) => r.venue_id).filter((id: string) => !(venues || []).some((v: any) => v.id === id))
  const extraArtistIds = (artistUserLinks || []).map((r: any) => r.artist_id).filter((id: string) => !(artists || []).some((a: any) => a.id === id))

  const [{ data: extraVenues }, { data: extraArtists }] = await Promise.all([
    extraVenueIds.length ? supabase.from('venues').select('id, name, slug, venue_type, image_url, logo').in('id', extraVenueIds) : Promise.resolve({ data: [] as any[] }),
    extraArtistIds.length ? supabase.from('artists').select('id, name, slug, tagline, image_url, avatar_url, artist_type, verified').in('id', extraArtistIds) : Promise.resolve({ data: [] as any[] }),
  ])

  const allVenues = [...(venues || []), ...(extraVenues || [])]
  const allArtists = [...(artists || []), ...(extraArtists || [])]

  const { data: follows } = await supabase
    .from('follows')
    .select('entity_type, entity_id')
    .eq('follower_id', user!.id)
    .in('entity_type', ['artist', 'venue'])

  const followedArtistIds = (follows || []).filter((f: any) => f.entity_type === 'artist').map((f: any) => f.entity_id)
  const followedVenueIds = (follows || []).filter((f: any) => f.entity_type === 'venue').map((f: any) => f.entity_id)

  const [{ data: followedArtists }, { data: followedVenues }, { data: tickets }, { data: ads }] = await Promise.all([
    followedArtistIds.length ? supabase.from('artists').select('id, name, slug, avatar_url, artist_type').in('id', followedArtistIds) : Promise.resolve({ data: [] as any[] }),
    followedVenueIds.length ? supabase.from('venues').select('id, name, slug, logo, image_url, venue_type').in('id', followedVenueIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from('my_tickets').select('id, event_title, event_date, event_slug, tier_name, venue_name, status').eq('payment_status', 'paid').gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date', { ascending: true }).limit(1),
    supabase.from('advertisements').select('id, headline, title, status, views, clicks').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(2),
  ])

  const firstName = profile?.full_name?.split(' ')[0] || 'There'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const allFollowed = [...(followedArtists || []).map((a: any) => ({ ...a, kind: 'artist' })), ...(followedVenues || []).map((v: any) => ({ ...v, kind: 'venue' }))]
  const allPages = [...allArtists.map((a: any) => ({ ...a, kind: 'artist' })), ...allVenues.map((v: any) => ({ ...v, kind: 'venue' }))]
  const firstPage = allPages[0] || null
  const nextTicket = (tickets || [])[0] || null
  const isCreator = allPages.length > 0
  const stripeIncomplete = profile?.stripe_account_status === 'pending' || (isCreator && !profile?.stripe_account_id)

  const ticketMonth = nextTicket ? new Date(nextTicket.event_date + 'T12:00:00').toLocaleString('en-US', { month: 'short' }).toUpperCase() : null
  const ticketDay = nextTicket ? new Date(nextTicket.event_date + 'T12:00:00').getDate() : null

  const TYPE_LABEL: Record<string, string> = {
    Musician: 'Musician', Visual: 'Visual Artist', Performance: 'Performer', Literary: 'Literary Artist',
  }

  const pageEditHref = firstPage
    ? firstPage.kind === 'artist'
      ? `/dashboard/edit?id=${firstPage.id}`
      : `/dashboard/venue?id=${firstPage.id}`
    : '/dashboard'

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg:     #f5f4f1;
          --white:  #ffffff;
          --text:   #1a1a1a;
          --muted:  #6b6b6b;
          --hint:   #aaaaaa;
          --border: rgba(0,0,0,0.08);
          --borders:rgba(0,0,0,0.12);
          --brand:  #C80650;
          --yellow: #FFCE03;
          --serif:  'Oswald', sans-serif;
          --sans:   'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--bg); color: var(--text); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

        /* ── TOPBAR ── */
        .topbar { background: var(--white); border-bottom: 0.5px solid var(--borders); display: flex; align-items: center; padding: 0 20px; height: 52px; position: sticky; top: 0; z-index: 100; }
        .wordmark { font-family: var(--serif); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; text-decoration: none; color: rgba(0,0,0,0.35); }
        .wordmark em { font-style: normal; color: var(--brand); }

        /* ── BANNER ── */
        .banner { background: var(--white); border-bottom: 0.5px solid var(--borders); padding: 12px 20px; display: flex; align-items: center; gap: 10px; min-height: 44px; }
        .banner-pill { font-size: 0.56rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; background: var(--bg); color: var(--hint); border: 0.5px solid var(--borders); padding: 3px 8px; border-radius: 4px; flex-shrink: 0; }
        .banner-text { font-size: 0.75rem; color: var(--hint); font-style: italic; }

        /* ── GREETING ── */
        .greeting { padding: 24px 20px 0; }
        .greeting-eyebrow { font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brand); font-weight: 700; margin-bottom: 4px; }
        .greeting-name { font-family: var(--serif); font-size: 2.1rem; font-weight: 700; line-height: 1; color: var(--text); margin-bottom: 4px; }
        .greeting-sub { font-size: 0.82rem; color: var(--muted); }
        .hr { border: none; border-top: 0.5px solid var(--borders); margin: 20px 20px; }

        /* ── GRID ── */
        .grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; padding: 0 20px 60px; }
        .col2 { grid-column: span 2; }
        .col3 { grid-column: span 3; }

        /* ── CARDS ── */
        .card { background: var(--white); border: 0.5px solid var(--borders); border-radius: 14px; padding: 18px 16px; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: box-shadow 0.15s; text-decoration: none; color: inherit; }
        .card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
        .card-label { font-size: 0.56rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--hint); margin-bottom: 2px; }
        .card-title { font-family: var(--serif); font-size: 1.25rem; font-weight: 600; color: var(--text); letter-spacing: 0.04em; line-height: 1; }
        .card-desc { font-size: 0.68rem; color: var(--muted); line-height: 1.4; }
        .card-hr { border: none; border-top: 0.5px solid var(--border); margin: 6px 0; }
        .card-empty { font-size: 0.68rem; color: var(--hint); font-style: italic; }

        /* ── BADGES ── */
        .badge { display: inline-flex; align-items: center; font-size: 0.62rem; font-weight: 700; padding: 3px 8px; border-radius: 10px; }
        .badge-green { background: #eafaf1; color: #1e7e34; }
        .badge-brand { background: #fce8ef; color: var(--brand); }
        .badge-gold  { background: #fef9e7; color: #b8860b; }

        /* ── TICKET ROW ── */
        .ticket-row { display: flex; align-items: center; gap: 10px; }
        .ticket-date { text-align: center; min-width: 28px; flex-shrink: 0; }
        .ticket-month { font-size: 0.56rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--brand); }
        .ticket-day { font-family: var(--serif); font-size: 1.4rem; font-weight: 700; color: var(--text); line-height: 1; }
        .ticket-event { font-size: 0.68rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ticket-venue { font-size: 0.62rem; color: var(--muted); margin-top: 2px; }

        /* ── FOLLOW LIST ── */
        .follow-list { display: flex; flex-direction: column; gap: 10px; }
        .follow-row { display: flex; align-items: center; gap: 10px; }
        .follow-av { width: 32px; height: 32px; border-radius: 50%; background: #e8ddd6; flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700; color: #8a7a72; }
        .follow-av.venue { border-radius: 8px; }
        .follow-av img { width: 100%; height: 100%; object-fit: cover; }
        .follow-name { font-size: 0.75rem; font-weight: 600; color: var(--text); }
        .follow-type { font-size: 0.56rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--brand); margin-top: 1px; }

        /* ── AD BLOCK ── */
        .ad-block + .ad-block { margin-top: 8px; padding-top: 8px; border-top: 0.5px solid var(--border); }
        .ad-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
        .ad-name { font-size: 0.68rem; font-weight: 600; color: var(--text); }
        .ad-stat { font-size: 0.62rem; color: var(--muted); }

        /* ── SETTINGS CARD ── */
        .alert-strip { background: #fce8ef; border: 0.5px solid rgba(200,6,80,0.18); border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 8px; }
        .alert-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand); flex-shrink: 0; }
        .alert-msg { font-size: 0.62rem; color: var(--brand); font-weight: 600; }
        .settings-links { display: flex; flex-wrap: wrap; gap: 0; margin-top: 4px; align-items: center; }
        .settings-link { font-size: 0.68rem; color: var(--muted); text-decoration: none; }
        .settings-link:hover { color: var(--text); }
        .settings-dot { margin: 0 6px; color: var(--borders); font-size: 0.68rem; }

        /* ── CREATE CTA ── */
        .create-card { background: var(--brand); border: 0.5px solid var(--brand); border-radius: 14px; padding: 20px 24px; display: flex; flex-direction: row; align-items: center; gap: 0; }
        .create-left { flex-shrink: 0; margin-right: 24px; }
        .create-eyebrow { font-size: 0.56rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.55); margin-bottom: 4px; }
        .create-heading { font-family: var(--serif); font-size: 1.4rem; font-weight: 600; color: #fff; letter-spacing: 0.04em; line-height: 1; }
        .create-sub { font-size: 0.68rem; color: rgba(255,255,255,0.65); margin-top: 4px; max-width: 160px; line-height: 1.4; }
        .create-rule { width: 0.5px; background: rgba(255,255,255,0.2); align-self: stretch; margin-right: 24px; flex-shrink: 0; }
        .create-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; flex: 1; }
        .create-btn { background: var(--yellow); border: none; border-radius: 8px; padding: 12px 10px; color: var(--text); font-family: var(--serif); font-size: 0.82rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; text-align: center; text-transform: uppercase; text-decoration: none; display: block; transition: opacity 0.15s; }
        .create-btn:hover { opacity: 0.88; }

        /* ── RESPONSIVE ── */
        @media (max-width: 640px) {
          .grid { grid-template-columns: 1fr; gap: 10px; padding: 0 16px 60px; }
          .col2, .col3 { grid-column: span 1; }
          .create-card { flex-direction: column; align-items: flex-start; gap: 16px; }
          .create-rule { display: none; }
          .create-left { margin-right: 0; }
          .create-sub { max-width: 100%; }
        }
      `}</style>

      {/* ── TOPBAR ── */}
      <header className="topbar">
        <a href="/" className="wordmark"><em>785</em>MAGAZINE</a>
        <div style={{ marginLeft: 'auto' }}>
          <AvatarMenu
            initials={initials}
            fullName={profile?.full_name || 'Your Account'}
            phoneOrEmail={profile?.phone_number || profile?.email || ''}
            avatarUrl={profile?.avatar_url || null}
          />
        </div>
      </header>

      {/* ── BANNER ── */}
      <div className="banner">
        <span className="banner-pill">Notice</span>
        <span className="banner-text">Platform announcements and featured ads will appear here.</span>
      </div>

      {/* ── GREETING ── */}
      <div className="greeting">
        <div className="greeting-eyebrow">Your 785</div>
        <h1 className="greeting-name">Hey, {firstName}</h1>
        <p className="greeting-sub">What would you like to do today?</p>
      </div>
      <hr className="hr" />

      {/* ── GRID ── */}
      <div className="grid">

        {/* MY TICKETS — 1 col */}
        <a href="/dashboard/tickets" className="card">
          <div className="card-label">Attending</div>
          <div className="card-title">MY TICKETS</div>
          <div className="card-desc">Events you're going to</div>
          <hr className="card-hr" />
          {nextTicket ? (
            <div className="ticket-row">
              <div className="ticket-date">
                <div className="ticket-month">{ticketMonth}</div>
                <div className="ticket-day">{ticketDay}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ticket-event">{nextTicket.event_title}</div>
                <div className="ticket-venue">{nextTicket.venue_name || 'Venue TBA'}</div>
              </div>
              <span className="badge badge-green">Confirmed</span>
            </div>
          ) : (
            <div className="card-empty">No upcoming tickets</div>
          )}
        </a>

        {/* FOLLOWING — 2 col */}
        <a href="/artists" className="card col2">
          <div className="card-label">Artists &amp; Venues</div>
          <div className="card-title">FOLLOWING</div>
          <div className="card-desc">{allFollowed.length} followed</div>
          <hr className="card-hr" />
          {allFollowed.length > 0 ? (
            <div className="follow-list">
              {allFollowed.slice(0, 3).map((f: any) => (
                <div key={f.id} className="follow-row">
                  <div className={`follow-av${f.kind === 'venue' ? ' venue' : ''}`}>
                    {f.avatar_url || f.logo || f.image_url
                      ? <img src={f.avatar_url || f.logo || f.image_url} alt={f.name} />
                      : f.name?.[0]}
                  </div>
                  <div>
                    <div className="follow-name">{f.name}</div>
                    <div className="follow-type">{f.artist_type || f.venue_type || (f.kind === 'venue' ? 'Venue' : 'Artist')}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-empty">Not following anyone yet — <a href="/artists" style={{ color: 'var(--brand)' }}>discover artists</a></div>
          )}
        </a>

        {/* MY PAGES — 1 col */}
        <a href={pageEditHref} className="card">
          <div className="card-label">Creator</div>
          <div className="card-title">MY PAGES</div>
          <div className="card-desc">Edit, events, announcements &amp; ticket sales</div>
          <hr className="card-hr" />
          {firstPage ? (
            <div className="follow-row">
              <div className={`follow-av${firstPage.kind === 'venue' ? ' venue' : ''}`}>
                {firstPage.avatar_url || firstPage.logo || firstPage.image_url
                  ? <img src={firstPage.avatar_url || firstPage.logo || firstPage.image_url} alt={firstPage.name} />
                  : firstPage.name?.[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="follow-name">{firstPage.name}</div>
                <div className="follow-type">{TYPE_LABEL[firstPage.artist_type] || firstPage.venue_type || (firstPage.kind === 'venue' ? 'Venue' : 'Artist')}</div>
              </div>
              {!firstPage.tagline && (
                <span className="badge badge-brand">No tagline</span>
              )}
            </div>
          ) : (
            <div className="card-empty">No pages yet</div>
          )}
        </a>

        {/* ADVERTISE — 1 col */}
        <a href="/dashboard/advertise" className="card">
          <div className="card-label">Publisher &amp; Buyer</div>
          <div className="card-title">ADVERTISE</div>
          <div className="card-desc">Manage your ad campaigns and view stats</div>
          <hr className="card-hr" />
          {(ads || []).length > 0 ? (
            (ads || []).map((ad: any) => (
              <div key={ad.id} className="ad-block">
                <div className="ad-row">
                  <div className="ad-name">{ad.headline || ad.title || 'Untitled Ad'}</div>
                  <span className={`badge ${ad.status === 'active' ? 'badge-green' : 'badge-gold'}`}>
                    {ad.status === 'active' ? 'Active' : 'Ended'}
                  </span>
                </div>
                <div className="ad-stat">{ad.views || 0} views · {ad.clicks || 0} clicks</div>
              </div>
            ))
          ) : (
            <div className="card-empty">No ads yet</div>
          )}
        </a>

        {/* SETTINGS — 1 col */}
        <div className="card">
          <div className="card-label">Account</div>
          <div className="card-title">SETTINGS + NOTIFICATIONS</div>
          <hr className="card-hr" />
          {stripeIncomplete && isCreator && (
            <div className="alert-strip">
              <div className="alert-dot" />
              <div className="alert-msg">Stripe setup incomplete</div>
            </div>
          )}
          <div className="settings-links">
            <a href="/dashboard/settings" className="settings-link">Edit Profile</a>
            <span className="settings-dot">·</span>
            <a href="/dashboard/settings#notifications" className="settings-link">Notifications</a>
            <span className="settings-dot">·</span>
            <a href="/api/auth/signout" className="settings-link" style={{ color: 'var(--brand)' }}>Sign Out</a>
          </div>
        </div>

        {/* CREATE CTA — full width */}
        <div className="create-card col3">
          <div className="create-left">
            <div className="create-eyebrow">Publish</div>
            <div className="create-heading">CREATE</div>
            <div className="create-sub">Add something new to 785 Magazine</div>
          </div>
          <div className="create-rule" />
          <div className="create-btns">
            <a href="https://seveneightfive.fillout.com/add-event" target="_blank" rel="noopener noreferrer" className="create-btn">Event</a>
            <a href="/dashboard/announcements/new" className="create-btn">Announcement</a>
            <a href="https://seveneightfive.fillout.com/new-artist" target="_blank" rel="noopener noreferrer" className="create-btn">Artist Page</a>
            <a href="https://seveneightfive.fillout.com/add-venue" target="_blank" rel="noopener noreferrer" className="create-btn">Venue Page</a>
          </div>
        </div>

      </div>
    </>
  )
  } catch (err) {
    console.error('[dashboard] server error:', err)
    throw err
  }
}
