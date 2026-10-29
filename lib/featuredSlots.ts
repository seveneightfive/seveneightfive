// lib/featuredSlots.ts
//
// Picks the five editorial slots for the home page Featured Events carousel.
// Each slot has a reason to exist, so the carousel reads as an editorial mix
// rather than "the next five events":
//
//   1. Editor's Pick        — first upcoming starred event
//   2. Tonight              — starred event today, else the best event today
//   3. This Weekend         — best event Fri–Sun of the current/upcoming weekend
//   4. Live Music · Arts    — best Live Music / Art event in the next two weeks
//   5. Free · Family        — best Free, Family, All Ages or Community event
//
// "Best" = starred first, then has a photo, then soonest. An event is only
// used once. If a slot has no candidate it's back-filled with the next good
// upcoming event under a neutral "Coming Up" label, so the carousel still
// shows five cards whenever five events exist.
//
// All dates are 'YYYY-MM-DD' strings in America/Chicago (see page.tsx).

export type FeaturedSlotEvent = {
  id: string
  title: string
  slug: string | null
  event_date: string
  end_date: string | null
  event_start_time: string | null
  event_end_time: string | null
  ticket_price: number | null
  event_types: string[] | null
  tags: string[] | null
  star: boolean | null
  image_url: string | null
  venue: { name: string; neighborhood: string | null } | null
}

export type SlotKey = 'editors-pick' | 'tonight' | 'weekend' | 'music-arts' | 'free-family' | 'coming-up'

export type FeaturedSlot = {
  key: SlotKey
  label: string
  event: FeaturedSlotEvent
}

const SLOT_LABELS: Record<SlotKey, string> = {
  'editors-pick': 'Editor’s Pick',
  tonight: 'Tonight',
  weekend: 'This Weekend',
  'music-arts': 'Live Music · Arts',
  'free-family': 'Free · Family',
  'coming-up': 'Coming Up',
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Fri–Sun of this weekend (or the upcoming one, Mon–Thu). */
export function weekendRange(today: string): { start: string; end: string } {
  const dow = new Date(today + 'T12:00:00Z').getUTCDay() // 0 Sun … 6 Sat
  if (dow === 5 || dow === 6 || dow === 0) {
    return { start: today, end: addDays(today, (7 - dow) % 7) }
  }
  return { start: addDays(today, 5 - dow), end: addDays(today, 7 - dow) }
}

const endOf = (e: FeaturedSlotEvent) => (e.end_date?.slice(0, 10) || e.event_date).slice(0, 10)
const startOf = (e: FeaturedSlotEvent) => e.event_date.slice(0, 10)

/** Does the event happen on any day in [from, to]? Handles multi-day runs. */
function overlaps(e: FeaturedSlotEvent, from: string, to: string) {
  return startOf(e) <= to && endOf(e) >= from
}

function hasAny(e: FeaturedSlotEvent, values: string[]) {
  const all = [...(e.event_types ?? []), ...(e.tags ?? [])].map(v => v.toLowerCase())
  return values.some(v => all.includes(v.toLowerCase()))
}

// starred → has photo → soonest → earliest start time. "Soonest" uses the
// later of the start date and `from`, so a run that opened weeks ago doesn't
// automatically beat something starting tomorrow.
function ranker(from: string) {
  const when = (e: FeaturedSlotEvent) => (startOf(e) > from ? startOf(e) : from)
  return (a: FeaturedSlotEvent, b: FeaturedSlotEvent) => {
    const star = Number(!!b.star) - Number(!!a.star)
    if (star) return star
    const img = Number(!!b.image_url) - Number(!!a.image_url)
    if (img) return img
    const date = when(a).localeCompare(when(b))
    if (date) return date
    return (a.event_start_time ?? '99').localeCompare(b.event_start_time ?? '99')
  }
}

// Within a date window, events that start inside it beat ongoing runs
// (a month-long exhibition shouldn't win "Tonight" or "This Weekend").
function startsWithinFirst(from: string, to: string) {
  const rank = ranker(from)
  return (a: FeaturedSlotEvent, b: FeaturedSlotEvent) => {
    const inA = Number(startOf(a) >= from && startOf(a) <= to)
    const inB = Number(startOf(b) >= from && startOf(b) <= to)
    return inB - inA || rank(a, b)
  }
}

export function pickFeaturedSlots({
  today,
  starred,
  pool,
}: {
  today: string
  /** Upcoming starred events, soonest first. */
  starred: FeaturedSlotEvent[]
  /** Everything happening from today through the next ~2 weeks. */
  pool: FeaturedSlotEvent[]
}): FeaturedSlot[] {
  const used = new Set<string>()
  const slots: FeaturedSlot[] = []
  const all = dedupe([...starred, ...pool])

  const take = (key: SlotKey, candidates: FeaturedSlotEvent[]) => {
    const pick = candidates.find(e => !used.has(e.id))
    if (!pick) return false
    used.add(pick.id)
    slots.push({ key, label: SLOT_LABELS[key], event: pick })
    return true
  }

  // 1. Editor's Pick — already ordered soonest-first by the query
  take('editors-pick', starred)

  const rank = ranker(today)

  // 2. Tonight
  take('tonight', all.filter(e => overlaps(e, today, today)).sort(startsWithinFirst(today, today)))

  // 3. This Weekend
  const wk = weekendRange(today)
  take('weekend', all.filter(e => overlaps(e, wk.start, wk.end)).sort(startsWithinFirst(wk.start, wk.end)))

  // 4. Live Music or Arts
  take(
    'music-arts',
    all.filter(e => hasAny(e, ['Live Music', 'Art', 'Exhibition', 'Theater', 'Dance', 'Open Mic'])).sort(rank),
  )

  // 5. Community, Family, or Free
  take(
    'free-family',
    all
      .filter(e => e.ticket_price === 0 || hasAny(e, ['Free', 'Family', 'All Ages', 'Community / Cultural']))
      .sort(rank),
  )

  // Back-fill any empty slots so the carousel stays at five when it can
  const rest = [...all].sort(rank)
  while (slots.length < 5 && take('coming-up', rest)) { /* keep filling */ }

  return slots
}

function dedupe(events: FeaturedSlotEvent[]) {
  const seen = new Set<string>()
  return events.filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true)))
}
