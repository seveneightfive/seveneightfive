'use client'

import { useState, useRef, useEffect } from 'react'

type Props = {
  title: string
  date: string
  startTime: string | null
  endTime: string | null
  endDate: string | null
  venueName: string | null
  venueAddress: string | null
  description: string | null
  slug: string
}

function toCalStamp(date: string, time: string | null): string {
  const d = date.replace(/-/g, '')
  if (!time) return d
  const parts = time.match(/(\d{1,2}):(\d{2})/)
  if (!parts) return d
  const hh = parts[1].padStart(2, '0')
  const mm = parts[2]
  return `${d}T${hh}${mm}00`
}

export default function AddToCalendar({
  title, date, startTime, endTime, endDate,
  venueName, venueAddress, description, slug,
}: Props) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const start = toCalStamp(date, startTime)
  const end = endTime
    ? toCalStamp(endDate || date, endTime)
    : toCalStamp(date, startTime) // fallback: same as start if no end time

  const location = [venueName, venueAddress].filter(Boolean).join(', ')
  const details = description ? description.substring(0, 500) : ''

  const googleUrl = (() => {
    const u = new URL('https://calendar.google.com/calendar/render')
    u.searchParams.set('action', 'TEMPLATE')
    u.searchParams.set('text', title)
    u.searchParams.set('dates', `${start}/${end}`)
    if (details) u.searchParams.set('details', details)
    if (location) u.searchParams.set('location', location)
    return u.toString()
  })()

  const outlookUrl = (() => {
    const u = new URL('https://outlook.office.com/calendar/0/deeplink/compose')
    u.searchParams.set('subject', title)
    u.searchParams.set('startdt', startTime ? `${date}T${startTime}:00` : date)
    if (endTime) u.searchParams.set('enddt', `${endDate || date}T${endTime}:00`)
    if (location) u.searchParams.set('location', location)
    if (details) u.searchParams.set('body', details)
    return u.toString()
  })()

  function downloadIcs() {
    const eventUrl = window.location.href
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//seveneightfive//Events//EN',
      'BEGIN:VEVENT',
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${title.replace(/,/g, '\\,')}`,
      location ? `LOCATION:${location.replace(/,/g, '\\,')}` : '',
      details ? `DESCRIPTION:${details.replace(/\n/g, '\\n').replace(/,/g, '\\,')}` : '',
      `URL:${eventUrl}`,
      `UID:${slug}@seveneightfive`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')

    const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}.ics`
    a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  const itemBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '11px 16px',
    fontSize: '0.84rem',
    color: 'var(--ink)',
    textDecoration: 'none',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    width: '100%',
    cursor: 'pointer',
    fontFamily: 'var(--sans)',
    textAlign: 'left',
    transition: 'background 0.1s',
  }

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '13px 20px',
          borderRadius: '8px',
          fontFamily: 'var(--serif)',
          fontSize: '0.88rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          background: 'transparent',
          color: 'var(--ink)',
          border: '2px solid var(--border)',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ink)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <CalendarIcon />
        Add to Calendar
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            minWidth: '200px',
            overflow: 'hidden',
            zIndex: 100,
          }}
        >
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{ ...itemBase, background: hovered === 'google' ? 'var(--off)' : 'transparent' }}
            onMouseEnter={() => setHovered('google')}
            onMouseLeave={() => setHovered(null)}
          >
            <GoogleCalIcon /> Google Calendar
          </a>
          <button
            onClick={downloadIcs}
            style={{ ...itemBase, background: hovered === 'apple' ? 'var(--off)' : 'transparent' }}
            onMouseEnter={() => setHovered('apple')}
            onMouseLeave={() => setHovered(null)}
          >
            <AppleCalIcon /> Apple Calendar
          </button>
          <a
            href={outlookUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{ ...itemBase, borderBottom: 'none', background: hovered === 'outlook' ? 'var(--off)' : 'transparent' }}
            onMouseEnter={() => setHovered('outlook')}
            onMouseLeave={() => setHovered(null)}
          >
            <OutlookCalIcon /> Outlook
          </a>
        </div>
      )}
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function GoogleCalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#fff" />
      <path d="M17 3H7C4.79 3 3 4.79 3 7v10c0 2.21 1.79 4 4 4h10c2.21 0 4-1.79 4-4V7c0-2.21-1.79-4-4-4z" fill="#4285F4" />
      <path d="M17 3H7C4.79 3 3 4.79 3 7v10c0 2.21 1.79 4 4 4h10c2.21 0 4-1.79 4-4V7c0-2.21-1.79-4-4-4z" fill="none" stroke="#4285F4" strokeWidth="0" />
      <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="#4285F4" strokeWidth="0" />
      <path d="M8 11h8M8 14h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1.5" fill="white" />
    </svg>
  )
}

function AppleCalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="18" rx="3" fill="#FF3B30" />
      <rect x="2" y="4" width="20" height="5" rx="0" fill="#FF3B30" />
      <rect x="2" y="7" width="20" height="2" fill="#C0392B" />
      <text x="12" y="18" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="system-ui">{new Date().getDate()}</text>
      <line x1="8" y1="2" x2="8" y2="6" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function OutlookCalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="3" fill="#0078D4" />
      <rect x="8" y="3" width="14" height="18" rx="3" fill="#50A0E0" />
      <rect x="2" y="3" width="10" height="18" rx="3" fill="#0078D4" />
      <text x="7" y="15" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="system-ui">CAL</text>
    </svg>
  )
}
