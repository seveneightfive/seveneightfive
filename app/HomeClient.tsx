'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from './home.module.css'

type Event = {
  id: string
  title: string
  event_date: string
  event_start_time: string | null
  event_end_time: string | null
  ticket_price: number | null
  event_types: string[] | null
  slug: string | null
  star: boolean | null
  venue: { name: string } | null   // ← object, not string
}

type Artist = {
  id: string
  name: string
  slug: string | null
  tagline: string | null
  artist_type: string | null
  avatar_url: string | null   // ← add this
  image_url: string | null    // ← add this
  upcomingCount: number
}

const NEIGHBORHOODS = [
  { large: true,  label: 'Most Active', name: 'The Arts District', count: '34 venues · 12 events this week', bg: 'linear-gradient(135deg, #C80650 0%, #7a0030 60%, #1a1a1a 100%)' },
  { large: false, label: 'Nightlife',   name: 'Midtown Strip',     count: '18 bars',    bg: 'linear-gradient(160deg, #1a1a1a, #3d3d3d)' },
  { large: false, label: 'Culture',     name: 'East Side',         count: '9 galleries',bg: 'linear-gradient(160deg, #2a4000, #4a7000)' },
  { large: false, label: 'Live Music',  name: 'The Docks',         count: '11 stages',  bg: 'linear-gradient(160deg, #003c5a, #006090)' },
  { large: false, label: 'Food & Drinks', name: 'La Plaza',        count: '22 spots',   bg: 'linear-gradient(160deg, #FFCE03, #e0a800)' },
]

export default function HomeClient({
  events,
  artists,
}: {
  events: Event[]
  artists: Artist[]
}) {
  const [activeSection, setActiveSection] = useState('events')

  useEffect(() => {
    const sections = ['events', 'artists', 'neighborhoods']
    const onScroll = () => {
      let current = sections[0]
      sections.forEach((id) => {
        const el = document.getElementById(id)
        if (el && window.scrollY >= el.offsetTop - 120) current = id
      })
      setActiveSection(current)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* ── Desktop Top Nav ── */}
      <header className={styles.topnav}>
        <Link href="/" className={styles.logo}>
          785<span>MAGAZINE</span>
        </Link>
        <nav>
          <Link href="/events"    className={styles.navLink}>Events</Link>
          <Link href="/artists"   className={styles.navLink}>Artist Directory</Link>
          <Link href="/venues"    className={styles.navLink}>Venues</Link>
          <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
        </nav>
      </header>

      {/* ── Mobile Header ── */}
      <header className={styles.mobileHeader}>
        <Link href="/" className={styles.logo}>
          785<span>MAGAZINE</span>
        </Link>
        <span className={styles.date}>
          {new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })}
        </span>
      </header>

      <main className={styles.main}>

        {/* ── Hero ── */}
        <section className={styles.hero}>
          <p className={styles.kicker}>LOCAL. VOCAL.</p>
          <h1>
            What&apos;s<br /><em>On</em> in<br />Top City
          </h1>
          <p>Discover upcoming events, artists, and neighborhoods making noise this week.</p>
          <Link href="/events" className={styles.heroCta}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Browse Events
          </Link>
        </section>

        {/* ── Upcoming Events ── */}
        <section id="events">
          <div className={styles.sectionHeader}>
            <h2>Upcoming Events</h2>
            <Link href="/events">See all →</Link>
          </div>
          <div className={styles.events}>
            {events.length === 0 ? (
              <p style={{ padding: '20px', color: '#AAAAAA', fontFamily: 'Oswald, sans-serif' }}>
                No upcoming events — check back soon.
              </p>
            ) : (
              events.map((event) => {
                const d = new Date(event.event_date + 'T00:00:00') // ensure it's treated as local date
                const day = d.getDate().toString().padStart(2, '0')
                const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
                return (
                  <Link href={`/events/${event.slug ?? event.id}`} key={event.id} className={styles.eventCard}>
                    <div className={styles.eventDate}>
                      <span className={styles.day}>{day}</span>
                      <span className={styles.mon}>{mon}</span>
                    </div>
                    <div className={styles.eventInfo}>
                      <div className={styles.eventTag}>{event.event_types?.[0] ?? ''}</div>
                      <div className={styles.eventName}>{event.title}</div>
                      <div className={styles.eventMeta}>{event.venue?.name} · {event.event_start_time}</div>
                    </div>
                    <div className={styles.eventPrice}>
  {event.ticket_price ? `$${event.ticket_price}` : 'Free'}
</div>
                  </Link>
                )
              })
            )}
          </div>
        </section>

        {/* ── Featured Artists ── */}
        <section id="artists">
          <div className={styles.sectionHeader}>
            <h2>Featured Artists</h2>
            <Link href="/artists">Directory →</Link>
          </div>
          <div className={styles.artistsScroll}>
            {artists.length === 0 ? (
              <p style={{ padding: '0 20px 20px', color: '#AAAAAA', fontFamily: 'Oswald, sans-serif' }}>
                No featured artists yet.
              </p>
            ) : (
              artists.map((artist) => (
                <Link href={artist.slug ? `/artists/${artist.slug}` : '#'} key={artist.id} className={styles.artistCard}>
                  <div className={styles.artistImg}>
                    {artist.avatar_url || artist.image_url ? (
                        <img
          src={artist.avatar_url ?? artist.image_url ?? ''}
          alt={artist.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <>
          <div className={styles.colorFill} style={{ background: 'linear-gradient(145deg, #1a1a1a, #444)' }} />
          <div className={styles.initials}>
            {artist.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
          </div>
        </>
      )}
      <div className={styles.artistImgTag}>
        {artist.upcomingCount} upcoming
      </div>
    </div>
    <div className={styles.artistName}>{artist.name}</div>
    <div className={styles.artistGenre}>{artist.artist_type ?? ''}</div>
  </Link>
))
            )}
          </div>
        </section>

        {/* ── Neighborhoods ── */}
        <section id="neighborhoods">
          <div className={styles.sectionHeader}>
            <h2>Explore the City</h2>
            <Link href="/venues">Map view →</Link>
          </div>
          <div className={styles.neighborhoods}>
            {NEIGHBORHOODS.map((nbh) => (
              <Link
                href="/venues"
                key={nbh.name}
                className={`${styles.nbhCard} ${nbh.large ? styles.nbhLarge : ''}`}
              >
                <div className={styles.nbhBg} style={{ background: nbh.bg }} />
                <div className={styles.nbhContent}>
                  <div className={styles.nbhLabel}>{nbh.label}</div>
                  <div className={styles.nbhName}>{nbh.name}</div>
                  <div className={styles.nbhCount}>{nbh.count}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Announcement ── */}
        <div className={styles.announcement}>
          <h3>Summer<br />Festival <span>2026</span><br />Lineup Drops</h3>
          <p>
            Our biggest event of the year returns June 12–14. Expect three stages, 60+ artists,
            and the city&apos;s most vibrant outdoor experience. Early bird passes on sale March 1st
            — limited quantities available.
          </p>
          <Link href="/events" className={styles.annCta}>Get Early Access</Link>
        </div>

        {/* ── Advertisement ── */}
        <div className={styles.adBlock}>
          <div className={styles.adEyebrow}>Sponsored</div>
          <h3>Sound<br />Better<br />Live</h3>
          <p>Rent professional PA systems, lighting rigs, and stage equipment from City Sound Co — starting at $99/night.</p>
          <a href="https://example.com" target="_blank" rel="noopener noreferrer" className={styles.adBtn}>
            Book Equipment
          </a>
          <div className={styles.adDeco}>♪</div>
        </div>

        <div className={styles.footerRule} />
        <p className={styles.footerText}>© 2026 Pulse City Guide — All events & times subject to change</p>

      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className={styles.bottomnav}>
        <Link href="/events" className={`${styles.bnLink} ${activeSection === 'events' ? styles.active : ''}`}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Events
        </Link>
        <Link href="/artists" className={`${styles.bnLink} ${activeSection === 'artists' ? styles.active : ''}`}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          Artists
        </Link>
        <Link href="/venues" className={`${styles.bnLink} ${activeSection === 'neighborhoods' ? styles.active : ''}`}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Venues
        </Link>
        <Link href="/dashboard" className={styles.bnLink}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Dashboard
        </Link>
      </nav>
    </>
  )
}
