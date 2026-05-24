import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServer'

/**
 * GET /api/advertise/availability?start=YYYY-MM-DD&duration=5
 *
 * Returns availability info for the requested range:
 *   {
 *     maxOverlap:        number  // peak ads on any day in range
 *     slotsRemaining:    number  // 3 - maxOverlap (clamped to 0)
 *     full:              boolean // true if no slots available
 *     earliestAvailable: string | null  // ISO date if full, else null
 *   }
 *
 * Public — no auth required (form needs this before user commits).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const start = params.get('start')
  const duration = parseInt(params.get('duration') || '5', 10)

  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
  }
  if (duration !== 5 && duration !== 14) {
    return NextResponse.json({ error: 'Invalid duration' }, { status: 400 })
  }

  const MAX_PER_DAY = 3

  // Calculate end date
  const startDate = new Date(start + 'T12:00:00')
  startDate.setDate(startDate.getDate() + duration - 1)
  const end = startDate.toISOString().split('T')[0]

  const supabase = createClient()

  const { data: overlap, error: overlapErr } = await supabase
    .rpc('get_max_overlap_in_range', { p_start: start, p_end: end })

  if (overlapErr) {
    console.error('[availability] overlap error:', overlapErr)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }

  const maxOverlap = Number(overlap ?? 0)
  const slotsRemaining = Math.max(0, MAX_PER_DAY - maxOverlap)
  const full = slotsRemaining === 0

  let earliestAvailable: string | null = null
  if (full) {
    const { data: earliest } = await supabase
      .rpc('find_earliest_available_start', { p_duration: duration, p_max: MAX_PER_DAY })
    earliestAvailable = (earliest as string | null) ?? null
  }

  return NextResponse.json({
    maxOverlap,
    slotsRemaining,
    full,
    earliestAvailable,
  })
}
