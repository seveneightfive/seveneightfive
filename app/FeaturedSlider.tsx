'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

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
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef(0)

  const next = useCallback(() => setActive(i => (i + 1) % events.length), [events.length])
  const prev = useCallback(() => setActive(i => (i - 1 + events.length) % events.length), [events.length])

  useEffect(() => {
    if (paused || events.length <= 1) return
    const id = setInterval(next, 5000)
    return () => clearInterval(id)
  }, [paused, events.length, next])

  if (!events.length) return null

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev()
  }

  return (
    <>
      <style>{`
        .slider-wrap {
          position: relative;
          overflow: hidden;
          aspect-ratio: 16/9;
          background: #0A0A0A;
          max-height: 480px;
        }
        .slider-slide {
          position: absolute;
          inset: 0;
          display: block;
          text-decoration: none;
          transition: opacity 0.55s ease;
        }
        .slider-slide img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          opacity: 0.72;
        }
        .slider-no-img {
          width: 100%; height: 100%;
          background: linear-gradient(135deg, #2a2620, #1a1814);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Oswald', sans-serif;
          font-size: 5rem; font-weight: 700;
          color: rgba(255,255,255,0.05);
          text-transform: uppercase;
        }
        .slider-gradient {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.25) 55%, transparent 100%);
        }
        .slider-badge {
          position: absolute; top: 14px; right: 14px;
          background: #C80650; color: #fff;
          font-family: 'Oswald', sans-serif;
          font-size: 10px; font-weight: 600;
          letter-spacing: 1.5px; text-transform: uppercase;
          padding: 4px 10px;
        }
        .slider-content {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 20px 20px 52px;
        }
        .slider-type {
          font-family: 'Oswald', sans-serif;
          font-size: 10px; font-weight: 500;
          letter-spacing: 2px; text-transform: uppercase;
          color: #FFCE03; margin-bottom: 6px;
        }
        .slider-title {
          font-family: 'Oswald', sans-serif;
          font-size: clamp(1.4rem, 5vw, 2rem);
          font-weight: 700; color: #fff;
          text-transform: uppercase; letter-spacing: -0.02em;
          line-height: 1.05; margin-bottom: 6px;
        }
        .slider-meta {
          font-size: 12px; color: rgba(255,255,255,0.55);
          font-weight: 300;
        }
        .slider-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(10,10,10,0.5); border: none; color: #fff;
          width: 36px; height: 36px; cursor: pointer; z-index: 2;
          font-family: 'Oswald', sans-serif; font-size: 22px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .slider-arrow:hover { background: rgba(200,6,80,0.75); }
        .slider-arrow-prev { left: 12px; }
        .slider-arrow-next { right: 12px; }
        .slider-dots {
          position: absolute; bottom: 16px; left: 0; right: 0;
          display: flex; justify-content: center; gap: 6px; z-index: 2;
        }
        .slider-dot {
          height: 5px; border: none; cursor: pointer; padding: 0;
          border-radius: 3px;
          transition: width 0.3s ease, background 0.3s ease;
        }
      `}</style>

      <div
        className="slider-wrap"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {events.map((event, i) => {
          const href = event.slug ? `/events/${event.slug}` : event.ticket_url || '#'
          const isExternal = !event.slug
          return (
            <a
              key={event.id}
              href={href}
              target={isExternal ? '_blank' : '_self'}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="slider-slide"
              style={{ opacity: i === active ? 1 : 0, pointerEvents: i === active ? 'auto' : 'none' }}
            >
              {event.image_url ? (
                <img src={event.image_url} alt={event.title} />
              ) : (
                <div className="slider-no-img">{event.title[0]}</div>
              )}
              <div className="slider-gradient" />
              <div className="slider-badge">★ Featured</div>
              <div className="slider-content">
                {event.event_types?.[0] && (
                  <div className="slider-type">{event.event_types[0]}</div>
                )}
                <div className="slider-title">{event.title}</div>
                <div className="slider-meta">
                  {formatDate(event.event_date)}
                  {event.event_start_time && ` · ${formatTime(event.event_start_time)}`}
                  {event.venue && ` · ${event.venue.name}`}
                </div>
              </div>
            </a>
          )
        })}

        {events.length > 1 && (
          <>
            <button className="slider-arrow slider-arrow-prev" onClick={prev} aria-label="Previous">‹</button>
            <button className="slider-arrow slider-arrow-next" onClick={next} aria-label="Next">›</button>
            <div className="slider-dots">
              {events.map((_, i) => (
                <button
                  key={i}
                  className="slider-dot"
                  onClick={() => setActive(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  style={{
                    width: i === active ? 20 : 6,
                    background: i === active ? '#FFCE03' : 'rgba(255,255,255,0.35)',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
