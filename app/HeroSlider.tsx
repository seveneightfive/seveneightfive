'use client'

import { useState, useEffect, useCallback } from 'react'

export type HeroSlide = {
  id: string
  order: number
  eyebrow: string | null
  headline: string
  body: string | null
  button_label: string | null
  button_url: string | null
  image_url: string | null
}

export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => {
    setCurrent(c => (c + 1) % slides.length)
  }, [slides.length])

  const prev = () => setCurrent(c => (c - 1 + slides.length) % slides.length)

  useEffect(() => {
    if (paused || slides.length <= 1) return
    const id = setTimeout(next, 6000)
    return () => clearTimeout(id)
  }, [current, paused, next, slides.length])

  if (!slides.length) return null

  return (
    <>
      <style>{`
        .hs-wrap {
          position: relative;
          width: 100vw;
          margin-left: calc(50% - 50vw);
          height: 88vh;
          min-height: 520px;
          overflow: hidden;
          background: #0A0A0A;
        }

        .hs-slide {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 1s ease;
          pointer-events: none;
        }

        .hs-slide.hs-active {
          opacity: 1;
          pointer-events: auto;
        }

        .hs-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
        }

        .hs-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(10,10,10,0.88) 0%,
            rgba(10,10,10,0.45) 45%,
            rgba(10,10,10,0.15) 100%
          );
        }

        .hs-content {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 56px 40px;
        }

        .hs-headline {
          font-family: 'Oswald', sans-serif;
          font-size: clamp(2.8rem, 7vw, 5.5rem);
          font-weight: 700;
          color: #ffffff;
          text-transform: uppercase;
          line-height: 1;
          letter-spacing: -1.5px;
          margin-bottom: 16px;
          text-shadow: 0 2px 16px rgba(0,0,0,0.5);
          max-width: 720px;
        }

        .hs-body {
          font-size: 1rem;
          font-weight: 300;
          color: rgba(255,255,255,0.78);
          line-height: 1.6;
          max-width: 480px;
          margin-bottom: 28px;
          text-shadow: 0 1px 6px rgba(0,0,0,0.6);
        }

        .hs-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #FFCE03;
          color: #0A0A0A;
          font-family: 'Oswald', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 14px 30px;
          text-decoration: none;
          width: fit-content;
          transition: background 0.15s, color 0.15s;
        }

        .hs-btn:hover {
          background: #C80650;
          color: #ffffff;
        }

        .hs-dots {
          position: absolute;
          bottom: 28px;
          right: 40px;
          display: flex;
          gap: 8px;
          z-index: 10;
          align-items: center;
        }

        .hs-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,0.35);
          border: none;
          cursor: pointer;
          padding: 0;
          transition: background 0.25s, transform 0.25s;
        }

        .hs-dot.hs-dot-active {
          background: #FFCE03;
          transform: scale(1.4);
        }

        .hs-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 48px;
          border: 1.5px solid rgba(255,255,255,0.35);
          background: rgba(0,0,0,0.25);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: background 0.2s, border-color 0.2s;
          backdrop-filter: blur(4px);
        }

        .hs-arrow:hover {
          background: rgba(0,0,0,0.55);
          border-color: rgba(255,255,255,0.8);
        }

        .hs-prev { left: 24px; }
        .hs-next { right: 24px; }

        .hs-count {
          position: absolute;
          bottom: 28px;
          left: 40px;
          font-family: 'Oswald', sans-serif;
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 3px;
          color: rgba(255,255,255,0.4);
          z-index: 10;
        }

        @media (max-width: 640px) {
          .hs-wrap {
            height: 72vh;
            min-height: 420px;
          }
          .hs-content {
            padding: 36px 20px;
          }
          .hs-arrow {
            display: none;
          }
          .hs-dots {
            right: 20px;
            bottom: 20px;
          }
          .hs-count {
            left: 20px;
            bottom: 20px;
          }
        }
      `}</style>

      <section
        className="hs-wrap"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-label="Hero slideshow"
      >
        {slides.map((slide, i) => (
          <div key={slide.id} className={`hs-slide${i === current ? ' hs-active' : ''}`}>
            {slide.image_url && (
              <img src={slide.image_url} alt="" className="hs-img" aria-hidden="true" />
            )}
            <div className="hs-overlay" />
            <div className="hs-content">
              <h1 className="hs-headline">{slide.headline}</h1>
              {slide.body && <p className="hs-body">{slide.body}</p>}
              {slide.button_label && slide.button_url && (
                <a href={slide.button_url} className="hs-btn">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  {slide.button_label}
                </a>
              )}
            </div>
          </div>
        ))}

        {/* Slide counter */}
        {slides.length > 1 && (
          <div className="hs-count" aria-hidden="true">
            {String(current + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </div>
        )}

        {/* Dots */}
        {slides.length > 1 && (
          <div className="hs-dots" role="tablist" aria-label="Slides">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`hs-dot${i === current ? ' hs-dot-active' : ''}`}
                onClick={() => setCurrent(i)}
                role="tab"
                aria-selected={i === current}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Arrows */}
        {slides.length > 1 && (
          <>
            <button className="hs-arrow hs-prev" onClick={prev} aria-label="Previous slide">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button className="hs-arrow hs-next" onClick={next} aria-label="Next slide">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        )}
      </section>
    </>
  )
}
