'use client'

import { useEffect, useState } from 'react'

type Point = { day: number; hour: number; minute: number }
export type Hours = {
  periods?: { open: Point; close?: Point }[]
  weekdayDescriptions?: string[] // Google order: Monday … Sunday
} | null

const TZ = 'America/Chicago'
const WEEK = 7 * 1440

// Current day (0 = Sunday) and minute-of-day in Topeka, regardless of the
// viewer's device timezone.
function nowInTopeka() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value || '0'
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

function isOpen(hours: NonNullable<Hours>, day: number, minutes: number): boolean | null {
  const periods = hours.periods
  if (!periods || periods.length === 0) return null
  const now = day * 1440 + minutes
  for (const p of periods) {
    if (!p.close) return true // Google: open with no close = open 24/7
    const o = p.open.day * 1440 + p.open.hour * 60 + p.open.minute
    let c = p.close.day * 1440 + p.close.hour * 60 + p.close.minute
    if (c <= o) c += WEEK // wraps past Saturday night
    if ((now >= o && now < c) || (now + WEEK >= o && now + WEEK < c)) return true
  }
  return false
}

function splitDesc(line: string) {
  const i = line.indexOf(': ')
  return i === -1 ? { label: '', value: line } : { label: line.slice(0, i), value: line.slice(i + 2) }
}

export default function VenueHours({ hours }: { hours: Hours }) {
  const [state, setState] = useState<{ todayIdx: number; open: boolean | null } | null>(null)

  // Computed after mount so the status reflects the viewer's "now",
  // not whenever the page was rendered/cached on the server.
  useEffect(() => {
    if (!hours) return
    const { day, minutes } = nowInTopeka()
    setState({ todayIdx: (day + 6) % 7, open: isOpen(hours, day, minutes) })
  }, [hours])

  const lines = hours?.weekdayDescriptions
  if (!lines || lines.length === 0) return null

  const today = state ? splitDesc(lines[state.todayIdx] || '') : null

  return (
    <details className="hours">
      <summary className="hours-summary">
        {state?.open === true && <span className="hours-status hours-status--open">Open now</span>}
        {state?.open === false && <span className="hours-status hours-status--closed">Closed</span>}
        <span className="hours-today">{today ? today.value : 'Hours'}</span>
        <span className="hours-toggle" aria-hidden>+</span>
      </summary>
      <ul className="hours-list">
        {lines.map((line, i) => {
          const { label, value } = splitDesc(line)
          return (
            <li key={i} className={`hours-row${state?.todayIdx === i ? ' hours-row--today' : ''}`}>
              <span>{label}</span>
              <span>{value}</span>
            </li>
          )
        })}
      </ul>
    </details>
  )
}
