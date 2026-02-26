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
      .select('id, name, slug')
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

  const heroImage = artist.image_url || artist.avatar_url
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

        .hero-strip {
          position: relative; height: 220px; overflow: hidden;
          background: #2a2620;
        }
        .hero-strip img { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; opacity: 0.5; }
        .hero-strip-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 0%, rgba(26,24,20,0.9) 100%); }
        .hero-strip-body { position: absolute; bottom: 24px; left: 24px; right: 24px; }
        .hero-type { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; }
        .hero-name { font-family: var(--serif); font-size: clamp(1.8rem, 6vw, 3rem); font-weight: 700; text-transform: uppercase; line-height: 0.95; }

        .content { max-width: 640px; margin: 0 auto; padding: 32px 24px 80px; }

        .dashboard-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 16px; text-decoration: none; transition: background 0.15s, border-color 0.15s; }
        .dashboard-card:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.16); }
        .dashboard-card-left { display: flex; align-items: center; gap: 14px; }
        .dashboard-card-icon { width: 40px; height: 40px; border-radius: 8px; background: rgba(200,6,80,0.12); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
        .dashboard-card-label { font-family: var(--serif); font-size: 0.95rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--white); }
        .dashboard-card-sub { font-size: 0.78rem; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .dashboard-card-arrow { color: rgba(255,255,255,0.25); font-size: 1rem; transition: transform 0.15s; }
        .dashboard-card:hover .dashboard-card-arrow { transform: translateX(3px); color: rgba(255,255,255,0.5); }

        .section-label { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin: 28px 0 12px; }

        .view-link { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: rgba(255,255,255,0.35); text-decoration: none; padding: 12px 0; transition: color 0.15s; }
        .view-link:hover { color: rgba(255,255,255,0.7); }
      `}</style>

      <div className="topbar">
        <a href="/" className="wordmark">Your <em>seveneightfive</em> Dashboard</a>
        <LogoutButton />
      </div>

      <div className="hero-strip">
        {heroImage && <img src={heroImage} alt={artist.name} />}
        <div className="hero-strip-scrim" />
        <div className="hero-strip-body">
          <div className="hero-type">{TYPE_LABEL[artist.artist_type || ''] || 'Artist'}</div>
          <div className="hero-name">{artist.name}</div>
        </div>
      </div>

      <div className="content">
        <div className="section-label">Edit Your Profile</div>

        <a href="/dashboard/edit#profile" className="dashboard-card">
          <div className="dashboard-card-left">
            <div className="dashboard-card-icon">◉</div>
            <div>
              <div className="dashboard-card-label">Profile & Bio</div>
              <div className="dashboard-card-sub">Name, tagline, bio, location, awards</div>
            </div>
          </div>
          <span className="dashboard-card-arrow">→</span>
        </a>

        <a href="/dashboard/edit#images" className="dashboard-card">
          <div className="dashboard-card-left">
            <div className="dashboard-card-icon">◈</div>
            <div>
              <div className="dashboard-card-label">Images</div>
              <div className="dashboard-card-sub">Hero photo and avatar</div>
            </div>
          </div>
          <span className="dashboard-card-arrow">→</span>
        </a>

        <a href="/dashboard/edit#links" className="dashboard-card">
          <div className="dashboard-card-left">
            <div className="dashboard-card-icon">↗</div>
            <div>
              <div className="dashboard-card-label">Links & Social</div>
              <div className="dashboard-card-sub">Website, Instagram, Facebook, email</div>
            </div>
          </div>
          <span className="dashboard-card-arrow">→</span>
        </a>

        <a href="/dashboard/edit#media" className="dashboard-card">
          <div className="dashboard-card-left">
            <div className="dashboard-card-icon">♫</div>
            <div>
              <div className="dashboard-card-label">Music & Media</div>
              <div className="dashboard-card-sub">Audio, video, Spotify, genres</div>
            </div>
          </div>
          <span className="dashboard-card-arrow">→</span>
        </a>

        {artist.artist_type === 'Visual' && (
          <a href="/dashboard/edit#visual" className="dashboard-card">
            <div className="dashboard-card-left">
              <div className="dashboard-card-icon">◇</div>
              <div>
                <div className="dashboard-card-label">Visual Work</div>
                <div className="dashboard-card-sub">Mediums and portfolio image</div>
              </div>
            </div>
            <span className="dashboard-card-arrow">→</span>
          </a>
        )}

        {venue && (
          <>
            <div className="section-label">Your Venue</div>
            <a href="/dashboard/venue" className="dashboard-card">
              <div className="dashboard-card-left">
                <div className="dashboard-card-icon">◎</div>
                <div>
                  <div className="dashboard-card-label">{venue.name}</div>
                  <div className="dashboard-card-sub">Edit venue details, address, image</div>
                </div>
              </div>
              <span className="dashboard-card-arrow">→</span>
            </a>
          </>
        )}

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

        {artist && (
          <a href="/dashboard/appearances" className="dashboard-card">
            <div className="dashboard-card-left">
              <div className="dashboard-card-icon">★</div>
              <div>
                <div className="dashboard-card-label">Appearances</div>
                <div className="dashboard-card-sub">Events you're featured in, add yourself to others</div>
              </div>
            </div>
            <span className="dashboard-card-arrow">→</span>
          </a>
        )}

        <div className="section-label">Your Public Page</div>
        {artist.slug && (
          <a href={`/artists/${artist.slug}`} className="view-link" target="_blank" rel="noopener noreferrer">
            View public profile ↗
          </a>
        )}
      </div>
    </>
  )
}
