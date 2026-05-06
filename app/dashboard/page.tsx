import { createClient } from '@/lib/supabaseServerAuth'
import { redirect } from 'next/navigation'
import AvatarMenu from './AvatarMenu'
import StripeConnectButton from '@/app/components/StripeConnectButton'

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveTheDate = {
  id: string
  title: string
  event_date: string
  organizer: string | null
  event_type: string | null
  location_name: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const isGuest = !user

    const [
      { data: artists },
      { data: venues },
      { data: profile },
    ] = user ? await Promise.all([
      supabase.from('artists').select('id, name, slug, tagline, image_url, avatar_url, artist_type, verified').eq('auth_user_id', user.id),
      supabase.from('venues').select('id, name, slug, venue_type, image_url, logo').eq('auth_user_id', user.id),
      supabase.from('profiles').select('full_name, email, phone_number, role, stripe_account_id, stripe_account_status, avatar_url').eq('id', user.id).maybeSingle(),
    ]) : [{ data: [] }, { data: [] }, { data: null }]

    const [{ data: venueUserLinks }, { data: artistUserLinks }] = user ? await Promise.all([
      supabase.from('venue_users').select('venue_id').eq('user_id', user.id),
      supabase.from('artist_users').select('artist_id').eq('user_id', user.id),
    ]) : [{ data: [] }, { data: [] }]

    const extraVenueIds  = (venueUserLinks  || []).map((r: any) => r.venue_id).filter((id: string)  => !(venues  || []).some((v: any) => v.id === id))
    const extraArtistIds = (artistUserLinks || []).map((r: any) => r.artist_id).filter((id: string) => !(artists || []).some((a: any) => a.id === id))

    const [{ data: extraVenues }, { data: extraArtists }] = await Promise.all([
      extraVenueIds.length  ? supabase.from('venues').select('id, name, slug, venue_type, image_url, logo').in('id', extraVenueIds)                                : Promise.resolve({ data: [] as any[] }),
      extraArtistIds.length ? supabase.from('artists').select('id, name, slug, tagline, image_url, avatar_url, artist_type, verified').in('id', extraArtistIds) : Promise.resolve({ data: [] as any[] }),
    ])

    const allVenues  = [...(venues  || []), ...(extraVenues  || [])]
    const allArtists = [...(artists || []), ...(extraArtists || [])]

    const { data: follows } = user ? await supabase
      .from('follows')
      .select('entity_type, entity_id')
      .eq('follower_id', user.id)
      .in('entity_type', ['artist', 'venue'])
    : { data: [] }

    const followedArtistIds = (follows || []).filter((f: any) => f.entity_type === 'artist').map((f: any) => f.entity_id)
    const followedVenueIds  = (follows || []).filter((f: any) => f.entity_type === 'venue' ).map((f: any) => f.entity_id)

    const [
      { data: followedArtists },
      { data: followedVenues },
      { data: tickets },
      { data: ads },
    ] = await Promise.all([
      followedArtistIds.length ? supabase.from('artists').select('id, name, slug, avatar_url, artist_type').in('id', followedArtistIds) : Promise.resolve({ data: [] as any[] }),
      followedVenueIds.length  ? supabase.from('venues').select('id, name, slug, logo, image_url, venue_type').in('id', followedVenueIds)  : Promise.resolve({ data: [] as any[] }),
      user
        ? supabase.from('my_tickets').select('id, event_title, event_date, event_slug, tier_name, venue_name, status').eq('payment_status', 'paid').gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date', { ascending: true }).limit(1)
        : Promise.resolve({ data: [] as any[] }),
      user
        ? supabase.from('advertisements').select('id, headline, title, status, views, clicks').eq('user_id', user.id).order('created_at', { ascending: false }).limit(2)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const { data: saveDates } = await supabase
      .from('save_the_date')
      .select('id, title, event_date, organizer, event_type, location_name')
      .eq('status', 'approved')
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .order('event_date', { ascending: true })
      .limit(4)

    const firstName = profile?.full_name?.split(' ')[0] || 'There'
    const initials  = profile?.full_name
      ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
      : '?'

    const allFollowed = [
      ...(followedArtists || []).map((a: any) => ({ ...a, kind: 'artist' })),
      ...(followedVenues  || []).map((v: any) => ({ ...v, kind: 'venue'  })),
    ]
    const allPages    = [
      ...allArtists.map((a: any) => ({ ...a, kind: 'artist' })),
      ...allVenues.map( (v: any) => ({ ...v, kind: 'venue'  })),
    ]
    const firstPage   = allPages[0] || null
    const nextTicket  = (tickets || [])[0] || null
    const isCreator   = allPages.length > 0
    const stripeIncomplete = profile?.stripe_account_status === 'pending' || (isCreator && !profile?.stripe_account_id)

    const ticketMonth = nextTicket ? new Date(nextTicket.event_date + 'T12:00:00').toLocaleString('en-US', { month: 'short' }).toUpperCase() : null
    const ticketDay   = nextTicket ? new Date(nextTicket.event_date + 'T12:00:00').getDate() : null

    const TYPE_LABEL: Record<string, string> = {
      Musician: 'Musician', Visual: 'Visual Artist', Performance: 'Performer', Literary: 'Literary Artist',
    }

    const pageEditHref = firstPage
      ? firstPage.kind === 'artist' ? `/dashboard/edit?id=${firstPage.id}` : `/dashboard/venue?id=${firstPage.id}`
      : '/dashboard'

    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --bg:       #eef1f6;
            --surface:  #ffffff;
            --text:     #111827;
            --muted:    #6b7280;
            --hint:     #9ca3af;
            --border:   rgba(0,0,0,0.07);
            --borders:  rgba(0,0,0,0.10);
            --brand:    #C80650;
            --brand-dk: #a0043f;
            --yellow:   #FFCE03;
            --serif:    'Oswald', sans-serif;
            --sans:     'DM Sans', system-ui, sans-serif;
            --radius:   16px;
            --radius-sm:10px;
          }
          html, body {
            background: var(--bg);
            color: var(--text);
            font-family: var(--sans);
            -webkit-font-smoothing: antialiased;
            min-height: 100vh;
          }

          /* ── LAYOUT SHELL ── */
          .shell { display: flex; flex-direction: column; min-height: 100vh; }

          /* ── TOPBAR ── */
          .topbar {
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            padding: 0 20px;
            height: 56px;
            position: sticky;
            top: 0;
            z-index: 100;
            gap: 12px;
          }
          .wordmark {
            font-family: var(--serif);
            font-size: 0.72rem;
            font-weight: 600;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            text-decoration: none;
            color: rgba(0,0,0,0.35);
          }
          .wordmark em { font-style: normal; color: var(--brand); }
          .topbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
          .btn-ghost {
            font-size: 0.75rem;
            font-family: var(--sans);
            font-weight: 600;
            padding: 8px 14px;
            border-radius: 8px;
            border: 1px solid var(--borders);
            text-decoration: none;
            color: var(--text);
            transition: background 0.15s;
          }
          .btn-ghost:hover { background: var(--bg); }
          .btn-primary {
            background: var(--brand);
            color: #fff;
            border: none;
            font-size: 0.75rem;
            font-family: var(--sans);
            font-weight: 600;
            padding: 8px 14px;
            border-radius: 8px;
            text-decoration: none;
            transition: background 0.15s;
          }
          .btn-primary:hover { background: var(--brand-dk); }

          /* ── BANNER ── */
          .banner {
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            padding: 10px 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .banner-pill {
            font-size: 0.55rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            background: #fce8ef;
            color: var(--brand);
            border: 1px solid rgba(200,6,80,0.15);
            padding: 3px 8px;
            border-radius: 6px;
            flex-shrink: 0;
          }
          .banner-text { font-size: 0.75rem; color: var(--muted); }

          /* ── MAIN CONTENT ── */
          .main { flex: 1; padding: 20px 16px 80px; max-width: 700px; margin: 0 auto; width: 100%; }

          /* ── GREETING ── */
          .greeting-wrap {
            background: var(--surface);
            border-radius: var(--radius);
            padding: 20px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 14px;
            border: 1px solid var(--border);
          }
          .greeting-avatar {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: linear-gradient(135deg, #C80650 0%, #ff4d7f 100%);
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--serif);
            font-size: 1.1rem;
            font-weight: 700;
            color: #fff;
            overflow: hidden;
          }
          .greeting-avatar img { width: 100%; height: 100%; object-fit: cover; }
          .greeting-eyebrow {
            font-size: 0.6rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--brand);
            font-weight: 700;
            margin-bottom: 2px;
          }
          .greeting-name {
            font-family: var(--serif);
            font-size: 1.6rem;
            font-weight: 700;
            line-height: 1;
            color: var(--text);
          }
          .greeting-sub { font-size: 0.75rem; color: var(--muted); margin-top: 3px; }

          /* ── SECTION LABEL ── */
          .section-label {
            font-size: 0.6rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: var(--hint);
            padding: 0 4px;
            margin: 20px 0 8px;
          }

          /* ── CARDS ── */
          .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 18px 18px 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            text-decoration: none;
            color: inherit;
            transition: box-shadow 0.18s, transform 0.18s;
            position: relative;
            overflow: hidden;
          }
          .card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.08); transform: translateY(-1px); }
          .card-label {
            font-size: 0.55rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: var(--hint);
          }
          .card-title {
            font-family: var(--serif);
            font-size: 1.15rem;
            font-weight: 600;
            color: var(--text);
            letter-spacing: 0.04em;
            line-height: 1;
          }
          .card-desc { font-size: 0.7rem; color: var(--muted); line-height: 1.45; }
          .card-hr { border: none; border-top: 1px solid var(--border); margin: 4px 0; }
          .card-empty { font-size: 0.7rem; color: var(--hint); font-style: italic; }

          /* card accent strip */
          .card-accent { position: absolute; top: 0; left: 0; width: 3px; height: 100%; background: var(--brand); border-radius: 2px 0 0 2px; }

          /* ── CARD GRID (2-up on mobile) ── */
          .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .card-grid .card-full { grid-column: span 2; }

          /* ── GUEST STATE ── */
          .guest-state { display: flex; flex-direction: column; gap: 6px; }
          .guest-text { font-size: 0.72rem; color: var(--muted); line-height: 1.5; }
          .guest-link {
            font-size: 0.68rem;
            font-weight: 700;
            color: var(--brand);
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 3px;
          }
          .guest-link:hover { text-decoration: underline; }

          /* ── BADGES ── */
          .badge {
            display: inline-flex;
            align-items: center;
            font-size: 0.58rem;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 20px;
            white-space: nowrap;
          }
          .badge-green  { background: #d1fae5; color: #065f46; }
          .badge-brand  { background: #fce8ef; color: var(--brand); }
          .badge-gold   { background: #fef3c7; color: #92400e; }
          .badge-gray   { background: #f3f4f6; color: var(--muted); }
          .badge-blue   { background: #dbeafe; color: #1e40af; }

          /* ── TICKET ROW ── */
          .ticket-row { display: flex; align-items: center; gap: 12px; }
          .ticket-date-col { text-align: center; min-width: 32px; flex-shrink: 0; }
          .ticket-month { font-size: 0.55rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--brand); }
          .ticket-day { font-family: var(--serif); font-size: 1.5rem; font-weight: 700; color: var(--text); line-height: 1; }
          .ticket-event { font-size: 0.72rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .ticket-venue { font-size: 0.62rem; color: var(--muted); margin-top: 2px; }

          /* ── FOLLOW LIST ── */
          .follow-list { display: flex; flex-direction: column; gap: 10px; }
          .follow-row { display: flex; align-items: center; gap: 10px; }
          .follow-av {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: #f3e8e3;
            flex-shrink: 0;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            font-weight: 700;
            color: #8a7a72;
            border: 1.5px solid var(--border);
          }
          .follow-av.venue { border-radius: 8px; }
          .follow-av img { width: 100%; height: 100%; object-fit: cover; }
          .follow-name { font-size: 0.75rem; font-weight: 600; color: var(--text); }
          .follow-type { font-size: 0.55rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--brand); margin-top: 1px; }

          /* ── AD BLOCK ── */
          .ad-block + .ad-block { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
          .ad-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 2px; }
          .ad-name { font-size: 0.7rem; font-weight: 600; color: var(--text); }
          .ad-stat { font-size: 0.62rem; color: var(--muted); }

          /* ── SAVE THE DATE ── */
          .std-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
          .std-btn {
            background: var(--brand);
            color: #fff;
            border: none;
            border-radius: var(--radius-sm);
            padding: 9px 14px;
            font-family: var(--serif);
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            white-space: nowrap;
            letter-spacing: 0.03em;
            flex-shrink: 0;
            display: inline-block;
            transition: background 0.15s;
          }
          .std-btn:hover { background: var(--brand-dk); }
          .std-list { display: flex; flex-direction: column; gap: 12px; }
          .std-item { display: flex; align-items: center; gap: 12px; }
          .std-date-block { text-align: center; min-width: 32px; flex-shrink: 0; }
          .std-title { font-size: 0.75rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .std-sub { font-size: 0.62rem; color: var(--muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

          /* ── SETTINGS LINKS ── */
          .settings-links { display: flex; flex-wrap: wrap; gap: 0; align-items: center; }
          .settings-link { font-size: 0.7rem; color: var(--muted); text-decoration: none; transition: color 0.12s; }
          .settings-link:hover { color: var(--text); }
          .settings-dot { margin: 0 7px; color: var(--borders); }

          /* ── CREATE CTA ── */
          .create-card {
            background: var(--brand);
            border-radius: var(--radius);
            padding: 22px 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            position: relative;
            overflow: hidden;
          }
          .create-card::before {
            content: '';
            position: absolute;
            top: -40px;
            right: -40px;
            width: 140px;
            height: 140px;
            border-radius: 50%;
            background: rgba(255,255,255,0.06);
          }
          .create-card::after {
            content: '';
            position: absolute;
            bottom: -30px;
            right: 20px;
            width: 90px;
            height: 90px;
            border-radius: 50%;
            background: rgba(255,255,255,0.04);
          }
          .create-eyebrow { font-size: 0.58rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: rgba(255,255,255,0.55); margin-bottom: 2px; }
          .create-heading { font-family: var(--serif); font-size: 1.6rem; font-weight: 700; color: #fff; letter-spacing: 0.04em; line-height: 1; }
          .create-sub { font-size: 0.72rem; color: rgba(255,255,255,0.65); margin-top: 4px; line-height: 1.5; }
          .create-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; position: relative; z-index: 1; }
          .create-btn {
            background: var(--yellow);
            border: none;
            border-radius: var(--radius-sm);
            padding: 13px 10px;
            color: #111;
            font-family: var(--serif);
            font-size: 0.82rem;
            font-weight: 600;
            letter-spacing: 0.04em;
            cursor: pointer;
            text-align: center;
            text-transform: uppercase;
            text-decoration: none;
            display: block;
            transition: opacity 0.15s, transform 0.15s;
          }
          .create-btn:hover { opacity: 0.9; transform: translateY(-1px); }
          .create-btn:active { transform: translateY(0); }

          /* ── STAT CHIPS ── */
          .stat-row { display: flex; gap: 8px; flex-wrap: wrap; }
          .stat-chip {
            display: flex;
            align-items: center;
            gap: 5px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 5px 10px;
            font-size: 0.65rem;
            font-weight: 600;
            color: var(--muted);
          }
          .stat-chip strong { color: var(--text); font-size: 0.75rem; }

          /* ── DIVIDER ── */
          .divider { border: none; border-top: 1px solid var(--border); margin: 0; }

          /* ── TABLET+ ── */
          @media (min-width: 640px) {
            .main { padding: 28px 24px 80px; }
            .card-grid { grid-template-columns: 1fr 1fr 1fr; }
            .card-grid .card-full { grid-column: span 3; }
            .card-grid .card-2 { grid-column: span 2; }
            .greeting-name { font-size: 2rem; }
          }
        `}</style>

        <div className="shell">

          {/* ── TOPBAR ── */}
          <header className="topbar">
            <a href="/" className="wordmark"><em>785</em>MAGAZINE</a>
            <div className="topbar-right">
              {isGuest ? (
                <>
                  <a href="/login"  className="btn-ghost">Sign In</a>
                  <a href="/signup" className="btn-primary">Sign Up Free</a>
                </>
              ) : (
                <AvatarMenu
                  initials={initials}
                  fullName={profile?.full_name || 'Your Account'}
                  phoneOrEmail={profile?.phone_number || profile?.email || ''}
                  avatarUrl={profile?.avatar_url || null}
                />
              )}
            </div>
          </header>

          {/* ── BANNER ── */}
          <div className="banner">
            <span className="banner-pill">Notice</span>
            <span className="banner-text">Platform announcements and featured ads will appear here.</span>
          </div>

          {/* ── MAIN ── */}
          <main className="main">

            {/* GREETING */}
            <div className="greeting-wrap">
              <div className="greeting-avatar">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt={profile.full_name || ''} />
                  : (isGuest ? '?' : initials)
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="greeting-eyebrow">Your 785</div>
                <div className="greeting-name">
                  {isGuest ? 'Hey, Topeka' : `Hey, ${firstName}`}
                </div>
                <p className="greeting-sub">
                  {isGuest
                    ? 'Discover local artists, events, and venues.'
                    : 'What would you like to do today?'
                  }
                </p>
              </div>
            </div>

            {/* ── MY ACTIVITY SECTION ── */}
            <div className="section-label">My Activity</div>

            <div className="card-grid">

              {/* MY TICKETS */}
              <a href={isGuest ? '/login' : '/dashboard/tickets'} className="card">
                <div className="card-accent" />
                <div className="card-label">Attending</div>
                <div className="card-title">TICKETS</div>
                {isGuest ? (
                  <div className="guest-state">
                    <p className="guest-text">Sign in to view and purchase tickets</p>
                    <a href="/login" className="guest-link">Sign in →</a>
                  </div>
                ) : (
                  <>
                    <div className="card-desc">Upcoming events</div>
                    <hr className="card-hr" />
                    {nextTicket ? (
                      <div className="ticket-row">
                        <div className="ticket-date-col">
                          <div className="ticket-month">{ticketMonth}</div>
                          <div className="ticket-day">{ticketDay}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="ticket-event">{nextTicket.event_title}</div>
                          <div className="ticket-venue">{nextTicket.venue_name || 'Venue TBA'}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="card-empty">
                        No upcoming — <a href="/events" style={{ color: 'var(--brand)' }}>browse</a>
                      </div>
                    )}
                    {nextTicket && <span className="badge badge-green" style={{ alignSelf: 'flex-start' }}>Confirmed</span>}
                  </>
                )}
              </a>

              {/* FOLLOWING */}
              <a href={isGuest ? '/login' : '/dashboard/following'} className="card">
                <div className="card-label">Artists &amp; Venues</div>
                <div className="card-title">FOLLOWING</div>
                {isGuest ? (
                  <div className="guest-state">
                    <p className="guest-text">Follow artists &amp; get updates</p>
                    <a href="/login" className="guest-link">Sign in →</a>
                  </div>
                ) : (
                  <>
                    <div className="card-desc">{allFollowed.length} followed</div>
                    <hr className="card-hr" />
                    {allFollowed.length > 0 ? (
                      <div className="follow-list">
                        {allFollowed.slice(0, 2).map((f: any) => (
                          <div key={f.id} className="follow-row">
                            <div className={`follow-av${f.kind === 'venue' ? ' venue' : ''}`}>
                              {f.avatar_url || f.logo || f.image_url
                                ? <img src={f.avatar_url || f.logo || f.image_url} alt={f.name} />
                                : f.name?.[0]}
                            </div>
                            <div>
                              <div className="follow-name">{f.name}</div>
                              <div className="follow-type">
                                {f.artist_type || (Array.isArray(f.venue_type) ? f.venue_type[0] : f.venue_type) || (f.kind === 'venue' ? 'Venue' : 'Artist')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="card-empty">
                        None yet — <a href="/artists" style={{ color: 'var(--brand)' }}>discover</a>
                      </div>
                    )}
                  </>
                )}
              </a>

              {/* MY PAGES */}
              <a href={isGuest ? '/login' : pageEditHref} className="card">
                <div className="card-label">Creator</div>
                <div className="card-title">MY PAGES</div>
                {isGuest ? (
                  <div className="guest-state">
                    <p className="guest-text">Manage artist &amp; venue pages</p>
                    <a href="/login" className="guest-link">Sign in →</a>
                  </div>
                ) : (
                  <>
                    <div className="card-desc">Edit &amp; manage</div>
                    <hr className="card-hr" />
                    {firstPage ? (
                      <div className="follow-row">
                        <div className={`follow-av${firstPage.kind === 'venue' ? ' venue' : ''}`}>
                          {firstPage.avatar_url || firstPage.logo || firstPage.image_url
                            ? <img src={firstPage.avatar_url || firstPage.logo || firstPage.image_url} alt={firstPage.name} />
                            : firstPage.name?.[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="follow-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstPage.name}</div>
                          <div className="follow-type">
                            {TYPE_LABEL[firstPage.artist_type] || (Array.isArray(firstPage.venue_type) ? firstPage.venue_type[0] : firstPage.venue_type) || (firstPage.kind === 'venue' ? 'Venue' : 'Artist')}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="card-empty">No pages yet</div>
                    )}
                  </>
                )}
              </a>

              {/* ADVERTISE */}
              <a href={isGuest ? '/login' : '/dashboard/advertise'} className="card">
                <div className="card-label">Publisher</div>
                <div className="card-title">ADVERTISE</div>
                {isGuest ? (
                  <div className="guest-state">
                    <p className="guest-text">Place ads on 785 Magazine</p>
                    <a href="/login" className="guest-link">Sign in →</a>
                  </div>
                ) : (
                  <>
                    <div className="card-desc">Campaigns &amp; stats</div>
                    <hr className="card-hr" />
                    {(ads || []).length > 0 ? (
                      (ads || []).map((ad: any) => (
                        <div key={ad.id} className="ad-block">
                          <div className="ad-row">
                            <div className="ad-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.headline || ad.title || 'Untitled Ad'}</div>
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
                  </>
                )}
              </a>

              {/* SETTINGS */}
              <div className="card card-2" style={{ cursor: 'default' }}>
                <div className="card-label">Account</div>
                <div className="card-title">SETTINGS</div>
                {isGuest ? (
                  <div className="guest-state">
                    <p className="guest-text">Sign in to manage your account and notifications</p>
                    <a href="/login" className="guest-link">Sign in →</a>
                  </div>
                ) : (
                  <>
                    <hr className="card-hr" />
                    {isCreator && (
                      <StripeConnectButton
                        accountStatus={profile?.stripe_account_status ?? null}
                        returnPath="/dashboard"
                      />
                    )}
                    <div className="settings-links">
                      <a href="/dashboard/settings"               className="settings-link">Edit Profile</a>
                      <span className="settings-dot">·</span>
                      <a href="/dashboard/settings#notifications" className="settings-link">Notifications</a>
                      <span className="settings-dot">·</span>
                      <a href="/api/auth/signout" className="settings-link" style={{ color: 'var(--brand)' }}>Sign Out</a>
                    </div>
                  </>
                )}
              </div>

              {/* SAVE THE DATE — full width */}
              <a href="/save-the-date" className="card card-full" style={{ gap: 12 }}>
                <div className="std-top">
                  <div>
                    <div className="card-label">Community Calendar</div>
                    <div className="card-title">SAVE THE DATE</div>
                    <div className="card-desc" style={{ marginTop: 4 }}>Claim your date before details are finalized</div>
                  </div>
                  <a href="/save-the-date/new" className="std-btn" onClick={(e: any) => e.stopPropagation()}>
                    + Claim a Date
                  </a>
                </div>

                {(saveDates || []).length > 0 && (
                  <>
                    <hr className="card-hr" />
                    <div className="std-list">
                      {(saveDates as SaveTheDate[]).map((sd) => {
                        const d   = new Date(sd.event_date + 'T12:00:00')
                        const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
                        const day = d.getDate()
                        return (
                          <div key={sd.id} className="std-item">
                            <div className="std-date-block">
                              <div className="ticket-month">{mon}</div>
                              <div className="ticket-day">{day}</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="std-title">{sd.title}</div>
                              {sd.location_name && <div className="std-sub">{sd.location_name}</div>}
                            </div>
                            {sd.event_type && (
                              <span className="badge badge-gray">{sd.event_type}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </a>

            </div>{/* /card-grid */}

            {/* ── CREATE CTA ── */}
            <div className="section-label" style={{ marginTop: 24 }}>Publish</div>
            <div className="create-card">
              <div>
                <div className="create-eyebrow">Publish</div>
                <div className="create-heading">CREATE</div>
                <div className="create-sub">
                  {isGuest
                    ? 'Add your event, artist page or venue — free to start'
                    : 'Add something new to 785 Magazine'
                  }
                </div>
              </div>
              <div className="create-btns">
                <a href="https://seveneightfive.fillout.com/add-event"   target="_blank" rel="noopener noreferrer" className="create-btn">Event</a>
                <a href={isGuest ? '/login?next=/dashboard/announcements/new' : '/dashboard/announcements/new'} className="create-btn">Announcement</a>
                <a href="https://seveneightfive.fillout.com/new-artist"  target="_blank" rel="noopener noreferrer" className="create-btn">Artist Page</a>
                <a href="https://seveneightfive.fillout.com/add-venue"   target="_blank" rel="noopener noreferrer" className="create-btn">Venue Page</a>
              </div>
            </div>

          </main>
        </div>
      </>
    )
  } catch (err) {
    console.error('[dashboard] server error:', err)
    throw err
  }
}
