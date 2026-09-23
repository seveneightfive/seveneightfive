'use client'

// "Explore our Archives" reveal.
//
// A pink circle with the 785 logo sits inside two sets of arcs. As the
// visitor scrolls through the section the arcs spin like a record, spread
// apart and fade, and the circle grows until it uncovers the archive panel
// (cover, story callout, CTA).
//
// How it works: the section is taller than the screen and the stage is
// `position: sticky`, so it stays put while you scroll through it. Scroll
// position inside the section becomes a 0→1 progress value, and every
// moving part is a function of that value, so scrolling back up plays it
// in reverse. Styles are written straight to DOM refs inside a single
// requestAnimationFrame, so React doesn't re-render on scroll.
//
// With "reduce motion" turned on, the section renders the finished panel
// at normal height and nothing animates.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Logo785 from './Logo785'

export type ArchiveRevealIssue = {
  issue_number: number | null
  title: string
  cover_image_url: string
  callout: { headline: string; teaser: string } | null
}

// ── Arc geometry (drawn once, in a 640×360 coordinate space) ──
const CX = 320
const CY = 180
const RADII = Array.from({ length: 20 }, (_, i) => 74 + i * 9)

function arcPath(r: number, fromDeg: number, toDeg: number) {
  const a0 = (fromDeg * Math.PI) / 180
  const a1 = (toDeg * Math.PI) / 180
  const x0 = (CX + r * Math.cos(a0)).toFixed(1)
  const y0 = (CY + r * Math.sin(a0)).toFixed(1)
  const x1 = (CX + r * Math.cos(a1)).toFixed(1)
  const y1 = (CY + r * Math.sin(a1)).toFixed(1)
  return `M${x0},${y0}A${r},${r} 0 0 1 ${x1},${y1}`
}

const RIGHT_ARCS = RADII.map(r => ({ d: arcPath(r, -55, 55), w: r < 150 ? 3.5 : 4.5 }))
const LEFT_ARCS = RADII.map(r => ({ d: arcPath(r, 125, 235), w: r < 150 ? 3.5 : 4.5 }))

// ── Timeline helpers ──
const clamp = (x: number) => Math.max(0, Math.min(1, x))
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const range = (p: number, start: number, end: number) => clamp((p - start) / (end - start))

export default function ArchiveReveal({ issue }: { issue: ArchiveRevealIssue }) {
  const [reduced, setReduced] = useState(false)

  const sectionRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<SVGGElement>(null)
  const rightRef = useRef<SVGGElement>(null)
  const coverRef = useRef<HTMLAnchorElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (reduced) return

    let frame = 0

    const render = () => {
      frame = 0
      const section = sectionRef.current
      const stage = stageRef.current
      if (!section || !stage) return

      // 0 when the section's top reaches the top of the screen,
      // 1 when its bottom reaches the bottom of the screen.
      const rect = section.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      const p = travel > 0 ? clamp(-rect.top / travel) : 1

      const w = stage.clientWidth
      const h = stage.clientHeight
      const r0 = Math.min(w, h) * 0.16
      const r1 = Math.hypot(w / 2, h / 2) + 2

      const spin = ease(range(p, 0, 0.55)) * 180
      const spread = ease(range(p, 0.35, 0.75))
      const grow = ease(range(p, 0.4, 0.9))

      // Spin, then push the arcs outward by scaling them up around the
      // centre. Scaling (rather than sliding left/right) moves every arc
      // away from the logo no matter how far it has rotated.
      const scale = 1 + spread * 1.6
      const arcTransform = `translate(${CX} ${CY}) scale(${scale}) rotate(${spin}) translate(${-CX} ${-CY})`
      leftRef.current?.setAttribute('transform', arcTransform)
      rightRef.current?.setAttribute('transform', arcTransform)
      if (leftRef.current) leftRef.current.style.opacity = String(1 - spread)
      if (rightRef.current) rightRef.current.style.opacity = String(1 - spread)

      const radius = r0 + (r1 - r0) * grow
      const panel = panelRef.current
      if (panel) {
        const clip = `circle(${radius.toFixed(1)}px at 50% 50%)`
        panel.style.clipPath = clip
        // Older iOS Safari only honours the prefixed property.
        panel.style.setProperty('-webkit-clip-path', clip)
      }

      if (badgeRef.current) {
        const size = 2 * r0 * (1 + grow * 0.4)
        badgeRef.current.style.width = `${size}px`
        badgeRef.current.style.height = `${size}px`
        badgeRef.current.style.opacity = String(1 - range(p, 0.42, 0.56))
      }

      if (coverRef.current) coverRef.current.style.opacity = String(range(p, 0.48, 0.7))
      if (copyRef.current) {
        const t = range(p, 0.66, 0.9)
        copyRef.current.style.opacity = String(t)
        copyRef.current.style.transform = `translateY(${(1 - t) * 14}px)`
      }
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render)
    }

    render()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [reduced])

  const href = issue.issue_number ? `/magazine?issue=${issue.issue_number}` : '/magazine'
  const headline = issue.callout?.headline ?? issue.title
  const teaser = issue.callout?.teaser ?? `From ${issue.title} — flip through this one.`

  return (
    <div ref={sectionRef} className={`ar ${reduced ? 'ar--static' : ''}`}>
      <style>{`
        .ar { position: relative; height: 200vh; }
        .ar--static { height: auto; }
        .ar-sticky {
          position: -webkit-sticky; position: sticky; top: 0;
          height: 100vh; height: 100svh; /* svh: the visible height with the mobile toolbar showing */
          display: flex; align-items: center;
        }
        .ar--static .ar-sticky { position: static; height: auto; }
        .ar-stage {
          position: relative; width: 100%;
          aspect-ratio: 16 / 9; max-height: 80vh;
          border-radius: 12px; overflow: hidden; background: #fff;
        }
        .ar-panel {
          position: absolute; inset: 0; background: #1a1814;
          display: flex; align-items: center; gap: 6%; padding: 0 8%;
          -webkit-clip-path: circle(12% at 50% 50%);
          clip-path: circle(12% at 50% 50%); /* start state before JS runs */
          will-change: clip-path; transform: translateZ(0); /* Safari repaints clip-path changes reliably on its own layer */
        }
        .ar--static .ar-panel { -webkit-clip-path: none !important; clip-path: none !important; }
        .ar-cover { flex: 0 0 26%; display: block; }
        .ar-cover img {
          width: 100%; aspect-ratio: 4 / 5; object-fit: cover;
          border-radius: 4px; display: block;
        }
        .ar-copy { flex: 1; color: #fff; }
        .ar:not(.ar--static) .ar-cover, .ar:not(.ar--static) .ar-copy { opacity: 0; }
        .ar-eyebrow {
          font-family: 'Oswald', sans-serif; font-size: 12px; letter-spacing: 2px;
          text-transform: uppercase; color: #FFCE03; margin-bottom: 8px;
        }
        .ar-headline {
          font-family: 'Oswald', sans-serif; font-weight: 700; text-transform: uppercase;
          font-size: clamp(24px, 3.4vw, 48px); line-height: 1.05; margin-bottom: 12px;
        }
        .ar-teaser { font-size: 16px; line-height: 1.5; color: rgba(255,255,255,.75); margin-bottom: 22px; max-width: 34em; }
        .ar-cta {
          display: inline-flex; align-items: center; gap: 8px;
          background: #C80650; color: #fff; border-radius: 999px; padding: 13px 26px;
          font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 15px;
          letter-spacing: 1.5px; text-transform: uppercase; text-decoration: none;
          transition: background .2s;
        }
        .ar-cta:hover { background: #a00440; }
        .ar-badge {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          width: 18%; aspect-ratio: 1; /* start size before JS runs */
          border-radius: 50%; background: #C80650; color: #fff;
          display: grid; place-items: center; pointer-events: none;
        }
        .ar-badge svg { width: 58%; height: auto; }
        .ar--static .ar-badge, .ar--static .ar-arcs { display: none; }
        .ar-arcs { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }

        @media (max-width: 767px) {
          .ar { height: 170vh; }
          .ar-stage { aspect-ratio: 4 / 5; max-height: 82vh; }
          .ar-badge { width: 32%; }
          .ar-panel { flex-direction: column; justify-content: center; text-align: center; gap: 18px; padding: 8% 8%; }
          .ar-cover { flex: 0 0 auto; width: 42%; }
          .ar-teaser { margin-left: auto; margin-right: auto; font-size: 15px; }
        }
      `}</style>

      <div className="ar-sticky">
        <div ref={stageRef} className="ar-stage">
          <div ref={panelRef} className="ar-panel">
            <Link ref={coverRef} href={href} className="ar-cover" aria-label={`Read ${issue.title}`}>
              <img src={issue.cover_image_url} alt={issue.title} loading="lazy" />
            </Link>
            <div ref={copyRef} className="ar-copy">
              <div className="ar-eyebrow">
                From the archives{issue.issue_number ? ` · Issue ${issue.issue_number}` : ''}
              </div>
              <div className="ar-headline">{headline}</div>
              <p className="ar-teaser">{teaser}</p>
              <Link href={href} className="ar-cta">
                Read the issue
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            </div>
          </div>

          <div ref={badgeRef} className="ar-badge" aria-hidden="true">
            <Logo785 />
          </div>

          <svg className="ar-arcs" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <g ref={leftRef}>
              {LEFT_ARCS.map((a, i) => <path key={i} d={a.d} fill="none" stroke="#C80650" strokeWidth={a.w} />)}
            </g>
            <g ref={rightRef}>
              {RIGHT_ARCS.map((a, i) => <path key={i} d={a.d} fill="none" stroke="#C80650" strokeWidth={a.w} />)}
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}
