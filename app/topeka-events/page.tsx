import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Things to Do in Topeka, KS | Events This Weekend | seveneightfive',
  description: 'Find things to do in Topeka, Kansas this weekend. Live music, art events, family activities, festivals and more — updated daily by seveneightfive magazine.',
}

export const revalidate = 3600

// ── Helpers ──────────────────────────────────────────────────────────
function getNextFirstFridays(count = 3): string[] {
  const results: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let m = 0; results.length < count; m++) {
    const month = new Date(d.getFullYear(), d.getMonth() + m, 1)
    // Find first Friday of that month
    const day = new Date(month)
    day.setDate(1 + ((5 - day.getDay() + 7) % 7))
    const iso = day.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    if (iso >= today) results.push(iso)
  }
  return results
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month:   d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day:     d.getDate(),
    full:    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  }
}

// ── Data fetching ─────────────────────────────────────────────────────
async function getFeaturedEvents() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('events')
    .select('id, title, slug, event_date, event_start_time, image_url, star, venues (name, neighborhood)')
    .gte('event_date', today)
    .eq('star', true)
    .order('event_date', { ascending: true })
    .limit(3)
  return data ?? []
}

async function getNOTOEvents() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('events')
    .select('id, title, slug, event_date, event_start_time, image_url, venues!inner (name, neighborhood)')
    .gte('event_date', today)
    .eq('venues.neighborhood', 'NOTO')
    .order('event_date', { ascending: true })
    .limit(3)
  return data ?? []
}

async function getFirstFridayEvents() {
  const firstFridays = getNextFirstFridays(3)
  const { data } = await supabase
    .from('events')
    .select('id, title, slug, event_date, event_start_time, image_url, venues (name, neighborhood)')
    .in('event_date', firstFridays)
    .order('event_date', { ascending: true })
    .limit(3)
  return data ?? []
}

async function getLiveMusicEvents() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('events')
    .select('id, title, slug, event_date, event_start_time, image_url, venues (name, neighborhood)')
    .gte('event_date', today)
    .overlaps('event_types', ['Live Music', 'Art'])
    .order('event_date', { ascending: true })
    .limit(3)
  return data ?? []
}

async function getFamilyEvents() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('events')
    .select('id, title, slug, event_date, event_start_time, image_url, venues (name, neighborhood)')
    .gte('event_date', today)
    .overlaps('event_types', ['Community / Cultural', 'Workshop / Class', 'Exhibition'])
    .order('event_date', { ascending: true })
    .limit(3)
  return data ?? []
}

// ── Card component ────────────────────────────────────────────────────
function EventCard({ event }: { event: any }) {
  const venue = Array.isArray(event.venues) ? event.venues[0] : event.venues
  const { month, day, weekday } = formatDate(event.event_date)
  return (
    <Link href={`/events/${event.slug}`} className="te-card">
      <div className="te-card-img-wrap">
        {event.image_url
          ? <img src={event.image_url} alt={event.title} loading="lazy" />
          : <div className="te-card-img-placeholder">🎵</div>
        }
        <div className="te-date-badge">
          <span className="te-date-badge-month">{month}</span>
          <span className="te-date-badge-day">{day}</span>
        </div>
      </div>
      <div className="te-card-body">
        <span className="te-card-time">{weekday}{event.event_start_time ? ` · ${event.event_start_time}` : ''}</span>
        <p className="te-card-title">{event.title}</p>
        {venue && <p className="te-card-venue">{venue.name}{venue.neighborhood ? ` · ${venue.neighborhood}` : ''}</p>}
      </div>
    </Link>
  )
}

// ── Section component ─────────────────────────────────────────────────
function Section({
  title, emoji, href, linkLabel, events, emptyMsg,
}: {
  title: string; emoji: string; href: string; linkLabel: string;
  events: any[]; emptyMsg: string;
}) {
  return (
    <div className="te-section">
      <div className="te-section-header">
        <h2 className="te-section-title">
          <span className="te-section-emoji">{emoji}</span>{title}
        </h2>
        <Link href={href} className="te-section-link">{linkLabel} →</Link>
      </div>
      {events.length === 0
        ? <p className="te-empty">{emptyMsg}</p>
        : (
          <div className="te-grid">
            {events.map((e: any) => <EventCard key={e.id} event={e} />)}
          </div>
        )
      }
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────
export default async function TopekaEventsPage() {
  const [featured, noto, firstFriday, liveMusic, family] = await Promise.all([
    getFeaturedEvents(),
    getNOTOEvents(),
    getFirstFridayEvents(),
    getLiveMusicEvents(),
    getFamilyEvents(),
  ])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap');

        /* ── Hero ── */
        .te-hero {
          background: #111; color: #fff;
          padding: 3.5rem 1.25rem 3rem;
          text-align: center;
        }
        .te-hero-eyebrow {
          font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: #888; margin: 0 0 0.75rem;
        }
        .te-hero h1 {
          font-family: 'Oswald', sans-serif;
          font-size: clamp(2.2rem, 6vw, 3.75rem);
          font-weight: 700; letter-spacing: 0.01em;
          text-transform: uppercase; margin: 0 0 1rem;
          color: #fff; line-height: 1.1;
        }
        .te-hero p {
          color: #bbb; font-size: 1rem;
          max-width: 440px; margin: 0 auto 2rem; line-height: 1.6;
        }
        .te-hero-actions {
          display: flex; gap: 0.75rem;
          justify-content: center; flex-wrap: wrap;
        }
        .te-btn-primary {
          display: inline-block; padding: 0.75rem 2rem;
          background: #fff; color: #111; border-radius: 6px;
          text-decoration: none; font-weight: 700;
          font-size: 0.88rem; letter-spacing: 0.04em; text-transform: uppercase;
        }
        .te-btn-secondary {
          display: inline-block; padding: 0.75rem 2rem;
          background: transparent; color: #fff;
          border: 1.5px solid rgba(255,255,255,0.35); border-radius: 6px;
          text-decoration: none; font-weight: 600;
          font-size: 0.88rem; letter-spacing: 0.04em; text-transform: uppercase;
        }

        /* ── Sections ── */
        .te-section {
          max-width: 1100px; margin: 0 auto;
          padding: 2.5rem 1.25rem 0;
        }
        .te-section:last-of-type { padding-bottom: 3rem; }
        .te-section-header {
          display: flex; align-items: baseline;
          justify-content: space-between;
          border-bottom: 2.5px solid #111;
          padding-bottom: 0.6rem; margin-bottom: 1.25rem;
        }
        .te-section-title {
          font-family: 'Oswald', sans-serif;
          font-size: 1.35rem; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase; margin: 0;
          display: flex; align-items: center; gap: 0.4rem;
        }
        .te-section-emoji { font-size: 1.1rem; }
        .te-section-link {
          font-size: 0.8rem; color: #888;
          text-decoration: none; font-weight: 500;
          white-space: nowrap;
        }
        .te-section-link:hover { color: #111; }
        .te-section-divider {
          border: none; border-top: 1px solid #eee;
          margin: 2.5rem 1.25rem 0;
          max-width: 1100px; margin-left: auto; margin-right: auto;
        }

        /* ── Grid ── */
        .te-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
        }

        /* ── Cards ── */
        .te-card {
          text-decoration: none; color: inherit;
          border-radius: 8px; overflow: hidden;
          border: 1px solid #e8e8e8;
          display: flex; flex-direction: column;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .te-card:hover {
          box-shadow: 0 6px 24px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }
        .te-card-img-wrap {
          position: relative; aspect-ratio: 16/10;
          background: #f0f0f0; overflow: hidden;
        }
        .te-card-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .te-card-img-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: #efefef; color: #ccc; font-size: 2rem;
        }
        .te-date-badge {
          position: absolute; top: 10px; left: 10px;
          background: #fff; border-radius: 5px;
          padding: 0.25rem 0.5rem; text-align: center; min-width: 42px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .te-date-badge-month {
          font-size: 0.58rem; font-weight: 700; color: #cc0000;
          letter-spacing: 0.06em; display: block; text-transform: uppercase;
        }
        .te-date-badge-day {
          font-size: 1.1rem; font-weight: 800; color: #111; line-height: 1; display: block;
        }
        .te-card-body {
          padding: 0.9rem 1rem 1rem; flex: 1;
          display: flex; flex-direction: column; gap: 4px;
        }
        .te-card-time {
          font-size: 0.72rem; color: #999;
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .te-card-title {
          font-family: 'Oswald', sans-serif;
          font-size: 1.05rem; font-weight: 600;
          line-height: 1.25; margin: 0; text-transform: uppercase;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .te-card-venue { font-size: 0.8rem; color: #777; margin: 0; }
        .te-empty { color: #bbb; font-size: 0.9rem; padding: 1rem 0; }

        /* ── Footer ── */
        .te-seo-footer {
          background: #f7f7f5; border-top: 1px solid #e8e8e8;
          padding: 3rem 1.25rem; text-align: center; margin-top: 3rem;
        }
        .te-seo-footer p {
          max-width: 680px; margin: 0 auto 1.5rem;
          color: #999; font-size: 0.85rem; line-height: 1.85;
        }
        .te-add-event-btn {
          display: inline-block; padding: 0.8rem 2.25rem;
          background: #111; color: #fff; border-radius: 6px;
          text-decoration: none; font-weight: 700;
          font-size: 0.875rem; letter-spacing: 0.05em; text-transform: uppercase;
          transition: background 0.15s;
        }
        .te-add-event-btn:hover { background: #333; }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .te-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
          }
          .te-card-body { padding: 0.65rem 0.75rem 0.75rem; }
          .te-card-title { font-size: 0.9rem; }
        }
        @media (max-width: 420px) {
          .te-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── HERO ── */}
      <div className="te-hero">
        <p className="te-hero-eyebrow">Topeka, Kansas · 785</p>
        <h1>Your daily guide to<br />events, live music,<br />art and more</h1>
        <div className="te-hero-actions">
          <Link href="/events" className="te-btn-primary">Browse Events</Link>
          <Link href="https://seveneightfive.fillout.com/add-event" className="te-btn-secondary" target="_blank" rel="noopener noreferrer">+ Add Your Event</Link>
        </div>
      </div>

      {/* ── OUR PICKS ── */}
      {featured.length > 0 && (
        <Section
          title="Our Picks"
          emoji="★"
          href="/events"
          linkLabel="All events"
          events={featured}
          emptyMsg="Check back soon for our featured picks."
        />
      )}

      <hr className="te-section-divider" />

      {/* ── NOTO ── */}
      <Section
        title="In NOTO"
        emoji="🎨"
        href="/venues?neighborhood=NOTO"
        linkLabel="All NOTO events"
        events={noto}
        emptyMsg="No upcoming NOTO events found."
      />

      <hr className="te-section-divider" />

      {/* ── FIRST FRIDAY ── */}
      <Section
        title="First Friday"
        emoji="🖼️"
        href="/events"
        linkLabel="See all"
        events={firstFriday}
        emptyMsg="First Friday events coming soon."
      />

      <hr className="te-section-divider" />

      {/* ── LIVE MUSIC ── */}
      <Section
        title="Live Music"
        emoji="🎸"
        href="/live-music"
        linkLabel="Full concert calendar"
        events={liveMusic}
        emptyMsg="No upcoming live music found."
      />

      <hr className="te-section-divider" />

      {/* ── FAMILY ── */}
      <Section
        title="Family & Community"
        emoji="👨‍👩‍👧"
        href="/events"
        linkLabel="See all"
        events={family}
        emptyMsg="No upcoming family events found."
      />

      {/* ── SEO FOOTER ── */}
      <div className="te-seo-footer">
        <p>
          seveneightfive magazine has been covering things to do in Topeka, Kansas since 2006.
          From live music in NOTO to First Friday ArtWalk and hidden experiences.
          Theatre performances and community festivals — the most complete calendar
          of Topeka events, updated daily.
        </p>
        <Link
          href="https://seveneightfive.fillout.com/add-event"
          className="te-add-event-btn"
          target="_blank"
          rel="noopener noreferrer"
        >
          + Add Your Event
        </Link>
      </div>
    </>
  )
}
