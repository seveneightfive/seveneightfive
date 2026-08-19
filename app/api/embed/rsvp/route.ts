import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { sendAttendeeTicketEmail } from '@/app/lib/email'

/**
 * POST /api/embed/rsvp
 *
 * Public, CORS-open, guest-only counterpart to /api/tickets/rsvp, for
 * free tickets claimed through the embed widget on a seller's site.
 * Mints tickets immediately (no Stripe involved), same as the main
 * RSVP route.
 *
 * Body: {
 *   eventSlug: string,
 *   items: { tierId: string, quantity: number }[],
 *   guest: { name: string, email: string, phone: string | null },
 *   attendees: {
 *     tierId: string, name: string, email?: string | null,
 *     responses: { field_id: string, value: string }[]
 *   }[]
 * }
 */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventSlug, guest } = body

    const items: { tierId: string; quantity: number }[] = Array.isArray(body.items)
      ? body.items.filter((it: any) => it?.tierId && Number(it.quantity) > 0)
      : []
    const attendees: { tierId: string; name: string; email?: string | null; responses: { field_id: string; value: string }[] }[] =
      Array.isArray(body.attendees) ? body.attendees : []

    if (!eventSlug || items.length === 0) return jsonError('eventSlug and at least one item are required', 400)
    if (!guest?.name?.trim() || !guest?.email?.trim()) return jsonError('Name and email are required', 400)

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0)
    if (attendees.length !== totalQuantity) return jsonError('Attendee details are missing for one or more tickets', 400)
    for (const a of attendees) {
      if (!a.name?.trim()) return jsonError('Every ticket needs an attendee name', 400)
      if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) {
        return jsonError(`"${a.email}" doesn't look like a valid email.`, 400)
      }
    }
    for (const it of items) {
      const count = attendees.filter((a) => a.tierId === it.tierId).length
      if (count !== it.quantity) return jsonError("Attendee details don't match the cart quantities", 400)
    }

    const admin = createAdminClient()

    const { data: eventRow } = await admin
      .from('events')
      .select('id, title, slug, image_url, event_date, event_start_time, event_end_time, ticketing_enabled, auth_user_id, venues(name,address), profiles!events_auth_user_id_profile_fkey(full_name,email)')
      .eq('slug', eventSlug)
      .maybeSingle()

    if (!eventRow || !eventRow.ticketing_enabled) return jsonError('Event not found', 404)
    const eventId = eventRow.id
    const tierIds = items.map((it) => it.tierId)

    const { data: tierRows, error: tierError } = await admin
      .from('ticket_tiers')
      .select('id, name, price, quantity, quantity_sold, is_active')
      .in('id', tierIds)
      .eq('event_id', eventId)

    if (tierError || !tierRows || tierRows.length !== tierIds.length) {
      return jsonError('One or more ticket tiers were not found', 404)
    }

    const tierById = new Map(tierRows.map((t) => [t.id, t]))

    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      if (Number(tier.price) !== 0) {
        return jsonError(`"${tier.name}" requires payment — free and paid tickets can't be combined.`, 400)
      }
      if (!tier.is_active) return jsonError(`"${tier.name}" is not currently available`, 400)
      if (tier.quantity !== null) {
        const remaining = tier.quantity - tier.quantity_sold
        if (remaining < it.quantity) return jsonError(`Only ${remaining} spot(s) remaining for "${tier.name}"`, 400)
      }
    }

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
        if (!(responseMap.get(f.id) || '').length) return jsonError(`"${f.label}" is required for ${a.name}.`, 400)
      }
    }

    const buyerEmail = guest.email.trim().toLowerCase()
    const buyerName = guest.name.trim()
    const buyerPhone = guest.phone || null

    const { data: existing } = await admin
      .from('tickets')
      .select('id')
      .eq('event_id', eventId)
      .eq('payment_status', 'paid')
      .ilike('buyer_email', buyerEmail)
      .maybeSingle()

    if (existing) return jsonError('An RSVP already exists for this email at this event', 400)

    const ticketRows = attendees.map((a) => ({
      ticket_tier_id: a.tierId,
      event_id: eventId,
      buyer_user_id: null,
      buyer_email: buyerEmail,
      buyer_name: a.name.trim(),
      buyer_phone: buyerPhone,
      attendee_email: a.email?.trim().toLowerCase() || null,
      payment_status: 'paid' as const,
      amount_paid: 0,
      platform_fee: 0,
      status: 'valid' as const,
      source: 'embed',
    }))

    const { data: inserted, error: insertError } = await admin
      .from('tickets')
      .insert(ticketRows)
      .select('id, qr_token, ticket_tier_id, attendee_email')

    if (insertError || !inserted) {
      console.error('[embed/rsvp] insert error:', insertError)
      return jsonError('Failed to save your RSVP', 500)
    }

    const responseRows: Record<string, any>[] = []
    inserted.forEach((t, i) => {
      for (const r of attendees[i]?.responses || []) {
        if (!r.field_id || !r.value?.trim()) continue
        responseRows.push({ event_id: eventId, ticket_id: t.id, field_id: r.field_id, response: r.value.trim() })
      }
    })
    if (responseRows.length > 0) {
      const { error: responseErr } = await admin.from('event_registration_responses').insert(responseRows)
      if (responseErr) console.error('[embed/rsvp] failed to save responses:', responseErr)
    }

    // Notify any attendee with their own distinct email.
    const buyerEmailLower = buyerEmail.toLowerCase()
    const attendeesNeedingEmail = inserted
      .map((t, i) => ({ ticket: t, attendee: attendees[i] }))
      .filter(({ ticket }) => ticket.attendee_email && ticket.attendee_email.toLowerCase() !== buyerEmailLower)

    if (attendeesNeedingEmail.length > 0) {
      try {
        const tierIdsForEmail = [...new Set(attendeesNeedingEmail.map((a) => a.ticket.ticket_tier_id))]
        const { data: tierRowsForEmail } = await admin.from('ticket_tiers').select('id, name').in('id', tierIdsForEmail)
        const tierNameById = new Map((tierRowsForEmail || []).map((t) => [t.id, t.name]))

        const venue = Array.isArray(eventRow.venues) ? eventRow.venues[0] : eventRow.venues
        const creatorProfile = Array.isArray(eventRow.profiles) ? eventRow.profiles[0] : eventRow.profiles
        const eventDetails = {
          title: eventRow.title, slug: eventRow.slug, date: eventRow.event_date, startTime: eventRow.event_start_time,
          endTime: eventRow.event_end_time, image_url: eventRow.image_url,
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
            console.error('[embed/rsvp] attendee notification send failed (non-fatal):', attendeeEmailErr)
          }
        }
      } catch (lookupErr) {
        console.error('[embed/rsvp] attendee notification lookup failed (non-fatal):', lookupErr)
      }
    }

    return NextResponse.json(
      { ok: true, message: `RSVP confirmed for ${totalQuantity} guest${totalQuantity > 1 ? 's' : ''}` },
      { headers: corsHeaders() }
    )
  } catch (err: any) {
    console.error('[embed/rsvp] error:', err)
    return jsonError(err?.message || 'Internal server error', 500)
  }
}
