import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'

/**
 * GET  /api/events/[id]/form-fields
 *   Public — returns active questions for the event, split into
 *   event-level (ticket_tier_id: null, shown for every tier) and
 *   tier-specific (shown only when that tier is selected). Used by
 *   both the checkout form and the seller's editor.
 *
 * PUT  /api/events/[id]/form-fields
 *   Seller only. Replaces the full question set for this event in one
 *   call — the editor always sends the complete desired state rather
 *   than incremental diffs, so this deletes and reinserts rather than
 *   trying to reconcile individual rows.
 *
 *   Body: {
 *     eventLevel: QuestionInput[]              // max 3
 *     byTier: Record<tierId, QuestionInput[]>  // combined with eventLevel, max 3 per tier
 *   }
 *   QuestionInput: {
 *     field_type: 'text' | 'select' | 'checkbox'
 *     label: string
 *     placeholder?: string | null
 *     options?: string[] | null   // select only
 *     is_required?: boolean
 *   }
 */

const MAX_PER_TIER = 3
const MAX_LABEL_LEN = 120
const VALID_TYPES = new Set(['text', 'select', 'checkbox'])

type QuestionInput = {
  field_type: string
  label: string
  placeholder?: string | null
  options?: string[] | null
  is_required?: boolean
}

function validateQuestion(q: QuestionInput): string | null {
  if (!VALID_TYPES.has(q.field_type)) return `Invalid question type: ${q.field_type}`
  if (!q.label?.trim()) return 'Every question needs a label.'
  if (q.label.trim().length > MAX_LABEL_LEN) return `"${q.label.slice(0, 30)}…" is too long.`
  if (q.field_type === 'select') {
    const opts = (q.options || []).map((o) => o.trim()).filter(Boolean)
    if (opts.length < 2) return `"${q.label}" needs at least 2 options.`
  }
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('event_form_fields')
    .select('id, field_type, label, placeholder, options, is_required, ticket_tier_id, sort_order')
    .eq('event_id', eventId)
    .order('sort_order')

  if (error) {
    console.error('[form-fields] GET error:', error)
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 })
  }

  const eventLevel = (data || []).filter((f) => !f.ticket_tier_id)
  const byTier: Record<string, typeof data> = {}
  for (const f of data || []) {
    if (f.ticket_tier_id) {
      byTier[f.ticket_tier_id] = byTier[f.ticket_tier_id] || []
      byTier[f.ticket_tier_id].push(f)
    }
  }

  return NextResponse.json({ eventLevel, byTier })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // ── Ownership check — mirrors the access check on the ticketing
    // dashboard page (owner, venue owner, or linked artist).
    const { data: eventRow } = await admin
      .from('events')
      .select('id, auth_user_id, venue_id, venues(auth_user_id)')
      .eq('id', eventId)
      .maybeSingle()

    if (!eventRow) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    let hasAccess = eventRow.auth_user_id === user.id
    if (!hasAccess) {
      const venue = Array.isArray(eventRow.venues) ? eventRow.venues[0] : eventRow.venues
      if (venue?.auth_user_id === user.id) hasAccess = true
    }
    if (!hasAccess) {
      const { data: myArtists } = await admin
        .from('artists')
        .select('id')
        .eq('auth_user_id', user.id)
      const myArtistIds = (myArtists || []).map((a: any) => a.id)
      if (myArtistIds.length) {
        const { data: link } = await admin
          .from('event_artists')
          .select('artist_id')
          .eq('event_id', eventId)
          .in('artist_id', myArtistIds)
          .limit(1)
          .maybeSingle()
        if (link) hasAccess = true
      }
    }
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const eventLevel: QuestionInput[] = Array.isArray(body.eventLevel) ? body.eventLevel : []
    const byTier: Record<string, QuestionInput[]> =
      body.byTier && typeof body.byTier === 'object' ? body.byTier : {}

    if (eventLevel.length > MAX_PER_TIER) {
      return NextResponse.json(
        { error: `You can only ask up to ${MAX_PER_TIER} questions.` },
        { status: 400 }
      )
    }

    for (const q of eventLevel) {
      const err = validateQuestion(q)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
    }

    // Confirm the tier IDs referenced actually belong to this event —
    // prevents attaching questions to someone else's tier.
    const tierIds = Object.keys(byTier).filter((tid) => (byTier[tid]?.length || 0) > 0)
    if (tierIds.length > 0) {
      const { data: validTiers } = await admin
        .from('ticket_tiers')
        .select('id')
        .eq('event_id', eventId)
        .in('id', tierIds)
      const validSet = new Set((validTiers || []).map((t) => t.id))
      for (const tid of tierIds) {
        if (!validSet.has(tid)) {
          return NextResponse.json({ error: 'One of these ticket tiers was not found.' }, { status: 400 })
        }
      }
    }

    for (const [tierId, questions] of Object.entries(byTier)) {
      if (!questions?.length) continue
      if (eventLevel.length + questions.length > MAX_PER_TIER) {
        return NextResponse.json(
          {
            error: `Too many questions for one of your tiers — event-wide questions plus tier-specific ones can't exceed ${MAX_PER_TIER} total.`,
          },
          { status: 400 }
        )
      }
      for (const q of questions) {
        const err = validateQuestion(q)
        if (err) return NextResponse.json({ error: err }, { status: 400 })
      }
    }

    // Replace the full set for this event.
    const { error: deleteErr } = await admin
      .from('event_form_fields')
      .delete()
      .eq('event_id', eventId)

    if (deleteErr) {
      console.error('[form-fields] delete error:', deleteErr)
      return NextResponse.json({ error: 'Failed to update questions' }, { status: 500 })
    }

    const rows: Record<string, any>[] = []
    eventLevel.forEach((q, i) => {
      rows.push({
        event_id: eventId,
        ticket_tier_id: null,
        field_type: q.field_type,
        label: q.label.trim(),
        placeholder: q.placeholder?.trim() || null,
        options: q.field_type === 'select' ? (q.options || []).map((o) => o.trim()).filter(Boolean) : null,
        is_required: !!q.is_required,
        sort_order: i,
      })
    })
    for (const [tierId, questions] of Object.entries(byTier)) {
      ;(questions || []).forEach((q, i) => {
        rows.push({
          event_id: eventId,
          ticket_tier_id: tierId,
          field_type: q.field_type,
          label: q.label.trim(),
          placeholder: q.placeholder?.trim() || null,
          options: q.field_type === 'select' ? (q.options || []).map((o) => o.trim()).filter(Boolean) : null,
          is_required: !!q.is_required,
          sort_order: eventLevel.length + i,
        })
      })
    }

    if (rows.length > 0) {
      const { error: insertErr } = await admin.from('event_form_fields').insert(rows)
      if (insertErr) {
        console.error('[form-fields] insert error:', insertErr)
        return NextResponse.json({ error: 'Failed to save questions' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, count: rows.length })
  } catch (err: any) {
    console.error('[form-fields] PUT error:', err)
    return NextResponse.json({ error: err?.message || 'Something went wrong' }, { status: 500 })
  }
}
