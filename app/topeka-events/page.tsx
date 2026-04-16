import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Things to Do in Topeka, KS | Events This Weekend | seveneightfive',
  description: 'Find things to do in Topeka, Kansas this weekend. Live music, art events, family activities, festivals and more — updated daily by seveneightfive magazine.',
}

// Revalidate every hour so events stay fresh
export const revalidate = 3600

async function getUpcomingEvents() {
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('events')
    .select(`
      id, title, slug, event_date, event_start_time, image_url, event_types,
      venues (name, neighborhood)
    `)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(24)

  return data ?? []
}

export default async function TopekaEventsPage() {
  const events = await getUpcomingEvents()

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>

      {/* SEO-rich intro — this is what Google reads */}
      <h1 style={{ fontSize: '2rem', fontWeight: 500, marginBottom: '0.5rem' }}>
        Things to Do in Topeka, KS
      </h1>
      <p style={{ color: '#888', marginBottom: '0.5rem', lineHeight: 1.7 }}>
        Updated daily with the best events happening in Topeka, Kansas —
        live music, art shows, family events, festivals, and more.
        Your local guide to what&apos;s happening in the 785 this week and weekend.
      </p>

      {/* Category quick links — good for internal linking + UX */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1.5rem 0' }}>
        {[
          { label: 'Live Music', href: '/live-music' },
          { label: 'Art & Galleries', href: '/topeka-art-galleries' },
          { label: 'All Events', href: '/events' },
          { label: 'Venues', href: '/venues' },
          { label: 'First Friday', href: '/events?category=Art' },
          { label: 'Family Events', href: '/events' },
        ].map((cat) => (
          <Link key={cat.href + cat.label} href={cat.href} style={{
            padding: '0.4rem 1rem',
            border: '1px solid #ddd',
            borderRadius: '999px',
            textDecoration: 'none',
            color: 'inherit',
            fontSize: '0.9rem',
          }}>
            {cat.label}
          </Link>
        ))}
      </div>

      {/* Upcoming events grid */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 500, margin: '2rem 0 1rem' }}>
        Upcoming Events in Topeka
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '1.25rem',
      }}>
        {events.map((event: any) => {
          const venue = Array.isArray(event.venues) ? event.venues[0] : event.venues
          const date = new Date(event.event_date + 'T12:00:00')
          const formatted = date.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric'
          })

          return (
            <Link key={event.id} href={`/events/${event.slug}`} style={{
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid #eee',
              borderRadius: '10px',
              overflow: 'hidden',
              display: 'block',
            }}>
              {event.image_url && (
                <img
                  src={event.image_url}
                  alt={event.title}
                  style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                />
              )}
              <div style={{ padding: '0.75rem 1rem' }}>
                <p style={{ fontSize: '0.8rem', color: '#888', margin: '0 0 4px' }}>
                  {formatted}{event.event_start_time ? ` · ${event.event_start_time}` : ''}
                </p>
                <p style={{ fontWeight: 500, margin: '0 0 4px', fontSize: '0.95rem' }}>
                  {event.title}
                </p>
                {venue && (
                  <p style={{ fontSize: '0.82rem', color: '#888', margin: 0 }}>
                    {venue.name}{venue.neighborhood ? ` · ${venue.neighborhood}` : ''}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Bottom CTA */}
      <div style={{ textAlign: 'center', margin: '3rem 0 1rem' }}>
        <Link href="/events" style={{
          padding: '0.75rem 2rem',
          border: '1px solid #333',
          borderRadius: '8px',
          textDecoration: 'none',
          color: 'inherit',
          fontWeight: 500,
        }}>
          See all Topeka events →
        </Link>
      </div>

      {/* Footer SEO text */}
      <p style={{ color: '#aaa', fontSize: '0.82rem', lineHeight: 1.7, marginTop: '2rem' }}>
        seveneightfive magazine has been covering things to do in Topeka, Kansas since 2006.
        From live music at NOTO and the Midtown Strip to First Friday ArtWalk,
        Topeka Zoo events, Washburn University performances, and community festivals —
        we keep the most complete calendar of Topeka events updated daily.
      </p>

    </main>
  )
}
