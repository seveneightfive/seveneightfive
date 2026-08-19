import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdmin } from '@/lib/supabaseServer'
import { sendAttendeeTicketEmail } from '@/app/lib/email'

/**
 * POST /api/tickets/rsvp
 *
 * Free ticket cart with full per-attendee data — mirrors the paid
 * checkout flow's attendee model, but writes tickets + responses
 * immediately since there's no Stripe round-trip to wait on.
 *
 * All items here must be free (price === 0); a cart containing any
 * paid tier should go through /api/tickets/checkout instead.
 *
 * Body: {
 *   eventId: string,
 *   items: { tierId: string, quantity: number }[],
 *   guest?: { name: string, email: string, phone: string | null },
 *   attendees: {
 *     tierId: string,
 *     name: string,
 *     responses: { field_id: string, value: string }[]
 *   }[]   // flat list, length === sum(items[].quantity), grouped by
 *         // tier in the same order as `items`
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { eventId, guest } = body

    const items: { tierId: string; quantity: number }[] = Array.isArray(body.items)
      ? body.items.filter((it: any) => it?.tierId && Number(it.quantity) > 0)
      : []
    const attendees: { tierId: string; name: string; email?: string | null; responses: { field_id: string; value: string }[] }[] =
      Array.isArray(body.attendees) ? body.attendees : []

    if (!eventId || items.length === 0) {
      return NextResponse.json({ error: 'eventId and at least one item are required' }, { status: 400 })
    }
    if (!user && !guest) {
      return NextResponse.json({ error: 'Buyer information is required' }, { status: 400 })
    }
    if (!user && guest && (!guest.name?.trim() || !guest.email?.trim())) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    // Notify any attendee who has their own email that isn't the
    // purchaser's — free RSVPs mint immediately, so this happens now
    // rather than in a webhook.
    if (inserted?.length) {
      const buyerEmailLower = buyerEmail.toLowerCase()
      const attendeesNeedingEmail = inserted
        .map((t, i) => ({ ticket: t, attendee: attendees[i] }))
        .filter(({ ticket }) => ticket.attendee_email && ticket.attendee_email.toLowerCase() !== buyerEmailLower)

      if (attendeesNeedingEmail.length > 0) {
        try {
          const tierIds2 = [...new Set(attendeesNeedingEmail.map((a) => a.ticket.ticket_tier_id))]
          const { data: tierRows2 } = await admin.from('ticket_tiers').select('id, name').in('id', tierIds2)
          const tierNameById = new Map((tierRows2 || []).map((t) => [t.id, t.name]))

          const { data: ev } = await admin
            .from('events')
            .select(`
              title, slug, image_url, event_date, event_start_time, event_end_time, auth_user_id,
              venues ( name, address ),
              profiles!events_auth_user_id_profile_fkey ( full_name, email )
            `)
            .eq('id', eventId)
            .single()

          if (ev) {
            const venue = Array.isArray(ev.venues) ? ev.venues[0] : ev.venues
            const creatorProfile = Array.isArray(ev.profiles) ? ev.profiles[0] : ev.profiles
            const eventDetails = {
              title: ev.title, slug: ev.slug, date: ev.event_date, startTime: ev.event_start_time,
              endTime: ev.event_end_time, image_url: ev.image_url,
              venueName: venue?.name || null, venueAddress: venue?.address || null, venueCityState: null,
            }

            for (const { ticket, attendee } of attendeesNeedingEmail) {
              try {
                await sendAttendeeTicketEmail({
                  to: ticket.attendee_email!,
                  attendeeName: attendee?.name || null,
                  purchaserName: buyerName,
                  event: eventDetails,
                  ticket: { qr_token: ticket.qr_token, ticket_tier_name: tierNameById.get(ticket.ticket_tier_id) || 'Ticket' },
                  amountPaid: 0,
                  organizerName: creatorProfile?.full_name || null,
                  organizerEmail: creatorProfile?.email || null,
                })
              } catch (attendeeEmailErr) {
                console.error('[tickets/rsvp] attendee notification send failed (non-fatal):', attendeeEmailErr)
              }
            }
          }
        } catch (lookupErr) {
          console.error('[tickets/rsvp] attendee notification lookup failed (non-fatal):', lookupErr)
        }
      }
    }

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0)
    if (attendees.length !== totalQuantity) {
      return NextResponse.json({ error: 'Attendee details are missing for one or more tickets' }, { status: 400 })
    }
    for (const a of attendees) {
      if (!a.name?.trim()) {
        return NextResponse.json({ error: 'Every ticket needs an attendee name' }, { status: 400 })
      }
      if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) {
        return NextResponse.json({ error: `"${a.email}" doesn't look like a valid email.` }, { status: 400 })
      }
    }
    for (const it of items) {
      const count = attendees.filter((a) => a.tierId === it.tierId).length
      if (count !== it.quantity) {
        return NextResponse.json({ error: 'Attendee details don\'t match the cart quantities' }, { status: 400 })
      }
    }

    const admin = createAdmin()
    const tierIds = items.map((it) => it.tierId)

    const { data: tierRows, error: tierError } = await admin
      .from('ticket_tiers')
      .select('id, name, price, quantity, quantity_sold, is_active, event_id')
      .in('id', tierIds)
      .eq('event_id', eventId)

    if (tierError || !tierRows || tierRows.length !== tierIds.length) {
      return NextResponse.json({ error: 'One or more ticket tiers were not found' }, { status: 404 })
    }

    const tierById = new Map(tierRows.map((t) => [t.id, t]))

    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      if (Number(tier.price) !== 0) {
        return NextResponse.json(
          { error: `"${tier.name}" requires payment — free and paid tickets can't be RSVP'd together. Please use checkout.` },
          { status: 400 }
        )
      }
      if (!tier.is_active) {
        return NextResponse.json({ error: `"${tier.name}" is not currently available` }, { status: 400 })
      }
      if (tier.quantity !== null) {
        const remaining = tier.quantity - tier.quantity_sold
        if (remaining < it.quantity) {
          return NextResponse.json({ error: `Only ${remaining} spot(s) remaining for "${tier.name}"` }, { status: 400 })
        }
      }
    }

    // Required custom questions — validated per attendee, per their tier.
    const { data: applicableFields } = await admin
      .from('event_form_fields')
      .select('id, label, is_required, ticket_tier_id')
      .eq('event_id', eventId)
      .or(`ticket_tier_id.is.null,ticket_tier_id.in.(${tierIds.join(',')})`)

    const eventLevelRequired = (applicableFields || []).filter((f) => f.is_required && !f.ticket_tier_id)
    const tierRequiredMap: Record<string, typeof applicableFields> = {}
    for (const f of applicableFields || []) {
      if (f.is_required && f.ticket_tier_id) {
        tierRequiredMap[f.ticket_tier_id] = tierRequiredMap[f.ticket_tier_id] || []
        tierRequiredMap[f.ticket_tier_id]!.push(f)
      }
    }
    for (const a of attendees) {
      const responseMap = new Map(a.responses.map((r) => [r.field_id, (r.value || '').trim()]))
      const required = [...eventLevelRequired, ...(tierRequiredMap[a.tierId] || [])]
      for (const f of required) {
        if (!(responseMap.get(f.id) || '').length) {
          return NextResponse.json({ error: `"${f.label}" is required for ${a.name}.` }, { status: 400 })
        }
      }
    }

    // Purchaser identity (billing/contact — separate from attendees)
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

    // Dedupe — one RSVP per person per event, regardless of how many
    // tiers/attendees it covers.
    const dedupeQuery = admin
      .from('tickets')
      .select('id')
      .eq('event_id', eventId)
      .eq('payment_status', 'paid')

    const { data: existing } = buyerUserId
      ? await dedupeQuery.eq('buyer_user_id', buyerUserId).maybeSingle()
      : await dedupeQuery.ilike('buyer_email', buyerEmail).maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'An RSVP already exists for this email at this event' }, { status: 400 })
    }

    const ticketRows = attendees.map((a) => ({
      ticket_tier_id: a.tierId,
      event_id: eventId,
      buyer_user_id: buyerUserId,
      buyer_email: buyerEmail,
      buyer_name: a.name.trim(),
      buyer_phone: buyerPhone,
      attendee_email: a.email?.trim().toLowerCase() || null,
      payment_status: 'paid' as const,
      amount_paid: 0,
      platform_fee: 0,
      status: 'valid' as const,
    }))

    const { data: inserted, error: insertError } = await admin
      .from('tickets')
      .insert(ticketRows)
      .select('id, qr_token, ticket_tier_id, attendee_email')

    if (insertError || !inserted) {
      console.error('[tickets/rsvp] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save your RSVP' }, { status: 500 })
    }

    // Save each attendee's answers against their own ticket. Insert
    // order matches attendees order (single multi-row INSERT ...
    // RETURNING preserves input order in Postgres).
    const responseRows: Record<string, any>[] = []
    inserted.forEach((t, i) => {
      for (const r of attendees[i]?.responses || []) {
        if (!r.field_id || !r.value?.trim()) continue
        responseRows.push({ event_id: eventId, ticket_id: t.id, field_id: r.field_id, response: r.value.trim() })
      }
    })
    if (responseRows.length > 0) {
      const { error: responseErr } = await admin.from('event_registration_responses').insert(responseRows)
      if (responseErr) console.error('[tickets/rsvp] failed to save responses:', responseErr)
    }

    return NextResponse.json({
      ok: true,
      tickets: inserted,
      message: `RSVP confirmed for ${totalQuantity} guest${totalQuantity > 1 ? 's' : ''}`,
    })
  } catch (err: any) {
    console.error('[tickets/rsvp] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
