'use client'

// Home page event rails.
//
// Desktop (≥768px): one "Upcoming Events" header with clickable tabs,
//   prev/next arrows and a progress bar; only the active tab's rail shows.
// Mobile: no tab bar — every tab renders as its own horizontal-scroll
//   rail with its own heading, stacked one after another.
//
// Both layouts come from the same markup and are switched with CSS only,
// so there's no hydration mismatch or flash while the page loads.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import SpotlightCard, { type SpotlightEvent } from './SpotlightCard'

export type EventTab = {
  key: string
  label: string
  href: string
  events: SpotlightEvent[]
}

export default function EventTabs({
  heading = 'Upcoming Events',
  tabs,
}: {
  heading?: string
  tabs: EventTab[]
}) {
  const visibleTabs = tabs.filter(t => t.events.length > 0)
  const [active, setActive] = useState(visibleTabs[0]?.key)
  const [progress, setProgress] = useState({ start: 0, size: 1, canPrev: false, canNext: false })
  const tracks = useRef<Record<string, HTMLDivElement | null>>({})

  const measure = useCallback(() => {
    const el = active ? tracks.current[active] : null
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const size = el.scrollWidth > 0 ? el.clientWidth / el.scrollWidth : 1
    const pos = max > 0 ? el.scrollLeft / max : 0
    setProgress({
      start: pos * (1 - size),
      size: Math.min(size, 1),
      canPrev: el.scrollLeft > 4,
      canNext: el.scrollLeft < max - 4,
    })
  }, [active])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const scrollBy = (dir: 1 | -1) => {
    const el = active ? tracks.current[active] : null
    if (!el) return
    const slot = el.querySelector<HTMLElement>('.et-slot')
    const step = slot ? slot.offsetWidth + 24 : el.clientWidth * 0.8
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  if (!visibleTabs.length) return null

  return (
    <div className="et">
      <style>{`
        .et-head, .et-tabbar, .et-progress { display: none; }
        .et-panel-head {
          display: flex; align-items: baseline; justify-content: space-between;
          padding: 40px 0 14px;
        }
        .et-panel-head h2 {
          font-family: 'Oswald', sans-serif; font-size: 26px; font-weight: 700;
          letter-spacing: -0.5px; text-transform: uppercase;
        }
        .et-panel-head a {
          font-family: 'Oswald', sans-serif; font-size: 13px; font-weight: 500;
          letter-spacing: 2px; text-transform: uppercase; color: #C80650; text-decoration: none;
        }

        /* Rail: starts aligned with the page content, bleeds off the right edge. */
        .et-track {
          display: flex; gap: 16px;
          overflow-x: auto; scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch; scrollbar-width: none;
          margin-right: calc(50% - 50vw);
          padding-bottom: 4px;
        }
        .et-track::-webkit-scrollbar { display: none; }
        .et-slot { flex: 0 0 80vw; scroll-snap-align: start; }
        .et-end {
          flex: 0 0 auto; display: flex; align-items: center;
          padding: 0 24px 0 8px; scroll-snap-align: end;
        }
        .et-all {
          display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;
          background: #C80650; color: #fff; border-radius: 999px;
          padding: 14px 26px; font-family: 'Oswald', sans-serif; font-weight: 700;
          font-size: 15px; letter-spacing: 1.5px; text-transform: uppercase;
          text-decoration: none; transition: background .2s;
        }
        .et-all:hover { background: #a00440; }

        @media (min-width: 768px) {
          .et-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 56px 0 8px;
          }
          .et-head h2 {
            font-family: 'Oswald', sans-serif; font-size: 34px; font-weight: 700;
            letter-spacing: -0.5px; text-transform: uppercase;
          }
          .et-arrows { display: flex; gap: 12px; }
          .et-arrow {
            width: 44px; height: 44px; border-radius: 999px; border: 1.5px solid #111;
            display: grid; place-items: center; background: #fff; color: #111;
            cursor: pointer; transition: opacity .2s;
          }
          .et-arrow:disabled { opacity: .3; cursor: default; }
          .et-tabbar { display: flex; gap: 8px; margin-bottom: 24px; }
          .et-tab {
            padding: 10px 16px; font-weight: 700; font-size: 17px; color: #777;
            border-bottom: 3px solid transparent; background: none; cursor: pointer;
          }
          .et-tab[aria-selected="true"] { color: #111; border-bottom-color: #C80650; }
          .et-panel-head { display: none; }
          .et-panel[data-active="false"] { display: none; }
          .et-track { gap: 24px; }
          .et-slot { flex-basis: clamp(300px, 33vw, 440px); }
          .et-end { padding: 0 64px 0 24px; }
          .et-progress {
            display: block; position: relative; height: 3px; background: #ddd;
            margin-top: 28px;
          }
          .et-progress span { position: absolute; top: 0; height: 100%; background: #C80650; transition: left .15s, width .15s; }
        }
      `}</style>

      {/* Desktop header */}
      <div className="et-head">
        <h2>{heading}</h2>
        <div className="et-arrows">
          <button className="et-arrow" onClick={() => scrollBy(-1)} disabled={!progress.canPrev} aria-label="Previous events">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button className="et-arrow" onClick={() => scrollBy(1)} disabled={!progress.canNext} aria-label="Next events">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      {/* Desktop tab bar */}
      <div className="et-tabbar" role="tablist">
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            role="tab"
            id={`et-tab-${tab.key}`}
            aria-controls={`et-panel-${tab.key}`}
            aria-selected={tab.key === active}
            className="et-tab"
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visibleTabs.map(tab => (
        <div
          key={tab.key}
          id={`et-panel-${tab.key}`}
          className="et-panel"
          data-active={tab.key === active}
          aria-labelledby={`et-tab-${tab.key}`}
        >
          {/* Mobile-only heading */}
          <div className="et-panel-head">
            <h2>{tab.label}</h2>
            <Link href={tab.href}>All →</Link>
          </div>

          <div
            className="et-track"
            ref={el => { tracks.current[tab.key] = el }}
            onScroll={tab.key === active ? measure : undefined}
          >
            {tab.events.slice(0, 6).map(event => (
              <div key={event.id} className="et-slot">
                <SpotlightCard event={event} />
              </div>
            ))}
            <div className="et-end">
              <Link href={tab.href} className="et-all">
                All Events
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            </div>
          </div>
        </div>
      ))}

      {/* Desktop progress bar for the active rail */}
      <div className="et-progress" aria-hidden="true">
        <span style={{ left: `${progress.start * 100}%`, width: `${progress.size * 100}%` }} />
      </div>
    </div>
  )
}
