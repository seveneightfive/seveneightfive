'use client'

import { useState, useEffect, useRef } from 'react'
import FollowFavoriteButtons from '@/app/components/FollowFavoriteButtons'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  bio_written_by_785: boolean | null   // NEW — checkbox from admin
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

type SocialLink = { label: string; url: string; icon: string; color: string }
type NavItem = { id: string; label: string; icon: string }

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  artist: Artist
  events: Event[]
  portfolioImages: PortfolioImage[]
  socialLinks: SocialLink[]
  navItems: NavItem[]
  genres: string[]
  videoId: string | null
  hasMusic: boolean
  hasWork: boolean
  jsonLd: object
}

// ─── SVG Icons (inline, no emoji) ────────────────────────────────────────────

const IconWebsite = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke-width="1.6">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
  </svg>
)
const IconEmail = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke-width="1.6">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)
const IconYouTube = () => (
  <svg width="32" height="32" viewBox="0 0 24 24">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
)
const IconSpotify = () => (
  <svg width="32" height="32" viewBox="0 0 24 24">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
)
const IconInstagram = () => (
  <svg width="32" height="32" viewBox="0 0 24 24">
    <rect x="2" y="2" width="20" height="20" rx="5" className="icon-outline"/>
    <circle cx="12" cy="12" r="4" className="icon-outline"/>
    <circle cx="17.5" cy="6.5" r="1.2" className="icon-dot"/>
  </svg>
)
const IconFacebook = () => (
  <svg width="32" height="32" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)
const IconX = () => (
  <svg width="32" height="32" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)
const IconSoundCloud = () => (
  <svg width="32" height="32" viewBox="0 0 24 24">
    <path d="M1.175 12.225c-.017.128-.027.257-.027.39 0 .13.01.26.027.388-.017-.128-.027-.258-.027-.389 0-.132.01-.261.027-.389zM.608 11.81c-.026.131-.04.265-.04.4 0 .135.014.27.04.4C.582 12.48.568 12.345.568 12.21c0-.135.014-.269.04-.4zm.567-.365c-.01.053-.015.106-.015.16 0 .053.005.106.015.159-.01-.053-.015-.106-.015-.16 0-.053.005-.106.015-.159z"/>
    <path d="M11.5 8.5c-.7 0-1.36.15-1.95.42C9.17 6.1 7.05 4 4.5 4 1.91 4 0 6.09 0 8.5c0 .17.01.34.03.5H0v7h15.5c1.93 0 3.5-1.57 3.5-3.5S17.43 9 15.5 9c-.17 0-.34.01-.5.03C14.47 8.77 13.04 8.5 11.5 8.5z"/>
  </svg>
)
const IconAppleMusic = () => (
  <svg width="32" height="32" viewBox="0 0 24 24">
    <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.769-.73 7.7 7.7 0 00-1.996-.16c-.693.02-1.39.04-2.08.06l-5.55.15c-.7.02-1.4.04-2.1.06A8.765 8.765 0 005.9.27C4.91.51 4.07 1.04 3.43 1.8c-.62.73-1.04 1.6-1.25 2.56-.16.73-.19 1.47-.17 2.22V19.26c.02.75.07 1.5.27 2.24.36 1.38 1.2 2.46 2.46 3.14.65.35 1.35.54 2.07.62.82.09 1.64.1 2.46.1h9.3c.8 0 1.6-.01 2.4-.1.78-.08 1.52-.3 2.2-.69 1.27-.72 2.1-1.82 2.47-3.25.18-.7.22-1.42.23-2.14V12c0-1.96-.01-3.92-.01-5.876zM15.5 5.83l-6 1.67v7.1c-.32-.12-.67-.18-1.03-.18C7.06 14.42 6 15.45 6 16.71s1.06 2.29 2.47 2.29c1.41 0 2.53-1.03 2.53-2.29V9.48l4-1.12v5.76c-.32-.12-.67-.18-1.03-.18-1.41 0-2.47 1.03-2.47 2.29s1.06 2.29 2.47 2.29c1.41 0 2.53-1.03 2.53-2.29V5.83z"/>
  </svg>
)
const IconTikTok = () => (
  <svg width="32" height="32" viewBox="0 0 24 24">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z"/>
  </svg>
)
const IconLink = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke-width="1.6">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
)

// Map label → icon component + render type
function getSvgIcon(label: string) {
  const l = label.toLowerCase()
  if (l.includes('instagram')) return { component: <IconInstagram />, type: 'mixed' }
  if (l.includes('youtube')) return { component: <IconYouTube />, type: 'fill' }
  if (l.includes('spotify')) return { component: <IconSpotify />, type: 'fill' }
  if (l.includes('facebook')) return { component: <IconFacebook />, type: 'fill' }
  if (l.includes('tiktok')) return { component: <IconTikTok />, type: 'fill' }
  if (l.includes('twitter') || l.includes(' x ') || l === 'x') return { component: <IconX />, type: 'fill' }
  if (l.includes('soundcloud')) return { component: <IconSoundCloud />, type: 'fill' }
  if (l.includes('apple')) return { component: <IconAppleMusic />, type: 'fill' }
  if (l.includes('email') || l.includes('mail')) return { component: <IconEmail />, type: 'stroke' }
  if (l.includes('website') || l.includes('web')) return { component: <IconWebsite />, type: 'stroke' }
  return { component: <IconLink />, type: 'stroke' }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ArtistPageClient({
  artist,
  events,
  portfolioImages,
  socialLinks,
  navItems,
  genres,
  videoId,
  hasMusic,
  hasWork,
  jsonLd,
}: Props) {
  const [shareOpen, setShareOpen] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<PortfolioImage | null>(null)
  const [activeSection, setActiveSection] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [tabsHidden, setTabsHidden] = useState(false)
  const lastScrollY = useRef(0)

  // Intro animation state
  const [introPhase, setIntroPhase] = useState<'intro' | 'transitioning' | 'done'>('intro')

  const mp = artist.musician_profile

  const TYPE_LABEL: Record<string, string> = {
    Musician: 'Musician',
    Visual: 'Visual Artist',
    Performance: 'Performer',
    Literary: 'Literary Artist',
  }

  // Scrollspy — IntersectionObserver
  useEffect(() => {
    if (introPhase !== 'done') return
    const observers: IntersectionObserver[] = []
    navItems.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
        { threshold: 0.3 }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [navItems, introPhase])

  // Hide/show sticky tabs on scroll direction
  useEffect(() => {
    if (introPhase !== 'done') return
    const onScroll = () => {
      const y = window.scrollY
      if (y > lastScrollY.current + 8) {
        setTabsHidden(true)
      } else if (y < lastScrollY.current - 8) {
        setTabsHidden(false)
      }
      lastScrollY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [introPhase])

  // Escape closes lightbox
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxImage(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleIntroAdvance = () => {
    setIntroPhase('transitioning')
    setTimeout(() => setIntroPhase('done'), 600)
  }

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const offset = 57 // sticky tab height
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
  }

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const heroImage = artist.image_url || artist.avatar_url

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <style>{`

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
          --gold: #FFCE03;
          --serif: 'Oswald', sans-serif;
          --sans: 'DM Sans', system-ui, sans-serif;
          --nav-h: 57px;
        }

        html { scroll-behavior: smooth; background: var(--white); }
        body {
          background: var(--white);
          color: var(--ink);
          font-family: var(--sans);
          -webkit-font-smoothing: antialiased;
        }

        /* ─── INTRO SCREEN ─────────────────────────────── */
        .intro-screen {
          position: fixed;
          inset: 0;
          background: #0d0d0d;
          z-index: 999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          cursor: pointer;
          transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1);
        }
        .intro-screen.transitioning {
          opacity: 0;
          transform: scale(0.97);
          pointer-events: none;
        }
        .intro-eyebrow {
          font-size: 0.62rem;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 700;
          margin-bottom: 28px;
          opacity: 0;
          animation: fadeUp 0.4s 0.3s ease both;
        }
        .intro-tagline {
          text-align: center;
          max-width: 340px;
        }
        .intro-word {
          display: inline-block;
          font-family: var(--serif);
          font-weight: 600;
          font-size: clamp(1.6rem, 6vw, 2.4rem);
          color: #fff;
          line-height: 1.2;
          opacity: 0;
          transform: translateY(18px);
        }
        .intro-word.italic {
          font-style: italic;
          font-weight: 300;
          color: rgba(255,255,255,0.5);
          font-size: clamp(1.3rem, 5vw, 2rem);
        }
        .intro-word.risen {
          animation: wordRise 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        @keyframes wordRise {
          to { opacity: 1; transform: translateY(0); }
        }
        .intro-cta {
          margin-top: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          opacity: 0;
          animation: fadeUp 0.5s 2.4s ease both;
        }
        .intro-cta-label {
          font-size: 0.68rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
        }
        .intro-cta-arrow {
          width: 32px;
          height: 32px;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: bounceUp 1s 2.6s ease-in-out infinite;
        }
        @keyframes bounceUp {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ─── HERO ─────────────────────────────────────── */
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
          object-position: center top;
        }
        .hero-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(0,0,0,0.08) 0%,
            rgba(0,0,0,0.0) 25%,
            rgba(0,0,0,0.55) 65%,
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
          text-transform: uppercase;
          margin-bottom: 10px;
          animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both;
        }
        .hero-tagline {
          font-size: clamp(0.88rem, 2vw, 1rem);
          font-weight: 300;
          font-style: italic;
          color: rgba(255,255,255,0.6);
          line-height: 1.5;
          margin-bottom: 14px;
          max-width: 480px;
          animation: fadeUp 0.6s 0.08s cubic-bezier(0.22,1,0.36,1) both;
        }
        .hero-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 18px;
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
        }
        .hero-pill.location {
          display: flex;
          align-items: center;
          gap: 4px;
          color: rgba(255,255,255,0.4);
          border-color: transparent;
          padding-left: 0;
        }
        .hero-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          animation: fadeUp 0.6s 0.24s cubic-bezier(0.22,1,0.36,1) both;
        }

        /* Follow = heart icon button */
        .btn-follow-heart {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, transform 0.12s;
          -webkit-tap-highlight-color: transparent;
          flex-shrink: 0;
        }
        .btn-follow-heart:hover { background: rgba(200,6,80,0.25); border-color: var(--accent); }
        .btn-follow-heart.active { background: rgba(200,6,80,0.3); border-color: var(--accent); }
        .btn-follow-heart:active { transform: scale(0.9); }
        .btn-follow-heart svg { transition: fill 0.15s, stroke 0.15s; }
        .btn-follow-heart.active svg { fill: var(--accent); stroke: var(--accent); }

        .hero-btn-share {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 20px;
          border-radius: 100px;
          font-family: var(--sans);
          font-size: 0.75rem;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.85);
          transition: opacity 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .hero-btn-share:hover { opacity: 0.8; }

        /* ─── STICKY TABS ──────────────────────────────── */
        .top-nav {
          position: sticky;
          top: 0;
          z-index: 200;
          background: var(--white);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          height: var(--nav-h);
          padding: 0 16px;
          overflow-x: auto;
          scrollbar-width: none;
          transition: transform 0.25s ease;
        }
        .top-nav.hidden { transform: translateY(-100%); }
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
          padding-right: 16px;
          margin-right: 4px;
          border-right: 1px solid var(--border);
          white-space: nowrap;
          flex-shrink: 0;
          transition: color 0.15s;
        }
        .top-nav-back:hover { color: var(--ink); }

        .top-nav-link {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-soft);
          text-decoration: none;
          padding: 0 14px;
          height: 100%;
          display: flex;
          align-items: center;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.15s;
          cursor: pointer;
          background: none;
          border-left: none;
          border-top: none;
          border-right: none;
          font-family: var(--sans);
        }
        .top-nav-link:hover { color: var(--ink); }
        .top-nav-link.active { color: var(--ink); border-bottom-color: var(--accent); }

        /* Mobile: inline tabs (no bottom nav) */
        .mobile-tabs {
          display: none;
          position: sticky;
          top: 0;
          z-index: 200;
          background: var(--white);
          border-bottom: 1px solid var(--border);
          height: var(--nav-h);
          overflow-x: auto;
          scrollbar-width: none;
          transition: transform 0.25s ease;
        }
        .mobile-tabs.hidden { transform: translateY(-100%); }
        .mobile-tabs::-webkit-scrollbar { display: none; }
        .mobile-tabs-inner {
          display: flex;
          align-items: stretch;
          height: 100%;
          padding: 0 12px;
        }
        .mobile-tab-back {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-soft);
          text-decoration: none;
          padding-right: 14px;
          margin-right: 4px;
          border-right: 1px solid var(--border);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .mobile-tab-item {
          padding: 0 12px;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-soft);
          display: flex;
          align-items: center;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
          flex-shrink: 0;
          cursor: pointer;
          background: none;
          border-left: none;
          border-top: none;
          border-right: none;
          font-family: var(--sans);
          transition: all 0.15s;
        }
        .mobile-tab-item.active { color: var(--ink); border-bottom-color: var(--accent); }

        /* ─── MAIN CONTENT ─────────────────────────────── */
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

        /* ─── ABOUT ──── */
        .words-by {
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--ink-faint);
          margin-bottom: 14px;
        }
        .words-by span { color: var(--accent); }

        .pull-quote {
          border-left: 3px solid var(--accent);
          padding: 8px 16px;
          margin-bottom: 18px;
          font-size: 1rem;
          font-style: italic;
          color: var(--ink);
          line-height: 1.55;
        }

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
        .awards-text { font-size: 0.9rem; color: var(--ink-soft); line-height: 1.55; }

        /* ─── AUDIO / VIDEO ──── */
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
        .video-meta { margin-top: 12px; font-size: 0.82rem; color: var(--ink-faint); font-style: italic; line-height: 1.5; }
        .video-meta strong { color: var(--ink-soft); font-style: normal; }

        /* ─── WORKS / PORTFOLIO ──── */
        .works-image { width: 100%; border-radius: 10px; display: block; }
        .works-text { font-size: 0.95rem; line-height: 1.7; color: var(--ink-soft); }
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
          cursor: zoom-in; transition: opacity 0.15s;
        }
        .portfolio-img:hover { opacity: 0.85; }
        .portfolio-caption { font-size: 0.75rem; color: var(--ink-faint); font-style: italic; line-height: 1.4; }

        /* ─── EVENTS ──── */
        .event-item {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          padding: 16px 0;
          border-bottom: 1px solid var(--border);
          text-decoration: none;
          color: inherit;
          cursor: pointer;
          transition: background 0.12s;
          -webkit-tap-highlight-color: transparent;
        }
        .event-item:last-child { border-bottom: none; }
        .event-item:active { background: rgba(200,6,80,0.03); margin: 0 -24px; padding-left: 24px; padding-right: 24px; }
        .ev-date { width: 40px; flex-shrink: 0; text-align: center; }
        .ev-mo { font-size: 0.62rem; font-weight: 700; color: var(--accent); letter-spacing: 0.12em; text-transform: uppercase; }
        .ev-day { font-family: var(--serif); font-size: 1.8rem; font-weight: 700; color: var(--ink); line-height: 1; }
        .ev-info { flex: 1; }
        .ev-name { font-size: 0.95rem; font-weight: 600; color: var(--ink); margin-bottom: 2px; }
        .ev-venue { font-size: 0.8rem; color: var(--ink-soft); }
        .ev-price { font-size: 0.8rem; font-weight: 500; color: var(--ink-soft); flex-shrink: 0; align-self: center; }
        .ev-price.free { color: var(--accent); }
        .ev-arrow { color: var(--ink-faint); font-size: 1.1rem; align-self: center; flex-shrink: 0; }
        .events-empty {
          display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; text-align: center;
        }
        .events-empty-title { font-family: var(--serif); font-size: 1rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); }
        .events-empty-sub { font-size: 0.85rem; color: var(--ink-faint); }

        /* ─── LINKS — icon grid ──── */
        .links-icon-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (min-width: 520px) {
          .links-icon-grid { grid-template-columns: repeat(5, 1fr); }
        }

        /* tile base */
        .link-tile {
          aspect-ratio: 1;
          border-radius: 14px;
          background: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          text-decoration: none;
          border: none;
          transition: background 0.18s, transform 0.12s;
          -webkit-tap-highlight-color: transparent;
          overflow: hidden;
        }
        .link-tile:active { transform: scale(0.91); }
        .link-tile:hover { background: var(--gold); }

        /* stroke-based icons */
        .link-tile.stroke-icon svg {
          fill: none;
          stroke: white;
          stroke-width: 1.6px;
          transition: stroke 0.18s;
        }
        .link-tile.stroke-icon:hover svg { stroke: #5a2000; }

        /* fill-based icons */
        .link-tile.fill-icon svg {
          fill: white;
          transition: fill 0.18s;
        }
        .link-tile.fill-icon:hover svg { fill: #5a2000; }

        /* mixed icons (instagram) */
        .link-tile.mixed-icon svg .icon-outline {
          fill: none;
          stroke: white;
          stroke-width: 1.6px;
          transition: stroke 0.18s;
        }
        .link-tile.mixed-icon svg .icon-dot {
          fill: white;
          stroke: none;
          transition: fill 0.18s;
        }
        .link-tile.mixed-icon:hover svg .icon-outline { stroke: #5a2000; }
        .link-tile.mixed-icon:hover svg .icon-dot { fill: #5a2000; }

        /* ─── FOOTER ──── */
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

        /* ─── SHARE SHEET ──── */
        .sheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 400;
          display: flex;
          align-items: flex-end;
        }
        .sheet {
          width: 100%;
          background: var(--white);
          border-radius: 20px 20px 0 0;
          padding: 0 0 env(safe-area-inset-bottom);
          max-height: 85svh;
          overflow-y: auto;
        }
        .sheet-handle {
          width: 36px; height: 4px; background: var(--border);
          border-radius: 2px; margin: 12px auto 0;
        }
        .sheet-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px 12px; border-bottom: 1px solid var(--border);
        }
        .sheet-title {
          font-family: var(--serif); font-size: 1rem;
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
        }
        .sheet-close {
          background: none; border: none; cursor: pointer;
          font-size: 1.2rem; color: var(--ink-soft); padding: 4px; line-height: 1;
        }
        .sheet-share-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          padding: 20px 20px 0;
        }
        .sheet-share-item {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          cursor: pointer; text-decoration: none; color: inherit; border: none; background: none;
          -webkit-tap-highlight-color: transparent;
        }
        .sheet-share-icon {
          width: 52px; height: 52px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.15s;
        }
        .sheet-share-item:active .sheet-share-icon { transform: scale(0.9); }
        .sheet-share-label {
          font-size: 0.68rem; color: var(--ink-soft); text-align: center;
          font-weight: 500;
        }
        .sheet-link-row {
          margin: 20px 20px 20px;
          background: var(--off);
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sheet-link-url {
          flex: 1; font-size: 0.78rem; color: var(--ink-faint);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sheet-copy-btn {
          padding: 7px 14px; background: var(--accent); color: white;
          border-radius: 8px; font-size: 0.75rem; font-weight: 700;
          border: none; cursor: pointer; flex-shrink: 0; font-family: var(--sans);
          transition: background 0.15s;
        }
        .sheet-copy-btn:hover { background: #a00440; }

        /* ─── LIGHTBOX ──── */
        .lightbox-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.95);
          z-index: 500; display: flex; flex-direction: column;
          align-items: center; justify-content: center; padding: 24px;
        }
        .lightbox-img { max-height: 80vh; max-width: 90vw; object-fit: contain; border-radius: 4px; }
        .lightbox-caption { color: rgba(255,255,255,0.6); font-size: 0.82rem; font-style: italic; margin-top: 14px; text-align: center; max-width: 480px; }
        .lightbox-close {
          position: fixed; top: 20px; right: 20px;
          background: rgba(255,255,255,0.1); color: white; border: none;
          border-radius: 100px; width: 40px; height: 40px; font-size: 1.2rem;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }

        /* ─── COPY TOAST ──── */
        .copy-toast {
          position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
          background: var(--ink); color: white; padding: 10px 20px;
          border-radius: 100px; font-size: 0.8rem; font-weight: 500;
          z-index: 500; pointer-events: none; animation: fadeUp 0.25s ease both;
        }

        /* ─── RESPONSIVE ─────────────────────────────── */
        @media (min-width: 641px) {
          .mobile-tabs { display: none !important; }
          .top-nav { display: flex; }
        }
        @media (max-width: 640px) {
          .top-nav { display: none !important; }
          .mobile-tabs { display: flex; }
          .hero { height: 100svh; max-height: 100svh; min-height: 0; }
          .hero-body { padding: 20px 20px 28px; }
          .artist-main { padding: 0 20px; }
          .section { padding: 40px 0; }
          .links-icon-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>

      {/* ── INTRO SCREEN ── */}
      {introPhase !== 'done' && artist.tagline && (
        <div
          className={`intro-screen${introPhase === 'transitioning' ? ' transitioning' : ''}`}
          onClick={handleIntroAdvance}
        >
          <div className="intro-eyebrow">785 Magazine</div>
          <div className="intro-tagline">
            {artist.tagline.split(' ').map((word, i) => {
              const isItalic = i > Math.floor(artist.tagline!.split(' ').length * 0.5)
              return (
                <span
                  key={i}
                  className={`intro-word${isItalic ? ' italic' : ''} risen`}
                  style={{ animationDelay: `${0.5 + i * 0.15}s`, marginRight: '0.3em' }}
                >
                  {word}
                </span>
              )
            })}
          </div>
          <div className="intro-cta">
            <div className="intro-cta-label">Tap to continue</div>
            <div className="intro-cta-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M5 15l7-7 7 7"/>
              </svg>
            </div>
          </div>
        </div>
      )}

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
          {artist.tagline && (
            <p className="hero-tagline">&ldquo;{artist.tagline}&rdquo;</p>
          )}
          <div className="hero-pills">
            {(artist.location_city || artist.location_state) && (
              <span className="hero-pill location">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {[artist.location_city, artist.location_state].filter(Boolean).join(', ')}
              </span>
            )}
            {genres.slice(0, 3).map(g => (
              <span key={g} className="hero-pill">{g}</span>
            ))}
          </div>
          <div className="hero-actions">
            {/* Heart / Follow button replaces old Follow+Favourite combo */}
            <FollowFavoriteButtons
              entityType="artist"
              entityId={artist.id}
              showFollow={true}
              showFavorite={false}
              heartOnly={true}
            />
            <button className="hero-btn-share" onClick={() => setShareOpen(true)}>
              ↑ Share
            </button>
          </div>
        </div>
      </section>

      {/* ── DESKTOP: STICKY TOP NAV (hides on scroll down) ── */}
      <nav className={`top-nav${tabsHidden ? ' hidden' : ''}`}>
        <a href="/artists" className="top-nav-back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Directory
        </a>
        {navItems.map(n => (
          <button
            key={n.id}
            className={`top-nav-link${activeSection === n.id ? ' active' : ''}`}
            onClick={() => scrollToSection(n.id)}
          >
            {n.label}
          </button>
        ))}
      </nav>

      {/* ── MOBILE: INLINE STICKY TABS (replaces bottom nav) ── */}
      <nav className={`mobile-tabs${tabsHidden ? ' hidden' : ''}`}>
        <div className="mobile-tabs-inner">
          <a href="/artists" className="mobile-tab-back">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back
          </a>
          {navItems.map(n => (
            <button
              key={n.id}
              className={`mobile-tab-item${activeSection === n.id ? ' active' : ''}`}
              onClick={() => scrollToSection(n.id)}
            >
              {n.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <main className="artist-main">

        {/* ABOUT */}
        <section id="about" className="section">
          <div className="eyebrow">About</div>

          {/* "Words by 785 Staff" — only renders if checkbox is true in DB */}
          {artist.bio_written_by_785 && (
            <div className="words-by">Words by <span>785 Staff</span></div>
          )}

          {/* Pull quote from tagline when bio exists */}
          {artist.tagline && artist.bio && (
            <div className="pull-quote">&ldquo;{artist.tagline}&rdquo;</div>
          )}

          {artist.bio
            ? artist.bio.split('\n').filter(Boolean).map((p, i) => (
                <p key={i} className="bio-text">{p}</p>
              ))
            : <p className="bio-empty">Bio coming soon.</p>
          }
          {artist.awards?.trim() && (
            <div className="awards-block">
              <div className="awards-label">Awards &amp; Recognition</div>
              <div className="awards-text">{artist.awards}</div>
            </div>
          )}
        </section>

        {/* MUSIC / MEDIA — hidden for Visual and Literary */}
        {hasMusic && (
          <section id="music" className="section">
            <div className="eyebrow">
              {artist.artist_type === 'Musician' ? 'Music' : 'Media'}
            </div>
            {mp?.audio_file_url && (
              <div className="audio-block" style={{ marginBottom: videoId ? 20 : 0 }}>
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

        {/* WORK */}
        {hasWork && (
          <section id="work" className="section">
            <div className="eyebrow">Works</div>
            {artist.visual_profile?.works && (
              artist.visual_profile.works.startsWith('http')
                ? <img src={artist.visual_profile.works} alt={`${artist.name} — Works`} className="works-image" style={{ marginBottom: portfolioImages.length > 0 ? 20 : 0 }} />
                : <p className="works-text" style={{ marginBottom: portfolioImages.length > 0 ? 20 : 0 }}>{artist.visual_profile.works}</p>
            )}
            {portfolioImages.length > 0 && (
              <div className="portfolio-grid">
                {portfolioImages.map(img => (
                  <div key={img.id} className="portfolio-item">
                    <img
                      src={img.image_url}
                      alt={img.caption || artist.name}
                      className="portfolio-img"
                      onClick={() => setLightboxImage(img)}
                    />
                    {img.caption && <p className="portfolio-caption">{img.caption}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* EVENTS */}
        <section id="events" className="section">
          <div className="eyebrow">Upcoming Events</div>
          {events.length === 0 ? (
            <div className="events-empty">
              <div className="events-empty-title">No upcoming events</div>
              <div className="events-empty-sub">Check back soon or follow on social media</div>
            </div>
          ) : (
            <div>
              {events.map(event => {
                const dateObj = event.event_date
                  ? new Date(event.event_date + 'T12:00:00')
                  : null
                return (
                  <a
                    key={event.id}
                    href={event.slug ? `/events/${event.slug}` : event.ticket_url || '#'}
                    target={event.slug ? '_self' : '_blank'}
                    rel="noopener noreferrer"
                    className="event-item"
                  >
                    {dateObj && (
                      <div className="ev-date">
                        <div className="ev-mo">
                          {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div className="ev-day">{dateObj.getDate()}</div>
                      </div>
                    )}
                    <div className="ev-info">
                      <div className="ev-name">{event.title}</div>
                      {event.event_start_time && (
                        <div className="ev-venue" style={{ marginBottom: 2 }}>
                          {event.event_start_time.trim()}
                        </div>
                      )}
                      {event.venue && (
                        <div className="ev-venue">
                          {event.venue.name}
                          {event.venue.neighborhood ? ` · ${event.venue.neighborhood}` : ''}
                        </div>
                      )}
                    </div>
                    {event.ticket_price !== null && (
                      <span className={`ev-price${event.ticket_price === 0 ? ' free' : ''}`}>
                        {event.ticket_price === 0 ? 'Free' : `$${event.ticket_price}`}
                      </span>
                    )}
                    <span className="ev-arrow">›</span>
                  </a>
                )
              })}
            </div>
          )}
        </section>

        {/* LINKS — icon grid, no labels, crimson → gold on hover */}
        {socialLinks.length > 0 && (
          <section id="links" className="section">
            <div className="eyebrow">Find Me Online</div>
            <div className="links-icon-grid">
              {socialLinks.map((link, i) => {
                const { component, type } = getSvgIcon(link.label)
                return (
                  <a
                    key={i}
                    href={link.url}
                    target={link.url.startsWith('mailto') ? '_self' : '_blank'}
                    rel="noopener noreferrer"
                    className={`link-tile ${type}-icon`}
                    title={link.label}
                    aria-label={link.label}
                  >
                    {component}
                  </a>
                )
              })}
            </div>
          </section>
        )}

      </main>

      <footer className="artist-footer">
        <a href="/artists" className="footer-wordmark">
          <em>seveneightfive</em> + <em>ArtsConnect</em> Artist Directory
        </a>
      </footer>

      {/* ── LIGHTBOX ── */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <img
            src={lightboxImage.image_url}
            className="lightbox-img"
            onClick={e => e.stopPropagation()}
            alt={lightboxImage.caption || ''}
          />
          {lightboxImage.caption && <p className="lightbox-caption">{lightboxImage.caption}</p>}
          <button className="lightbox-close" onClick={() => setLightboxImage(null)}>×</button>
        </div>
      )}

      {/* ── SHARE SHEET ── */}
      {shareOpen && (
        <div className="sheet-overlay" onClick={() => setShareOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Share</span>
              <button className="sheet-close" onClick={() => setShareOpen(false)}>×</button>
            </div>
            <div className="sheet-share-grid">
              <a
                className="sheet-share-item"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`}
                target="_blank" rel="noopener noreferrer"
              >
                <div className="sheet-share-icon" style={{ background: '#1877F2' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <span className="sheet-share-label">Facebook</span>
              </a>
              <a
                className="sheet-share-item"
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(artist.name)}`}
                target="_blank" rel="noopener noreferrer"
              >
                <div className="sheet-share-icon" style={{ background: '#000' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <span className="sheet-share-label">X / Twitter</span>
              </a>
              <a
                className="sheet-share-item"
                href={`sms:?body=${encodeURIComponent(artist.name + ' — ' + pageUrl)}`}
              >
                <div className="sheet-share-icon" style={{ background: '#30D158' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                </div>
                <span className="sheet-share-label">Messages</span>
              </a>
              <a
                className="sheet-share-item"
                href={`mailto:?subject=${encodeURIComponent(artist.name)}&body=${encodeURIComponent(pageUrl)}`}
              >
                <div className="sheet-share-icon" style={{ background: '#6b6560' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <span className="sheet-share-label">Email</span>
              </a>
            </div>
            <div className="sheet-link-row">
              <div className="sheet-link-url">{pageUrl}</div>
              <button className="sheet-copy-btn" onClick={handleCopyLink}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {copied && <div className="copy-toast">Link copied!</div>}
    </>
  )
}
