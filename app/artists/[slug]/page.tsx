import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// ─── Types ───────────────────────────────────────────────────────────────────

type MusicianProfile = {
  musical_genres: string[] | null
  audio_file_url: string | null
  audio_title: string | null
  video_url: string | null
  video_title: string | null
  artistvideoabout: string | null
  artist_spotify: string | null
  artist_youtube: string | null
  purchase_link: string | null
}

type VisualProfile = {
  visual_mediums: string[] | null
  works: string | null
}

type Artist = {
  id: string
  name: string
  slug: string
  bio: string | null
  tagline: string | null
  image_url: string | null
  avatar_url: string | null
  artist_type: string | null
  verified: boolean
  location_city: string | null
  location_state: string | null
  birth_place: string | null
  awards: string | null
  artist_website: string | null
  social_facebook: string | null
  artist_email: string | null
  given_name: string | null
  family_name: string | null
  url: string | null
  same_as: string[] | null
  musician_profile: MusicianProfile | null
  visual_profile: VisualProfile | null
}

type Event = {
  id: string
  slug: string | null
  title: string
  event_date: string | null
  event_start_time: string | null
  ticket_url: string | null
  image_url: string | null
  ticket_price: number | null
  venue: { name: string; neighborhood: string | null } | null
}

type PortfolioImage = {
  id: string
  image_url: string
  caption: string | null
  display_order: number
}

// ─── SEO ─────────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const artist = await getArtist(slug)
  if (!artist) return { title: 'Artist Not Found' }
  const description = artist.bio || artist.tagline || `${artist.name} — Kansas artist on The 785`
  const image = artist.image_url || artist.avatar_url
  return {
    title: `${artist.name} | The 785`,
    description,
    openGraph: { title: artist.name, description, images: image ? [{ url: image }] : [], type: 'profile' },
    twitter: { card: 'summary_large_image', title: artist.name, description, images: image ? [image] : [] },
  }
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getArtist(slug: string): Promise<Artist | null> {
  const { data, error } = await supabase
    .from('artists')
    .select(`
      id, name, slug, bio, tagline, image_url, avatar_url,
      artist_type, verified, location_city, location_state,
      birth_place, awards, artist_website, social_facebook,
      artist_email, given_name, family_name, url, same_as,
      artist_musician_profiles (
        musical_genres, audio_file_url, audio_title,
        video_url, video_title, artistvideoabout,
        artist_spotify, artist_youtube, purchase_link
      ),
      artist_visual_profiles (visual_mediums, works)
    `)
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (error || !data) return null
  return {
    ...data,
    musician_profile: Array.isArray(data.artist_musician_profiles)
      ? data.artist_musician_profiles[0] || null
      : (data.artist_musician_profiles as any) || null,
    visual_profile: Array.isArray(data.artist_visual_profiles)
      ? data.artist_visual_profiles[0] || null
      : (data.artist_visual_profiles as any) || null,
  } as Artist
}

async function getArtistEvents(artistId: string): Promise<Event[]> {
  const { data: links } = await supabase
    .from('event_artists')
    .select('event_id')
    .eq('artist_id', artistId)

  if (!links || links.length === 0) return []

  const eventIds = links.map((l: any) => l.event_id)

  const { data } = await supabase
    .from('events')
    .select(`
      id, slug, title, event_date, event_start_time, ticket_url, image_url, ticket_price,
      venue:venues (name, neighborhood)
    `)
    .in('id', eventIds)
    .order('event_date', { ascending: true })
    .limit(10)

  return (data || []).map((e: any) => ({
    ...e,
    venue: Array.isArray(e.venue) ? (e.venue[0] ?? null) : e.venue,
  })) as Event[]
}

async function getPortfolioImages(artistId: string): Promise<PortfolioImage[]> {
  const { data } = await supabase
    .from('artist_portfolio_images')
    .select('id, image_url, caption, display_order')
    .eq('artist_id', artistId)
    .order('display_order', { ascending: true })
  return (data || []) as PortfolioImage[]
}

function getJsonLd(artist: Artist) {
  const genres = [...(artist.musician_profile?.musical_genres || []), ...(artist.visual_profile?.visual_mediums || [])]
  return {
    '@context': 'https://schema.org',
    '@type': artist.artist_type === 'Musician' ? 'MusicGroup' : 'Person',
    name: artist.name,
    description: artist.bio || artist.tagline,
    image: artist.image_url || artist.avatar_url,
    url: artist.url || artist.artist_website,
    sameAs: artist.same_as || [],
    ...(genres.length > 0 && { genre: genres }),
    ...(artist.location_city && { homeLocation: { '@type': 'Place', addressLocality: artist.location_city, addressRegion: artist.location_state } }),
    ...(artist.awards && { award: artist.awards }),
  }
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})/)
  return match ? match[1] : null
}

function getSocialLinks(artist: Artist) {
  const links: { label: string; url: string; icon: string; color: string }[] = []
  const mp = artist.musician_profile
  if (artist.artist_website) links.push({ label: 'Website', url: artist.artist_website, icon: '🌐', color: '#1a1814' })
  if (mp?.artist_spotify) links.push({ label: 'Spotify', url: mp.artist_spotify, icon: '♫', color: '#1DB954' })
  if (mp?.artist_youtube) links.push({ label: 'YouTube', url: mp.artist_youtube, icon: '▶', color: '#FF0000' })
  if (artist.social_facebook) links.push({ label: 'Facebook', url: artist.social_facebook, icon: 'f', color: '#1877F2' })
  if (mp?.purchase_link) links.push({ label: 'Buy / Book', url: mp.purchase_link, icon: '🎟', color: '#C80650' })
  if (artist.artist_email) links.push({ label: 'Email', url: `mailto:${artist.artist_email}`, icon: '✉', color: '#6b6560' })
  artist.same_as?.forEach(url => {
    if (url.includes('soundcloud')) links.push({ label: 'SoundCloud', url, icon: '☁', color: '#FF5500' })
    if (url.includes('instagram')) links.push({ label: 'Instagram', url, icon: '◎', color: '#E1306C' })
    if (url.includes('apple')) links.push({ label: 'Apple Music', url, icon: '♪', color: '#FA243C' })
    if (url.includes('tiktok')) links.push({ label: 'TikTok', url, icon: '♩', color: '#010101' })
  })
  return links
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const artist = await getArtist(slug)
  if (!artist) notFound()

  const [events, portfolioImages] = await Promise.all([
    getArtistEvents(artist.id),
    getPortfolioImages(artist.id),
  ])

  const mp = artist.musician_profile
  const vp = artist.visual_profile
  const genres = [...(mp?.musical_genres || []), ...(vp?.visual_mediums || [])]
  const heroImage = artist.image_url || artist.avatar_url
  const socialLinks = getSocialLinks(artist)
  const videoId = mp?.video_url ? getYouTubeId(mp.video_url) : null
  const jsonLd = getJsonLd(artist)
  const hasMusic = !!(mp?.audio_file_url || mp?.video_url)
  const hasWork = !!(vp?.works) || portfolioImages.length > 0

  const TYPE_LABEL: Record<string, string> = {
    Musician: 'Musician', Visual: 'Visual Artist', Performance: 'Performer', Literary: 'Literary Artist',
  }

  const navItems = [
    { id: 'about', label: 'About', icon: '◉', show: true },
    { id: 'music', label: 'Music', icon: '♫', show: hasMusic },
    { id: 'work', label: 'Work', icon: '◈', show: hasWork },
    { id: 'events', label: 'Events', icon: '◷', show: true },
    { id: 'links', label: 'Links', icon: '↗', show: socialLinks.length > 0 },
  ].filter(n => n.show)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@200;300;400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --ink: #1a1814;
          --ink-soft: #6b6560;
          --ink-faint: #c0bab3;
          --white: #ffffff;
          --off: #f7f6f4;
          --accent: #C80650;
          --accent-light: #fdeef3;
          --border: #ece8e2;
          --serif: 'Oswald', sans-serif;
          --sans: 'DM Sans', system-ui, sans-serif;
          --nav-h: 56px;
          --bottom-nav-h: 64px;
        }

        html { scroll-behavior: smooth; background: var(--white); }
        body {
          background: var(--white);
          color: var(--ink);
          font-family: var(--sans);
          -webkit-font-smoothing: antialiased;
          padding-bottom: 0;
        }

        /* ── HERO ─────────────────────────────────────── */
        .hero {
          position: relative;
          width: 100%;
          height: 100svh;
          max-height: 700px;
          min-height: 480px;
          overflow: hidden;
          background: var(--ink);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .hero-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 20%;
        }
        .hero-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(0,0,0,0.08) 0%,
            rgba(0,0,0,0.15) 40%,
            rgba(0,0,0,0.72) 75%,
            rgba(0,0,0,0.92) 100%
          );
        }
        .hero-monogram {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--serif);
          font-size: clamp(8rem, 30vw, 20rem);
          font-weight: 700;
          color: rgba(255,255,255,0.04);
          text-transform: uppercase;
          letter-spacing: -0.04em;
          user-select: none;
        }
        .hero-body {
          position: relative;
          z-index: 2;
          padding: 24px 24px 32px;
        }
        .hero-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .hero-type-label {
          font-size: 0.65rem;
          font-weight: 500;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--accent);
        }
        .hero-verified {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--accent);
          background: rgba(200,6,80,0.18);
          border: 1px solid rgba(200,6,80,0.35);
          padding: 3px 8px;
          border-radius: 100px;
        }
        .hero-name {
          font-family: var(--serif);
          font-size: clamp(2.6rem, 9vw, 5.5rem);
          font-weight: 700;
          color: #fff;
          line-height: 0.95;
          letter-spacing: -0.01em;
          text-transform: uppercase;
          margin-bottom: 12px;
          animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-tagline {
          font-size: clamp(0.88rem, 2vw, 1rem);
          font-weight: 300;
          font-style: italic;
          color: rgba(255,255,255,0.65);
          line-height: 1.5;
          margin-bottom: 16px;
          max-width: 480px;
          animation: fadeUp 0.6s 0.08s cubic-bezier(0.22,1,0.36,1) both;
        }
        .hero-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          animation: fadeUp 0.6s 0.16s cubic-bezier(0.22,1,0.36,1) both;
        }
        .hero-pill {
          font-size: 0.67rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.55);
          border: 1px solid rgba(255,255,255,0.18);
          padding: 4px 10px;
          border-radius: 100px;
          backdrop-filter: blur(4px);
        }
        .hero-pill.location {
          display: flex;
          align-items: center;
          gap: 4px;
          color: rgba(255,255,255,0.4);
          border-color: transparent;
          padding-left: 0;
        }

        /* ── DESKTOP TOP NAV ──────────────────────────── */
        .top-nav {
          position: sticky;
          top: 0;
          z-index: 200;
          background: var(--white);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          height: var(--nav-h);
          padding: 0 24px;
          gap: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .top-nav::-webkit-scrollbar { display: none; }
        .top-nav-back {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-soft);
          text-decoration: none;
          padding-right: 20px;
          margin-right: 4px;
          border-right: 1px solid var(--border);
          white-space: nowrap;
          flex-shrink: 0;
          transition: color 0.15s;
        }
        .top-nav-back:hover { color: var(--ink); }
        .top-nav-link {
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-faint);
          text-decoration: none;
          padding: 0 16px;
          height: 100%;
          display: flex;
          align-items: center;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .top-nav-link:hover { color: var(--ink); border-bottom-color: var(--ink); }

        /* ── MOBILE BOTTOM NAV ────────────────────────── */
        .bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 200;
          background: var(--white);
          border-top: 1px solid var(--border);
          height: var(--bottom-nav-h);
          padding: 0;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .bottom-nav-inner {
          display: flex;
          height: 100%;
          align-items: stretch;
          padding: 0 4px;
          width: 100%
        }
        .bottom-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-decoration: none;
          color: #7a7570;
          transition: color 0.15s;
          padding: 8px 2px;
          min-width: 0;
        }
        .bottom-nav-item:hover, .bottom-nav-item:active { color: var(--accent); }
        .bottom-nav-icon {
          font-size: 1rem;
          line-height: 1;
        }
        .bottom-nav-label {
          font-size: 0.58rem;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .bottom-nav-back {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-decoration: none;
          color: #7a7570;
          transition: color 0.15s;
          padding: 8px 2px;
          border-right: 1px solid var(--border);
          margin-right: 4px;
        }
        .bottom-nav-back:hover { color: var(--ink); }

        /* ── MAIN CONTENT ────────────────────────────── */
        .artist-main {
          max-width: 680px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .section {
          padding: 52px 0;
          border-bottom: 1px solid var(--border);
        }
        .section:last-child { border-bottom: none; padding-bottom: 80px; }

        .eyebrow {
          font-size: 0.65rem;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--ink-faint);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .eyebrow::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
          max-width: 48px;
        }

        /* ── BIO ── */
        .bio-text {
          font-size: 1.02rem;
          font-weight: 300;
          line-height: 1.8;
          color: var(--ink);
        }
        .bio-text + .bio-text { margin-top: 14px; }
        .bio-empty {
          font-size: 0.95rem;
          font-style: italic;
          color: var(--ink-faint);
        }
        .awards-block {
          margin-top: 28px;
          padding: 16px 20px;
          background: var(--accent-light);
          border-left: 3px solid var(--accent);
          border-radius: 0 6px 6px 0;
        }
        .awards-label {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 6px;
        }
        .awards-text {
          font-size: 0.9rem;
          color: var(--ink-soft);
          line-height: 1.55;
        }

        /* ── AUDIO ── */
        .audio-block {
          background: var(--ink);
          border-radius: 10px;
          padding: 20px 22px;
          margin-bottom: 20px;
        }
        .audio-track-name {
          font-family: var(--serif);
          font-size: 0.9rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.85);
          margin-bottom: 14px;
        }
        audio { width: 100%; height: 32px; }

        /* ── VIDEO ── */
        .video-container {
          border-radius: 10px;
          overflow: hidden;
          position: relative;
          padding-bottom: 56.25%;
          background: var(--ink);
        }
        .video-container iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
        .video-meta {
          margin-top: 12px;
          font-size: 0.82rem;
          color: var(--ink-faint);
          font-style: italic;
          line-height: 1.5;
        }
        .video-meta strong { color: var(--ink-soft); font-style: normal; }

        /* ── WORKS IMAGE ── */
        .works-image {
          width: 100%;
          border-radius: 10px;
          display: block;
        }
        .works-text {
          font-size: 0.95rem;
          line-height: 1.7;
          color: var(--ink-soft);
        }

        /* ── PORTFOLIO GRID ── */
        .portfolio-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 8px;
        }
        @media (min-width: 520px) { .portfolio-grid { grid-template-columns: repeat(3, 1fr); } }
        .portfolio-item { display: flex; flex-direction: column; gap: 6px; }
        .portfolio-img {
          width: 100%; aspect-ratio: 4/3; object-fit: cover;
          border-radius: 8px; display: block; background: var(--off);
        }
        .portfolio-caption {
          font-size: 0.75rem; color: var(--ink-faint);
          font-style: italic; line-height: 1.4;
        }

        /* ── EVENTS ── */
        .events-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 40px 0;
          text-align: center;
        }
        .events-empty-icon { font-size: 2rem; }
        .events-empty-title {
          font-family: var(--serif);
          font-size: 1rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink-soft);
        }
        .events-empty-sub {
          font-size: 0.85rem;
          color: var(--ink-faint);
        }

        /* ── LINKS ── */
        .links-stack { display: flex; flex-direction: column; gap: 10px; }
        .link-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 15px 18px;
          background: var(--white);
          border: 1.5px solid var(--border);
          border-radius: 10px;
          text-decoration: none;
          color: var(--ink);
          transition: border-color 0.15s, box-shadow 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .link-row:hover, .link-row:active {
          border-color: var(--ink);
          box-shadow: -3px 0 0 var(--accent);
        }
        .link-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          flex-shrink: 0;
        }
        .link-name {
          font-family: var(--serif);
          font-size: 0.95rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          flex: 1;
        }
        .link-chevron {
          color: var(--ink-faint);
          font-size: 1rem;
          flex-shrink: 0;
          transition: transform 0.15s;
        }
        .link-row:hover .link-chevron { transform: translateX(3px); }

        /* ── CONTACT GRID ── */
        .contact-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .contact-cell {
          padding: 16px;
          background: var(--off);
          border-radius: 8px;
        }
        .contact-cell-label {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--ink-faint);
          margin-bottom: 5px;
        }
        .contact-cell-value {
          font-size: 0.88rem;
          color: var(--ink);
          line-height: 1.4;
          word-break: break-word;
        }
        .contact-cell-value a { color: var(--accent); text-decoration: none; }
        .contact-cell-value a:hover { text-decoration: underline; }

        /* ── FOOTER ── */
        .artist-footer {
          padding: 28px 24px 40px;
          text-align: center;
          border-top: 1px solid var(--border);
        }
        .footer-wordmark {
          font-family: var(--serif);
          font-size: 0.72rem;
          font-weight: 400;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ink-faint);
          text-decoration: none;
          transition: color 0.15s;
        }
        .footer-wordmark em { font-style: normal; color: var(--accent); font-weight: 600; }
        .footer-wordmark:hover { color: var(--ink); }

        /* ── RESPONSIVE ──────────────────────────────── */

        /* Desktop: top nav visible, bottom nav hidden */
        @media (min-width: 641px) {
          .bottom-nav { display: none !important; }
          .top-nav { display: flex; }
          body { padding-bottom: 0; }
        }

        /* Mobile: bottom nav visible, top nav hidden */
        @media (max-width: 640px) {
          .top-nav { display: none !important; }
          .bottom-nav { display: flex; }

          body { padding-bottom: var(--bottom-nav-h); }

          .hero {
            height: 100svh;
            max-height: 100svh;
            min-height: 0;
          }
          .hero-body { padding: 20px 20px 28px; }
          .artist-main { padding: 0 20px; }
          .section { padding: 40px 0; }
          .contact-grid { grid-template-columns: 1fr; }
          .artist-footer { padding-bottom: 20px; }
        }

        /* Prevent iOS bounce on scroll within fixed bottom nav */
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .bottom-nav {
            padding-bottom: calc(env(safe-area-inset-bottom) + 4px);
            height: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom));
          }
          @media (max-width: 640px) {
            body {
              padding-bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom));
            }
          }
        }
      `}</style>

      {/* ── HERO ── */}
      <section className="hero">
        {heroImage ? (
          <>
            <img src={heroImage} alt={artist.name} className="hero-img" />
            <div className="hero-scrim" />
          </>
        ) : (
          <div className="hero-monogram">{artist.name[0]}</div>
        )}
        <div className="hero-body">
          <div className="hero-eyebrow">
            <span className="hero-type-label">
              {TYPE_LABEL[artist.artist_type || ''] || artist.artist_type || 'Artist'}
            </span>
            {artist.verified && <span className="hero-verified">✓ Featured</span>}
          </div>
          <h1 className="hero-name">{artist.name}</h1>
          {artist.tagline && <p className="hero-tagline">"{artist.tagline}"</p>}
          <div className="hero-pills">
            {(artist.location_city || artist.location_state) && (
              <span className="hero-pill location">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {[artist.location_city, artist.location_state].filter(Boolean).join(', ')}
              </span>
            )}
            {genres.slice(0, 3).map(g => <span key={g} className="hero-pill">{g}</span>)}
          </div>
        </div>
      </section>

      {/* ── DESKTOP: STICKY TOP NAV ── */}
      <nav className="top-nav">
        <a href="/artists" className="top-nav-back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Directory
        </a>
        {navItems.map(n => (
          <a key={n.id} href={`#${n.id}`} className="top-nav-link">{n.label}</a>
        ))}
      </nav>

      {/* ── MOBILE: FIXED BOTTOM NAV ── */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <a href="/artists" className="bottom-nav-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span className="bottom-nav-label">Back</span>
          </a>
          {navItems.map(n => (
            <a key={n.id} href={`#${n.id}`} className="bottom-nav-item">
              <span className="bottom-nav-icon">{n.icon}</span>
              <span className="bottom-nav-label">{n.label}</span>
            </a>
          ))}
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <main className="artist-main">

        <section id="about" className="section">
          <div className="eyebrow">About</div>
          {artist.bio
            ? artist.bio.split('\n').filter(Boolean).map((p, i) => <p key={i} className="bio-text">{p}</p>)
            : <p className="bio-empty">Bio coming soon.</p>
          }
          {artist.awards && artist.awards.trim() && (
            <div className="awards-block">
              <div className="awards-label">Awards & Recognition</div>
              <div className="awards-text">{artist.awards}</div>
            </div>
          )}
        </section>

        {hasMusic && (
          <section id="music" className="section">
            <div className="eyebrow">{artist.artist_type === 'Musician' ? 'Music' : 'Media'}</div>
            {mp?.audio_file_url && (
              <div className="audio-block" style={{ marginBottom: videoId ? '20px' : 0 }}>
                <div className="audio-track-name">{mp.audio_title || 'Listen'}</div>
                <audio controls src={mp.audio_file_url} />
              </div>
            )}
            {videoId && (
              <>
                <div className="video-container">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={mp?.video_title || artist.name}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {(mp?.video_title || mp?.artistvideoabout) && (
                  <p className="video-meta">
                    {mp?.video_title && <strong>{mp.video_title}</strong>}
                    {mp?.video_title && mp?.artistvideoabout && ' — '}
                    {mp?.artistvideoabout}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {hasWork && (
          <section id="work" className="section">
            <div className="eyebrow">Works</div>
            {vp?.works && (
              vp.works.startsWith('http')
                ? <img src={vp.works} alt={`${artist.name} — Works`} className="works-image" style={{ marginBottom: portfolioImages.length > 0 ? 20 : 0 }} />
                : <p className="works-text" style={{ marginBottom: portfolioImages.length > 0 ? 20 : 0 }}>{vp.works}</p>
            )}
            {portfolioImages.length > 0 && (
              <div className="portfolio-grid">
                {portfolioImages.map(img => (
                  <div key={img.id} className="portfolio-item">
                    <img src={img.image_url} alt={img.caption || artist.name} className="portfolio-img" />
                    {img.caption && <p className="portfolio-caption">{img.caption}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section id="events" className="section">
          <div className="eyebrow">Upcoming Events</div>
          {events.length === 0 ? (
            <div className="events-empty">
              <div className="events-empty-icon">📅</div>
              <div className="events-empty-title">No upcoming events</div>
              <div className="events-empty-sub">Check back soon or follow on social media</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {events.map(event => (
                <a
                  key={event.id}
                  href={event.slug ? `/events/${event.slug}` : event.ticket_url || '#'}
                  target={event.slug ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  className="link-row"
                >
                  {event.image_url && (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      style={{ width: 80, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '0.95rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {event.title}
                    </div>
                    {event.event_date && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', marginTop: 3 }}>
                        {new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {event.event_start_time && ` · ${event.event_start_time.trim()}`}
                      </div>
                    )}
                    {event.venue && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginTop: 2 }}>
                        {event.venue.name}{event.venue.neighborhood ? ` · ${event.venue.neighborhood}` : ''}
                      </div>
                    )}
                  </div>
                  {event.ticket_price !== null && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: event.ticket_price === 0 ? 'var(--accent)' : 'var(--ink-soft)', flexShrink: 0 }}>
                      {event.ticket_price === 0 ? 'Free' : `$${event.ticket_price}`}
                    </span>
                  )}
                  <span className="link-chevron">→</span>
                </a>
              ))}
            </div>
          )}
        </section>

        {socialLinks.length > 0 && (
          <section id="links" className="section">
            <div className="eyebrow">Find Me Online</div>
            <div className="links-stack">
              {socialLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target={link.url.startsWith('mailto') ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  className="link-row"
                >
                  <span className="link-icon-wrap" style={{ background: link.color + '15', color: link.color }}>
                    {link.icon}
                  </span>
                  <span className="link-name">{link.label}</span>
                  <span className="link-chevron">→</span>
                </a>
              ))}
            </div>
          </section>
        )}

      </main>

      <footer className="artist-footer">
        <a href="/artists" className="footer-wordmark">
          <em>seveneightfive</em> + <em>ArtsConnect</em> Artist Directory
        </a>
      </footer>
    </>
  )
}
