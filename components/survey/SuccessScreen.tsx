'use client'

import { useEffect, useState } from 'react'

const CONFETTI_COLORS = ['#FFCE03', '#C80650', '#ffffff']

export default function SuccessScreen({ message }: { message: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(t)
  }, [])

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden text-center">
      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute top-0 rounded-full opacity-0"
            style={{
              left: `${(i * 41) % 100}%`,
              width: 6 + (i % 3) * 2,
              height: 6 + (i % 3) * 2,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animation: show ? `survey-confetti-fall 2.4s ease-in ${(i % 8) * 0.12}s forwards` : 'none',
            }}
          />
        ))}
      </div>

      <div
        className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-500 transition-all duration-500 ease-out"
        style={{
          transform: show ? 'scale(1)' : 'scale(0)',
          opacity: show ? 1 : 0,
        }}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h1
        className="mt-8 font-display text-2xl font-semibold text-white transition-all duration-500 ease-out"
        style={{
          transform: show ? 'translateY(0)' : 'translateY(8px)',
          opacity: show ? 1 : 0,
          transitionDelay: '150ms',
        }}
      >
        Thank you!
      </h1>
      <p
        className="mt-3 max-w-xs text-base leading-relaxed text-white/70 transition-all duration-500 ease-out"
        style={{
          transform: show ? 'translateY(0)' : 'translateY(8px)',
          opacity: show ? 1 : 0,
          transitionDelay: '250ms',
        }}
      >
        {message}
      </p>

      <style>{`
        @keyframes survey-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(70vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
