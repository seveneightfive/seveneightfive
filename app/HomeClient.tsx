'use client'

import Link from 'next/link'
import styles from './home.module.css'
import FeaturedSlider, { type FeaturedEvent } from './FeaturedSlider'
import HeroSlider, { type HeroSlide } from './HeroSlider'
import AdvertisementBanner from './components/AdvertisementBanner'
import EventCard from './components/EventCard'
import HomeHero from './components/HomeHero'

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

type ArchiveIssue = {
  id: string
  issue_number: number | null
  title: string
  cover_image_url: string
  callout: { headline: string; teaser: string } | null
}

const STATIC_NEIGHBORHOODS = [
  { large: false, label: 'Nightlife',   name: 'Local Pubs',     count: '18 bars',    bg: 'linear-gradient(160deg, #1a1a1a, #3d3d3d)' },
  { large: false, label: 'Culture',     name: 'The Golden Mile',         count: '9 galleries',bg: 'linear-gradient(160deg, #2a4000, #4a7000)' },
  { large: false, label: 'Visual Galleries', name: 'Art Galleries',  count: '38 galleries', href: '/topeka-art-galleries', bg: 'linear-gradient(160deg, #003c5a, #006090)' },
  { large: false, label: 'Food & Drinks', name: 'Local Flavor',        count: '22 spots',   bg: 'linear-gradient(160deg, #FFCE03, #e0a800)' },
]

export default function HomeClient({
  events,
  artists,
  featuredEvents,
  notoVenueCount,
  notoEventCount,
  heroSlides,
  archiveIssue,
}: {
  events: Event[]
  artists: Artist[]
  featuredEvents: FeaturedEvent[]
  notoVenueCount: number
  notoEventCount: number
  heroSlides: HeroSlide[]
  archiveIssue: ArchiveIssue | null
}) {
  return (
    <>
      <main className={styles.main}>

        {/* ── Hero ── */}
<HomeHero editorPick={featuredEvents[0] ?? null} />

{/* ── Featured Events Slider ── */}
{featuredEvents.length > 1 && (
  <section className={styles.contentWrap}>
    <div className={styles.sectionHeader}>
      <h2>Featured</h2>
      <Link href="/events">All Events →</Link>
    </div>

    <FeaturedSlider events={featuredEvents.slice(1)} />
  </section>
)}
        {/* ── Advertisement Banner ── */}
        <section>
          <AdvertisementBanner />
        </section>

        {/* ── Upcoming Events ── */}
<section id="events" className={styles.contentWrap}>
  <div className={styles.sectionHeader}>
    <h2>Upcoming Events</h2>
    <Link href="/events">See all →</Link>
  </div>

  <div className={styles.eventsGrid}>
    {events.length === 0 ? (
      <p
        style={{
          padding: '20px',
          color: '#AAAAAA',
          fontFamily: 'Oswald, sans-serif',
        }}
      >
        No upcoming events — check back soon.
      </p>
    ) : (
      events.slice(0, 6).map(event => (
        <EventCard
          key={event.id}
          event={event}
        />
      ))
    )}
  </div>
</section>

        {/* ── Explore our Archives ── */}
        {archiveIssue && (
          <section id="explore-archives" className={styles.contentWrap}>
            <div className={styles.sectionHeader}>
              <h2>Explore our Archives</h2>
              <Link href="/magazine">Browse the Archive →</Link>
            </div>
            <p
              style={{
                margin: '-8px 0 16px',
                fontSize: '0.85rem',
                color: '#888',
                fontFamily: 'Oswald, sans-serif',
              }}
            >
              Great stories that are still relevant today.
            </p>
            <Link
              href={
                archiveIssue.issue_number
                  ? `/magazine?issue=${archiveIssue.issue_number}`
                  : '/magazine'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                background: '#1a1814',
                borderRadius: 12,
                overflow: 'hidden',
                textDecoration: 'none',
              }}
            >
              <img
                src={archiveIssue.cover_image_url}
                alt={archiveIssue.title}
                style={{
                  width: 140,
                  aspectRatio: '0.8',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div style={{ padding: '20px 24px 20px 0', color: 'white' }}>
                {archiveIssue.issue_number && (
                  <div
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: '#FFCE03',
                      marginBottom: 6,
                    }}
                  >
                    Issue {archiveIssue.issue_number}
                  </div>
                )}
                <div
                  style={{
                    fontFamily: 'Oswald, sans-serif',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: '1.4rem',
                    lineHeight: 1.1,
                    marginBottom: 8,
                  }}
                >
                  {/* When this issue has a story callout, lead with that
                      instead of the plain issue title — it's the specific
                      hook that gets someone to click. */}
                  {archiveIssue.callout ? archiveIssue.callout.headline : archiveIssue.title}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                  {archiveIssue.callout
                    ? archiveIssue.callout.teaser
                    : `From ${archiveIssue.title} — flip through this one →`}
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* ── Featured Artists ── */}
       <section id="artists" className={styles.contentWrap}>
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
        <section id="neighborhoods" className={styles.contentWrap}>
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

        {/* ── Announcement ── */}
        <div className={styles.announcement}>
          <h3>Sell<br />Event <span>Tickets</span><br />Now on 785</h3>
          <p>
            We are proud to offer a local ticketing option to you. Save money, keep money local 
            and receive your funds quicker then with those "other" guys. 
            Go to "MY 785" and start the simple onboarding process. Takes about 10 minutes.
          </p>
          <Link href="/shop" className={styles.annCta}>Learn More</Link>
        </div>
      

        {/* ── Advertisement ── */}
        <div className={styles.adBlock}>
          <div className={styles.adEyebrow}>Sponsored</div>
          <h3>Promote<br />Your<br />Business</h3>
          <p>Online ads for $10 a week; the perfect way to promote your upcoming event, 
            business or service. Only available for locally owned businesses in the Topeka area. 
          </p>
          <a href="/advertise" target="_blank" rel="noopener noreferrer" className={styles.adBtn}>
            Promote
          </a>
          <div className={styles.adDeco}>♪</div>
        </div>
      

        <div className={styles.footerRule} />
        <p className={styles.footerText}>© seveneightfive magazine — Events & times subject to change</p>

      </main>

    </>
  )
}
