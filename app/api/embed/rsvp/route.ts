import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { sendAttendeeTicketEmail } from '@/app/lib/email'
import { effectiveTierSaleEnd } from '@/lib/ticketSalesCutoff'

/**
 * POST /api/embed/rsvp
 *
 * Public, CORS-open, guest-only counterpart to /api/tickets/rsvp, for
 * free orders placed through the embed widget on a seller's site.
 * Mints tickets immediately (no Stripe). Same rules as the main RSVP
 * route — group/table tiers and add-ons included — and every tier AND
 * every selected add-on must be free; anything priced belongs in
 * /api/embed/checkout.
 *
 * Body: {
 *   eventSlug: string,
 *   items: { tierId: string, quantity: number }[],   // quantity = TABLES for group tiers
 *   guest: { name: string, email: string, phone: string | null },
 *   attendees: {                                     // one per INDIVIDUAL-tier seat
 *     tierId: string, name: string, email?: string | null,
 *     responses: { field_id: string, value: string }[],
 *     addons: { addon_id: string, choice?: string | null }[]
 *   }[],
 *   tables: {                                        // one per GROUP-tier table
 *     tierId: string,
 *     responses: { field_id: string, value: string }[],
 *     addons: { addon_id: string, choice: string | null, quantity: number }[]
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
    const attendees: {
      tierId: string; name: string; email?: string | null
      responses: { field_id: string; value: string }[]
      addons?: { addon_id: string; choice?: string | null }[]
    }[] = Array.isArray(body.attendees) ? body.attendees : []
    const tables: {
      tierId: string
      responses: { field_id: string; value: string }[]
      addons?: { addon_id: string; choice: string | null; quantity: number }[]
    }[] = Array.isArray(body.tables) ? body.tables : []

    if (!eventSlug || items.length === 0) return jsonError('eventSlug and at least one item are required', 400)
    if (!guest?.name?.trim() || !guest?.email?.trim()) return jsonError('Name and email are required', 400)

    const admin = createAdminClient()

    const { data: eventRow } = await admin
      .from('events')
      .select(`
        id, title, slug, image_url, event_date, event_start_time, event_end_time, ticketing_enabled, auth_user_id,
        ticket_sales_end_mode, ticket_sales_end_offset_minutes, ticket_sales_end_at,
        venues ( name, address ), profiles!events_auth_user_id_profile_fkey ( full_name, email )
      `)
      .eq('slug', eventSlug)
      .maybeSingle()

    if (!eventRow || !eventRow.ticketing_enabled) return jsonError('Event not found', 404)
    const eventId = eventRow.id
    const tierIds = items.map((it) => it.tierId)

    const { data: tierRows, error: tierError } = await admin
      .from('ticket_tiers')
      .select('id, name, price, quantity, quantity_sold, is_active, is_group, seats_per_unit, sale_starts_at, sale_ends_at')
      .in('id', tierIds)
      .eq('event_id', eventId)

    if (tierError || !tierRows || tierRows.length !== tierIds.length) {
      return jsonError('One or more ticket tiers were not found', 404)
    }

    const tierById = new Map(tierRows.map((t) => [t.id, t]))
    const now = new Date()

    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      const expectedCount = tier.is_group
        ? tables.filter((tb) => tb.tierId === it.tierId).length
        : attendees.filter((a) => a.tierId === it.tierId).length
      if (expectedCount !== it.quantity) {
        return jsonError(`${tier.is_group ? 'Table' : 'Attendee'} details don't match the cart quantities for "${tier.name}".`, 400)
      }
      if (Number(tier.price) !== 0) return jsonError(`"${tier.name}" requires payment — please use checkout instead.`, 400)
      if (!tier.is_active) return jsonError(`"${tier.name}" is not currently available`, 400)
      if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) return jsonError(`"${tier.name}" isn't open yet`, 400)
      const saleEnd = effectiveTierSaleEnd(tier.sale_ends_at, eventRow as any)
      if (saleEnd && saleEnd < now) return jsonError(`"${tier.name}" is no longer available`, 400)
      if (tier.quantity !== null) {
        const seatsPerUnit = tier.is_group ? tier.seats_per_unit : 1
        const unitsRemaining = tier.quantity - Math.floor(tier.quantity_sold / seatsPerUnit)
        if (unitsRemaining < it.quantity) {
          return jsonError(`Only ${unitsRemaining} ${tier.is_group ? 'table(s)' : 'spot(s)'} remaining for "${tier.name}"`, 400)
        }
      }
    }
    for (const a of attendees) {
      if (!a.name?.trim()) return jsonError('Every ticket needs an attendee name', 400)
      if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) {
        return jsonError(`"${a.email}" doesn't look like a valid email.`, 400)
      }
    }

    // ── Add-ons — must ALL be free in this flow ──
    const addonIds = new Set<string>()
    for (const a of attendees) for (const ad of a.addons || []) addonIds.add(ad.addon_id)
    for (const tb of tables) for (const ad of tb.addons || []) addonIds.add(ad.addon_id)

    const { data: addonRows } = addonIds.size
      ? await admin.from('event_addons').select('id, ticket_tier_id, name, price, has_choice, choice_options, is_active').in('id', Array.from(addonIds))
      : { data: [] as any[] }
    const addonById = new Map((addonRows || []).map((a) => [a.id, a]))

    for (const id of addonIds) {
      const addon = addonById.get(id)
      if (!addon || !addon.is_active) return jsonError('One of the selected add-ons is no longer available.', 400)
      if (Number(addon.price) !== 0) return jsonError(`"${addon.name}" has a cost — please use checkout instead.`, 400)
    }
    for (const a of attendees) {
      for (const ad of a.addons || []) {
        const addon = addonById.get(ad.addon_id)!
        if (addon.ticket_tier_id !== a.tierId) return jsonError(`"${addon.name}" isn't available for this ticket type.`, 400)
        if (addon.has_choice) {
          const opts: string[] = addon.choice_options || []
          if (!ad.choice || !opts.includes(ad.choice)) return jsonError(`Please choose an option for "${addon.name}".`, 400)
        }
      }
    }
    for (const tb of tables) {
      const tier = tierById.get(tb.tierId)!
      const sumsByAddon: Record<string, number> = {}
      for (const ad of tb.addons || []) {
        const addon = addonById.get(ad.addon_id)!
        if (addon.ticket_tier_id !== tb.tierId) return jsonError(`"${addon.name}" isn't available for this ticket type.`, 400)
        if (ad.quantity < 0 || ad.quantity > tier.seats_per_unit) {
          return jsonError(`"${addon.name}" quantity can't exceed the table's ${tier.seats_per_unit} seats.`, 400)
        }
        if (addon.has_choice && ad.quantity > 0) {
          const opts: string[] = addon.choice_options || []
          if (!ad.choice || !opts.includes(ad.choice)) return jsonError(`Please choose an option for "${addon.name}".`, 400)
        }
        sumsByAddon[ad.addon_id] = (sumsByAddon[ad.addon_id] || 0) + ad.quantity
      }
      for (const [addonId, sum] of Object.entries(sumsByAddon)) {
        if (sum > tier.seats_per_unit) {
          return jsonError(`"${addonById.get(addonId)?.name}" total can't exceed the table's ${tier.seats_per_unit} seats.`, 400)
        }
      }
    }

    // ── Required questions ──
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
      const responseMap = new Map((a.responses || []).map((r) => [r.field_id, (r.value || '').trim()]))
      for (const f of [...eventLevelRequired, ...(tierRequiredMap[a.tierId] || [])]) {
        if (!(responseMap.get(f.id) || '').length) return jsonError(`"${f.label}" is required for ${a.name}.`, 400)
      }
    }
    for (const tb of tables) {
      const responseMap = new Map((tb.responses || []).map((r) => [r.field_id, (r.value || '').trim()]))
      for (const f of [...eventLevelRequired, ...(tierRequiredMap[tb.tierId] || [])]) {
        if (!(responseMap.get(f.id) || '').length) return jsonError(`"${f.label}" is required for the table.`, 400)
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
      .limit(1)
      .maybeSingle()
    if (existing) return jsonError('An RSVP already exists for this email at this event', 400)

    // ── Mint tickets ──
    // Individual tiers: one row per attendee. Group tiers: seats_per_unit
    // rows per table, all under the purchaser's name.
    type PendingTicket = { tierId: string; buyerName: string; attendeeIndex?: number; tableIndex?: number }
    const pending: PendingTicket[] = []
    attendees.forEach((a, attendeeIndex) => {
      pending.push({ tierId: a.tierId, buyerName: a.name.trim(), attendeeIndex })
    })
    tables.forEach((tb, tableIndex) => {
      const tier = tierById.get(tb.tierId)!
      for (let i = 0; i < tier.seats_per_unit; i++) {
        pending.push({ tierId: tb.tierId, buyerName, tableIndex })
      }
    })

    const ticketRows = pending.map((p) => ({
      ticket_tier_id: p.tierId,
      event_id: eventId,
      buyer_user_id: null,
      buyer_email: buyerEmail,
      buyer_name: p.buyerName,
      buyer_phone: buyerPhone,
      attendee_email: p.attendeeIndex !== undefined
        ? (attendees[p.attendeeIndex].email?.trim().toLowerCase() || null)
        : null,
      payment_status: 'paid' as const,
      amount_paid: 0,
      platform_fee: 0,
      status: 'valid' as const,
      source: 'embed',
    }))

    const { data: inserted, error: insertError } = await admin
      .from('tickets')
      .insert(ticketRows)
      .select('id, qr_token, ticket_tier_id, attendee_email, buyer_name')

    if (insertError || !inserted) {
      console.error('[embed/rsvp] insert error:', insertError)
      return jsonError('Failed to save your RSVP', 500)
    }

    // Responses: individual tickets get their own answers; table seats
    // each get a copy of the table's answers. Add-ons: individual tickets
    // get their own; a table's add-on quantities are spread across its seats.
    const responseRows: Record<string, any>[] = []
    const addonRowsToInsert: Record<string, any>[] = []
    const seatIdsByTable: string[][] = tables.map(() => [])

    inserted.forEach((t, i) => {
      const p = pending[i]
      if (p.attendeeIndex !== undefined) {
        const a = attendees[p.attendeeIndex]
        for (const r of a.responses || []) {
          if (!r.field_id || !r.value?.trim()) continue
          responseRows.push({ event_id: eventId, ticket_id: t.id, field_id: r.field_id, response: r.value.trim() })
        }
        for (const ad of a.addons || []) {
          addonRowsToInsert.push({ ticket_id: t.id, addon_id: ad.addon_id, choice: ad.choice || null, price_paid: 0 })
        }
      } else {
        const tb = tables[p.tableIndex!]
        seatIdsByTable[p.tableIndex!].push(t.id)
        for (const r of tb.responses || []) {
          if (!r.field_id || !r.value?.trim()) continue
          responseRows.push({ event_id: eventId, ticket_id: t.id, field_id: r.field_id, response: r.value.trim() })
        }
      }
    })

    tables.forEach((tb, tableIndex) => {
      const seatIds = seatIdsByTable[tableIndex]
      // One seat cursor PER ADD-ON: choice splits of the same add-on
      // ("3 chicken, 5 fish") fill distinct seats, while different add-ons
      // (a meal and a drink) can land on the same seat. Quantities are
      // already validated to be <= seats_per_unit per add-on.
      const cursorByAddon: Record<string, number> = {}
      for (const ad of tb.addons || []) {
        for (let i = 0; i < ad.quantity; i++) {
          const cursor = cursorByAddon[ad.addon_id] || 0
          if (cursor >= seatIds.length) break
          addonRowsToInsert.push({ ticket_id: seatIds[cursor], addon_id: ad.addon_id, choice: ad.choice || null, price_paid: 0 })
          cursorByAddon[ad.addon_id] = cursor + 1
        }
      }
    })

    if (responseRows.length > 0) {
      const { error: responseErr } = await admin.from('event_registration_responses').insert(responseRows)
      if (responseErr) console.error('[embed/rsvp] failed to save responses:', responseErr)
    }
    if (addonRowsToInsert.length > 0) {
      const { error: addonErr } = await admin.from('ticket_addons').insert(addonRowsToInsert)
      if (addonErr) console.error('[embed/rsvp] failed to save ticket add-ons:', addonErr)
    }

    // Notify individual attendees who have their own distinct email.
    const attendeesNeedingEmail = inserted
      .map((t, i) => ({ ticket: t, p: pending[i] }))
      .filter(({ ticket, p }) => p.attendeeIndex !== undefined && ticket.attendee_email && ticket.attendee_email !== buyerEmail)

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

        for (const { ticket } of attendeesNeedingEmail) {
          try {
            await sendAttendeeTicketEmail({
              to: ticket.attendee_email!,
              attendeeName: ticket.buyer_name || null,
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

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0)
    const hasTables = items.some((it) => tierById.get(it.tierId)?.is_group)
    return NextResponse.json(
      { ok: true, message: `RSVP confirmed for ${totalQuantity} ${hasTables ? 'table(s)' : `guest${totalQuantity > 1 ? 's' : ''}`}` },
      { headers: corsHeaders() }
    )
  } catch (err: any) {
    console.error('[embed/rsvp] error:', err)
    return jsonError('Internal server error', 500)
  }
}
