'use client'

import Link from 'next/link'
import styles from './home.module.css'
import FeaturedSlider, { type FeaturedEvent } from './FeaturedSlider'
import HeroSlider, { type HeroSlide } from './HeroSlider'
import AdvertisementBanner from './components/AdvertisementBanner'

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
  image_url: string | null
  venue: { name: string; neighborhood: string | null } | null
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

const STATIC_NEIGHBORHOODS = [
  { large: false, label: 'Nightlife',   name: 'Midtown Strip',     count: '18 bars',    bg: 'linear-gradient(160deg, #1a1a1a, #3d3d3d)' },
  { large: false, label: 'Culture',     name: 'East Side',         count: '9 galleries',bg: 'linear-gradient(160deg, #2a4000, #4a7000)' },
  { large: false, label: 'Visual Galleries', name: 'Art Galleries',  count: '38 galleries', href: '/topeka-art-galleries', bg: 'linear-gradient(160deg, #003c5a, #006090)' },
  { large: false, label: 'Food & Drinks', name: 'La Plaza',        count: '22 spots',   bg: 'linear-gradient(160deg, #FFCE03, #e0a800)' },
]

export default function HomeClient({
  events,
  artists,
  featuredEvents,
  notoVenueCount,
  notoEventCount,
  heroSlides,
}: {
  events: Event[]
  artists: Artist[]
  featuredEvents: FeaturedEvent[]
  notoVenueCount: number
  notoEventCount: number
  heroSlides: HeroSlide[]
}) {
  return (
    <>
      <main className={styles.main}>

        {/* ── Hero ── */}
        {heroSlides.length > 0 ? (
          <HeroSlider slides={heroSlides} />
        ) : (
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
        )}

        {/* ── Featured Events Slider ── */}
        {featuredEvents.length > 0 && (
          <section>
            <div className={styles.sectionHeader}>
              <h2>Featured</h2>
              <Link href="/events">All Events →</Link>
            </div>
            <FeaturedSlider events={featuredEvents} />
          </section>
        )}

        {/* ── Advertisement Banner ── */}
        <section>
          <AdvertisementBanner />
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
                    <div className={styles.eventThumb}>
                      {event.image_url ? (
                        <img src={event.image_url} alt="" className={styles.eventThumbImg} />
                      ) : (
                        <div className={styles.eventThumbFallback} />
                      )}
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
            <Link href="/artists">Discover More Artists →</Link>
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
                  </div>
                  <div className={styles.artistName}>{artist.name}</div>
                  <div className={styles.artistUpcoming}>
                    {artist.upcomingCount} upcoming {artist.upcomingCount === 1 ? 'event' : 'events'}
                  </div>
                </Link>
))
            )}
          </div>
        </section>

        {/* ── Neighborhoods ── */}
        <section id="neighborhoods">
          <div className={styles.sectionHeader}>
            <h2>Explore the City</h2>
            <Link href="/venues">All Venues →</Link>
          </div>
          <div className={styles.neighborhoods}>
            {/* NOTO — live data */}
            <Link
              href="/venues?neighborhood=NOTO"
              className={`${styles.nbhCard} ${styles.nbhLarge}`}
            >
              <div className={styles.nbhBg} style={{ background: 'linear-gradient(135deg, #C80650 0%, #7a0030 60%, #1a1a1a 100%)' }} />
              <div className={styles.nbhContent}>
                <div className={styles.nbhLabel}>Most Active</div>
                <div className={styles.nbhName}>NOTO Arts District</div>
                <div className={styles.nbhCount}>
                  {notoVenueCount} {notoVenueCount === 1 ? 'venue' : 'venues'}
                  {notoEventCount > 0 && ` · ${notoEventCount} upcoming ${notoEventCount === 1 ? 'event' : 'events'}`}
                </div>
              </div>
            </Link>
            {/* Static neighborhood cards */}
            {STATIC_NEIGHBORHOODS.map((nbh) => (
              <Link
                href={nbh.href ?? '/venues'}
                key={nbh.name}
                className={styles.nbhCard}
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

        {/* ── Announcement ── (hidden)
        <div className={styles.announcement}>
          <h3>Summer<br />Festival <span>2026</span><br />Lineup Drops</h3>
          <p>
            Our biggest event of the year returns June 12–14. Expect three stages, 60+ artists,
            and the city&apos;s most vibrant outdoor experience. Early bird passes on sale March 1st
            — limited quantities available.
          </p>
          <Link href="/events" className={styles.annCta}>Get Early Access</Link>
        </div>
        */}

        {/* ── Advertisement ── (hidden)
        <div className={styles.adBlock}>
          <div className={styles.adEyebrow}>Sponsored</div>
          <h3>Sound<br />Better<br />Live</h3>
          <p>Rent professional PA systems, lighting rigs, and stage equipment from City Sound Co — starting at $99/night.</p>
          <a href="https://example.com" target="_blank" rel="noopener noreferrer" className={styles.adBtn}>
            Book Equipment
          </a>
          <div className={styles.adDeco}>♪</div>
        </div>
        */}

        <div className={styles.footerRule} />
        <p className={styles.footerText}>© seveneightfive magazine — Events & times subject to change</p>

      </main>

    </>
  )
}
