// lib/openNow.ts
//
// "Is this place open right now?" from venues.hours, which is stored in
// Google Places' weekly format:
//
//   { openNow: false, periods: [{ open: { day, hour, minute }, close: { day, hour, minute } }, …] }
//
// day: 0 = Sunday … 6 = Saturday. `openNow` is a snapshot from import time,
// so it's ignored — the answer is worked out from `periods` in Topeka time.
// A period with no `close` means open 24 hours.

type HoursPoint = { day: number; hour: number; minute?: number }
type HoursPeriod = { open?: HoursPoint; close?: HoursPoint }
export type VenueHours = { periods?: HoursPeriod[] } | null | undefined

const WEEK = 7 * 24 * 60
const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Minutes since Sunday 00:00 in America/Chicago. */
export function chicagoMinuteOfWeek(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0'
  const day = DAY_INDEX[get('weekday')] ?? 0
  return day * 1440 + (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10)
}

const toMinutes = (p: HoursPoint) => p.day * 1440 + p.hour * 60 + (p.minute ?? 0)

/** null = no usable hours stored, so we can't say. */
export function isOpenNow(hours: VenueHours, minuteOfWeek: number = chicagoMinuteOfWeek()): boolean | null {
  const periods = hours?.periods
  if (!Array.isArray(periods) || periods.length === 0) return null

  for (const period of periods) {
    if (!period?.open) continue
    if (!period.close) return true // open 24 hours
    const start = toMinutes(period.open)
    let end = toMinutes(period.close)
    if (end <= start) end += WEEK // runs past Saturday midnight / overnight
    // Check this week and the wrap-around into next week
    if ((minuteOfWeek >= start && minuteOfWeek < end) ||
        (minuteOfWeek + WEEK >= start && minuteOfWeek + WEEK < end)) {
      return true
    }
  }
  return false
}
