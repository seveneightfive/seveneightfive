import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabaseServerAuth'
import LogoutButton from './LogoutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: artist }, { data: venue }] = await Promise.all([
    supabase
      .from('artists')
      .select('id, name, slug, tagline, image_url, avatar_url, artist_type, verified')
      .eq('auth_user_id', user.id)
      .single(),
    supabase
      .from('venues')
      .select('id, name, slug, venue_type')
      .eq('auth_user_id', user.id)
      .single(),
  ])

  if (!artist) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { min-height: 100vh; background: #1a1814; color: #fff; font-family: 'DM Sans', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; padding: 24px; -webkit-font-smoothing: antialiased; }
          .msg { text-align: center; max-width: 380px; }
          .icon { font-size: 2.5rem; margin-bottom: 16px; }
          h1 { font-family: 'Oswald', sans-serif; font-size: 1.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 10px; }
          p { font-size: 0.9rem; font-weight: 300; color: rgba(255,255,255,0.5); line-height: 1.7; }
          a { color: #C80650; }
        `}</style>
        <div className="msg">
          <div className="icon">⚠</div>
          <h1>No Artist Profile Found</h1>
          <p>Your email isn't linked to an artist profile yet. Contact <a href="mailto:seveneightfive@gmail.com">seveneightfive@gmail.com</a> to get set up.</p>
        </div>
      </>
    )
  }

  const TYPE_LABEL: Record<string, string> = {
    Musician: 'Musician', Visual: 'Visual Artist', Performance: 'Performer', Literary: 'Literary Artist',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #c0bab3;
          --white: #fff; --off: #f7f6f4; --border: #ece8e2;
          --accent: #C80650;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .wordmark { font-family: var(--serif); font-size: 0.72rem; font-weight: 400; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.4); text-decoration: none; }
        .wordmark em { font-style: normal; color: var(--accent); font-weight: 600; }

        .content { max-width: 640px; margin: 0 auto; padding: 40px 24px 80px; }

        /* Entity header — name + type above each section */
        .entity-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
        .entity-header-left { display: flex; flex-direction: column; gap: 5px; }
        .entity-type { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); }
        .entity-name { font-family: var(--serif); font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 700; text-transform: uppercase; line-height: 1; letter-spacing: 0.02em; }
        /* Primary card */
        .dashboard-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 18px 20px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; gap: 16px; text-decoration: none; transition: background 0.15s, border-color 0.15s; }
        .dashboard-card:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.18); }
        .dashboard-card-left { display: flex; align-items: center; gap: 14px; }
        .dashboard-card-icon { width: 38px; height: 38px; border-radius: 8px; background: rgba(200,6,80,0.12); display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
        .dashboard-card-label { font-family: var(--serif); font-size: 0.9rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--white); }
        .dashboard-card-sub { font-size: 0.76rem; color: rgba(255,255,255,0.3); margin-top: 2px; }
        .dashboard-card-arrow { color: rgba(255,255,255,0.2); font-size: 1rem; transition: transform 0.15s; }
        .dashboard-card:hover .dashboard-card-arrow { transform: translateX(3px); color: rgba(255,255,255,0.5); }

        /* Sub-card — secondary actions */
        .sub-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 13px 18px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; gap: 16px; text-decoration: none; transition: background 0.15s, border-color 0.15s; }
        .sub-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
        .sub-card-label { font-family: var(--serif); font-size: 0.78rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.5); }
        .sub-card-sub { font-size: 0.72rem; color: rgba(255,255,255,0.2); margin-top: 1px; }
        .sub-card-arrow { color: rgba(255,255,255,0.15); font-size: 0.85rem; transition: transform 0.15s; }
        .sub-card:hover .sub-card-arrow { transform: translateX(3px); color: rgba(255,255,255,0.4); }

        /* Section divider */
        .section-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 32px 0; }

        /* Events section label */
        .section-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.2); margin-bottom: 14px; }
      `}</style>

      <div className="topbar">
        <a href="/" className="wordmark">Your <em>seveneightfive</em> Dashboard</a>
        <LogoutButton />
      </div>

      <div className="content">

        {/* ── ARTIST ── */}
        <div className="entity-header">
          <div className="entity-header-left">
            <div className="entity-type">{TYPE_LABEL[artist.artist_type || ''] || 'Artist'}</div>
            <div className="entity-name">{artist.name}</div>
          </div>
        </div>

        <a href="/dashboard/edit" className="dashboard-card">
          <div className="dashboard-card-left">
            <div className="dashboard-card-icon">◉</div>
            <div>
              <div className="dashboard-card-label">Edit Your Artist Profile</div>
              <div className="dashboard-card-sub">Bio, images, links, media, portfolio</div>
            </div>
          </div>
          <span className="dashboard-card-arrow">→</span>
        </a>

        <a href="/dashboard/appearances" className="sub-card">
          <div>
            <div className="sub-card-label">★ Appearances</div>
            <div className="sub-card-sub">Events you're featured in — add yourself to others</div>
          </div>
          <span className="sub-card-arrow">→</span>
        </a>

        {artist.slug && (
          <a href={`/artists/${artist.slug}`} className="sub-card" target="_blank" rel="noopener noreferrer">
            <div>
              <div className="sub-card-label">↗ View Public Artist Page</div>
              <div className="sub-card-sub">785mag.com/artists/{artist.slug}</div>
            </div>
            <span className="sub-card-arrow">↗</span>
          </a>
        )}

        {/* ── VENUE ── */}
        {venue && (
          <>
            <div className="section-divider" />

            <div className="entity-header">
              <div className="entity-header-left">
                <div className="entity-type">{venue.venue_type || 'Venue'}</div>
                <div className="entity-name">{venue.name}</div>
              </div>
            </div>

            <a href="/dashboard/venue" className="dashboard-card">
              <div className="dashboard-card-left">
                <div className="dashboard-card-icon">◎</div>
                <div>
                  <div className="dashboard-card-label">Edit Your Venue Profile</div>
                  <div className="dashboard-card-sub">Address, type, image, website</div>
                </div>
              </div>
              <span className="dashboard-card-arrow">→</span>
            </a>

            <a href="/dashboard/events" className="sub-card">
              <div>
                <div className="sub-card-label">◷ Happenings</div>
                <div className="sub-card-sub">Events at your venue</div>
              </div>
              <span className="sub-card-arrow">→</span>
            </a>

            {venue.slug && (
              <a href={`/venues/${venue.slug}`} className="sub-card" target="_blank" rel="noopener noreferrer">
                <div>
                  <div className="sub-card-label">↗ View Public Venue Page</div>
                  <div className="sub-card-sub">785mag.com/venues/{venue.slug}</div>
                </div>
                <span className="sub-card-arrow">↗</span>
              </a>
            )}
          </>
        )}

        {/* ── EVENTS ── */}
        <div className="section-divider" />
        <div className="section-label">Events</div>

        <a href="/dashboard/events" className="dashboard-card">
          <div className="dashboard-card-left">
            <div className="dashboard-card-icon">◷</div>
            <div>
              <div className="dashboard-card-label">My Events</div>
              <div className="dashboard-card-sub">Add and edit events you've created</div>
            </div>
          </div>
          <span className="dashboard-card-arrow">→</span>
        </a>

      </div>
    </>
  )
}
