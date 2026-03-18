'use client'

export type FeaturedEvent = {
  id: string
  title: string
  event_date: string
  event_start_time: string | null
  event_types: string[] | null
  slug: string | null
  image_url: string | null
  ticket_url: string | null
  venue: { name: string; neighborhood: string | null } | null
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(t: string | null): string {
  if (!t || t.trim() === ':') return ''
  const ampmMatch = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i)
  if (ampmMatch) {
    const h = parseInt(ampmMatch[1], 10)
    const m = parseInt(ampmMatch[2], 10)
    const ampm = ampmMatch[3].toUpperCase() === 'PM' ? 'PM' : 'AM'
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
  }
  const match = t.match(/(\d{1,2}):(\d{2})/)
  if (!match) return ''
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default function FeaturedSlider({ events }: { events: FeaturedEvent[] }) {
  if (!events.length) return null

  return (
    <>
      <style>{`
        .feat-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 0 20px;
        }
        .feat-card {
          position: relative;
          border-radius: 6px;
          overflow: hidden;
          aspect-ratio: 4/3;
          text-decoration: none;
          display: block;
          background: #0A0A0A;
        }
        .feat-card:first-child {
          grid-column: span 2;
          aspect-ratio: 16/9;
        }
        .feat-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.72;
          transition: transform 0.5s ease, opacity 0.3s;
          display: block;
        }
        .feat-card:hover .feat-img {
          transform: scale(1.04);
          opacity: 0.6;
        }
        .feat-no-img {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #1a1a1a, #3a3530);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Oswald', sans-serif;
          font-size: 4rem;
          font-weight: 700;
          color: rgba(255,255,255,0.05);
          text-transform: uppercase;
        }
        .feat-overlay {
          position: absolute;
          inset: 0;
          /* Stronger gradient — text always readable */
          background: linear-gradient(
            to top,
            rgba(10,10,10,0.95) 0%,
            rgba(10,10,10,0.5) 40%,
            transparent 70%
          );
          padding: 14px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .feat-type {
          font-family: 'Oswald', sans-serif;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #FFCE03;
          margin-bottom: 4px;
        }
        .feat-title {
          font-family: 'Oswald', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.15;
          text-transform: uppercase;
          letter-spacing: 0.01em;
          /* Text shadow for extra legibility on any image */
          text-shadow: 0 1px 4px rgba(0,0,0,0.8);
        }
        .feat-card:first-child .feat-title {
          font-size: 1.25rem;
        }
        .feat-meta {
          font-size: 11px;
          color: rgba(255,255,255,0.65);
          margin-top: 4px;
          font-weight: 300;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        }
        .feat-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          background: #C80650;
          color: white;
          font-family: 'Oswald', sans-serif;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          padding: 3px 8px;
        }

        /* Mobile: single column scroll */
        @media (max-width: 640px) {
          .feat-grid {
            display: flex;
            flex-direction: row;
            overflow-x: auto;
            scrollbar-width: none;
            gap: 10px;
            padding: 0 20px;
            /* Snap scrolling */
            scroll-snap-type: x mandatory;
          }
          .feat-grid::-webkit-scrollbar { display: none; }
          .feat-card {
            flex: 0 0 82vw;
            aspect-ratio: 4/3;
            scroll-snap-align: start;
            border-radius: 6px;
          }
          .feat-card:first-child {
            flex: 0 0 82vw;
            aspect-ratio: 4/3;
            grid-column: unset;
          }
        }

        @media (min-width: 641px) and (max-width: 900px) {
          .feat-grid {
            grid-template-columns: repeat(2, 1fr);
            padding: 0 40px;
          }
          .feat-card:first-child {
            grid-column: span 2;
          }
        }

        @media (min-width: 901px) {
          .feat-grid {
            padding: 0 40px;
          }
        }
      `}</style>

      <div className="feat-grid">
        {events.map(event => {
          const href = event.slug ? `/events/${event.slug}` : event.ticket_url || '#'
          const isExternal = !event.slug
          return (
            
              key={event.id}
              href={href}
              target={isExternal ? '_blank' : '_self'}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="feat-card"
            >
              {event.image_url
                ? <img src={event.image_url} alt={event.title} className="feat-img" />
                : <div className="feat-no-img">{event.title[0]}</div>
              }
              <div className="feat-overlay">
                {event.event_types?.[0] && (
                  <div className="feat-type">{event.event_types[0]}</div>
                )}
                <div className="feat-title">{event.title}</div>
                <div className="feat-meta">
                  {formatDate(event.event_date)}
                  {event.event_start_time && ` · ${formatTime(event.event_start_time)}`}
                  {event.venue && ` · ${event.venue.name}`}
                </div>
              </div>
              <div className="feat-badge">★ Featured</div>
            </a>
          )
        })}
      </div>
    </>
  )
}