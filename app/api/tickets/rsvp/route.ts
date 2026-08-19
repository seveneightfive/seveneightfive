import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdmin } from '@/lib/supabaseServer'

/**
 * POST /api/tickets/rsvp
 *
 * Creates a free ticket (RSVP) without Stripe. Supports BOTH logged-in
 * users and guest RSVPs.
 *
 * Body: {
 *   tierId: string,
 *   eventId: string,
 *   quantity?: number,
 *   guest?: { name: string, email: string, phone: string | null },
 *   responses?: { field_id: string, value: string }[]
 * }
 *
 * responses are answers to the event's custom buyer questions
 * (event_form_fields). Since a free RSVP mints tickets immediately —
 * no async webhook step like the paid flow — responses are written
 * directly here, one row per (ticket, field) pair. If quantity > 1,
 * the same answers are recorded against every ticket in the order
 * (questions are asked once per order, not once per attendee).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { tierId, eventId, quantity = 1, guest, responses } = await request.json()

    if (!tierId || !eventId) {
      return NextResponse.json(
        { error: 'tierId and eventId are required' },
        { status: 400 }
      )
    }

    if (!user && !guest) {
      return NextResponse.json(
        { error: 'Buyer information is required' },
        { status: 400 }
      )
    }

    if (!user && guest && (!guest.name?.trim() || !guest.email?.trim())) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    const admin = createAdmin()

    // Verify the tier exists, is active, and is genuinely free
    const { data: tier, error: tierError } = await admin
      .from('ticket_tiers')
      .select('id, name, price, quantity, quantity_sold, is_active, event_id')
      .eq('id', tierId)
      .eq('event_id', eventId)
      .single()

    if (tierError || !tier) {
      return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 })
    }

    if (!tier.is_active) {
      return NextResponse.json(
        { error: 'This ticket tier is not currently available' },
        { status: 400 }
      )
    }

    if (Number(tier.price) !== 0) {
      return NextResponse.json(
        { error: 'This tier requires payment — use the checkout flow' },
        { status: 400 }
      )
    }

    if (tier.quantity !== null) {
      const remaining = tier.quantity - tier.quantity_sold
      if (remaining < quantity) {
        return NextResponse.json(
          { error: `Only ${remaining} spot(s) remaining` },
          { status: 400 }
        )
      }
    }

    // Validate that any required questions for this tier were answered.
    // (The client already enforces this — this is the server-side backstop.)
    const { data: applicableFields } = await admin
      .from('event_form_fields')
      .select('id, label, is_required, ticket_tier_id')
      .eq('event_id', eventId)
      .or(`ticket_tier_id.is.null,ticket_tier_id.eq.${tierId}`)

    const responseMap = new Map<string, string>(
      (Array.isArray(responses) ? responses : []).map((r: any) => [r.field_id, String(r.value ?? '').trim()])
    )

    for (const f of applicableFields || []) {
      if (f.is_required && !(responseMap.get(f.id) || '').length) {
        return NextResponse.json({ error: `"${f.label}" is required.` }, { status: 400 })
      }
    }

    // Resolve buyer info
    let buyerEmail: string
    let buyerName: string | null
    let buyerPhone: string | null
    let buyerUserId: string | null

    if (user) {
      const { data: profile } = await admin
        .from('profiles')
        .select('email, full_name, phone_number')
        .eq('id', user.id)
        .single()

      buyerEmail = profile?.email || user.email || ''
      buyerName = profile?.full_name || null
      buyerPhone = profile?.phone_number || null
      buyerUserId = user.id
    } else {
      buyerEmail = guest.email.trim().toLowerCase()
      buyerName = guest.name.trim()
      buyerPhone = guest.phone || null
      buyerUserId = null
    }

    // Dedupe — same email can't RSVP twice for the same event.
    // We match on buyer_user_id when logged in, buyer_email when guest.
    const dedupeQuery = admin
      .from('tickets')
      .select('id')
      .eq('event_id', eventId)
      .eq('payment_status', 'paid')

    const { data: existing } = buyerUserId
      ? await dedupeQuery.eq('buyer_user_id', buyerUserId).maybeSingle()
      : await dedupeQuery.ilike('buyer_email', buyerEmail).maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'An RSVP already exists for this email at this event' },
        { status: 400 }
      )
    }

    const tickets = Array.from({ length: quantity }, () => ({
      ticket_tier_id: tierId,
      event_id: eventId,
      buyer_user_id: buyerUserId,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      payment_status: 'paid' as const,
      amount_paid: 0,
      platform_fee: 0,
      status: 'valid' as const,
    }))

    const { data: inserted, error: insertError } = await admin
      .from('tickets')
      .insert(tickets)
      .select('id, qr_token')

    if (insertError) {
      console.error('[tickets/rsvp] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save your RSVP' }, { status: 500 })
    }

    // Persist question responses against every ticket in this order.
    if (responseMap.size > 0 && inserted?.length) {
      const responseRows: Record<string, any>[] = []
      for (const t of inserted) {
        for (const [fieldId, value] of responseMap.entries()) {
          if (!value) continue
          responseRows.push({
            event_id: eventId,
            ticket_id: t.id,
            field_id: fieldId,
            response: value,
          })
        }
      }
      if (responseRows.length > 0) {
        const { error: responseErr } = await admin
          .from('event_registration_responses')
          .insert(responseRows)
        if (responseErr) {
          // Non-fatal — the RSVP itself already succeeded. Log and move on
          // rather than making the buyer think their spot wasn't saved.
          console.error('[tickets/rsvp] failed to save responses:', responseErr)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      tickets: inserted,
      message: `RSVP confirmed for ${quantity} guest${quantity > 1 ? 's' : ''}`,
    })
  } catch (err: any) {
    console.error('[tickets/rsvp] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
