// Event-wide "stop selling tickets" rule.
//
// Stored on events as:
//   ticket_sales_end_mode           'none' | 'offset' | 'custom'
//   ticket_sales_end_offset_minutes  minutes relative to the event's start
//                                    (0 = at start, 60 = 1 hr after, -60 = 1 hr before)
//   ticket_sales_end_at              exact cutoff, for 'custom'
//
// The event start is event_date + event_start_time in Topeka time
// (America/Chicago). events.start_date isn't used: some rows store local
// time labelled as UTC, which would shift the cutoff by 5-6 hours.
//
// A tier's own sale_ends_at still applies; whichever is earlier wins
// (see effectiveTierSaleEnd).

export const EVENT_TZ = 'America/Chicago'

export type SalesCutoffEvent = {
  event_date?: string | null
  event_start_time?: string | null
  ticket_sales_end_mode?: string | null
  ticket_sales_end_offset_minutes?: number | null
  ticket_sales_end_at?: string | null
}

// "6:00 PM", "6 pm", "11:00 am ", "18:00", "18:00:00" -> [h, m] (24h)
export function parseStartTime(raw?: string | null): [number, number] | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?$/)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ap = m[3]?.replace(/\./g, '')
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return [h, min]
}

// Wall-clock time in a timezone -> the real instant (UTC Date).
export function zonedTimeToUtc(dateStr: string, h: number, min: number, tz = EVENT_TZ): Date {
  const [y, mo, d] = dateStr.slice(0, 10).split('-').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, min)
  // How far the zone is from UTC at (roughly) that moment
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(guess))
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const asZoned = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  const offset = asZoned - guess
  return new Date(guess - offset)
}

// The event's start instant, or null if the date/time can't be read.
export function eventStartsAt(ev: SalesCutoffEvent): Date | null {
  if (!ev.event_date) return null
  const t = parseStartTime(ev.event_start_time)
  if (!t) return null
  return zonedTimeToUtc(ev.event_date, t[0], t[1])
}

// When the event-wide rule stops sales, or null for no event-wide cutoff.
export function eventSalesEndAt(ev: SalesCutoffEvent): Date | null {
  const mode = ev.ticket_sales_end_mode || 'none'
  if (mode === 'custom') return ev.ticket_sales_end_at ? new Date(ev.ticket_sales_end_at) : null
  if (mode === 'offset') {
    const start = eventStartsAt(ev)
    if (start) return new Date(start.getTime() + (ev.ticket_sales_end_offset_minutes || 0) * 60_000)
    // No readable start time: fall back to the end of the event day.
    if (ev.event_date) return zonedTimeToUtc(ev.event_date, 23, 59)
  }
  return null
}

// Earlier of the tier's own end and the event-wide cutoff.
export function effectiveTierSaleEnd(
  tierSaleEndsAt: string | null | undefined,
  ev: SalesCutoffEvent | null | undefined,
): Date | null {
  const tierEnd = tierSaleEndsAt ? new Date(tierSaleEndsAt) : null
  const evEnd = ev ? eventSalesEndAt(ev) : null
  if (tierEnd && evEnd) return tierEnd < evEnd ? tierEnd : evEnd
  return tierEnd || evEnd
}

export const SALES_CUTOFF_COLUMNS =
  'event_date, event_start_time, ticket_sales_end_mode, ticket_sales_end_offset_minutes, ticket_sales_end_at'
