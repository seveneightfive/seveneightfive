'use client'

import { useState } from 'react'

export default function RatingStars({
  value,
  onChange,
  size = 40,
}: {
  value: number
  onChange: (rating: number) => void
  size?: number
}) {
  const [hover, setHover] = useState(0)
  const active = hover || value

  return (
    <div className="flex items-center justify-center gap-2" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="p-1 transition-transform duration-150 active:scale-90"
          style={{ transform: active >= n ? 'scale(1.08)' : 'scale(1)' }}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={active >= n ? '#FFCE03' : 'none'}
            stroke={active >= n ? '#FFCE03' : '#d0d0d0'}
            strokeWidth={1.5}
          >
            <path
              d="M12 2.5l2.9 6.24 6.6.6-5 4.5 1.5 6.66L12 17l-5.9 3.5 1.5-6.66-5-4.5 6.6-.6L12 2.5z"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  )
}
