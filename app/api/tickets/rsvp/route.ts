import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdmin } from '@/lib/supabaseServer'
import { sendAttendeeTicketEmail } from '@/app/lib/email'

/**
 * POST /api/tickets/rsvp
 *
 * Free ticket cart, with full per-attendee data, group/table tiers,
 * and add-ons — mirrors /api/tickets/checkout but mints immediately
 * since there's no Stripe round-trip. Every tier AND every selected
 * add-on in this request must be free (price 0) — if anything here
 * has a real price, the client should be using /api/tickets/checkout
 * instead. This route rejects such a mix defensively even though the
 * client already enforces it, since a stale cart or a bug could send
 * a mixed request.
 *
 * Body: {
 *   eventId: string,
 *   items: { tierId: string, quantity: number }[],
 *   guest?: { name: string, email: string, phone: string | null },
 *   attendees: {
 *     tierId: string, name: string, email?: string | null,
 *     responses: { field_id: string, value: string }[],
 *     addons: { addon_id: string, choice?: string | null }[]
 *   }[],
 *   tables: {
 *     tierId: string,
 *     responses: { field_id: string, value: string }[],
 *     addons: { addon_id: string, choice: string | null, quantity: number }[]
 *   }[]
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

    if (!eventId || items.length === 0) {
      return NextResponse.json({ error: 'eventId and at least one item are required' }, { status: 400 })
    }
    if (!user && !guest) return NextResponse.json({ error: 'Buyer information is required' }, { status: 400 })
    if (!user && guest && (!guest.name?.trim() || !guest.email?.trim())) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    const admin = createAdmin()
    const tierIds = items.map((it) => it.tierId)

    const { data: tierRows, error: tierError } = await admin
      .from('ticket_tiers')
      .select('id, name, price, quantity, quantity_sold, is_active, is_group, seats_per_unit')
      .in('id', tierIds)
      .eq('event_id', eventId)

    if (tierError || !tierRows || tierRows.length !== tierIds.length) {
      return NextResponse.json({ error: 'One or more ticket tiers were not found' }, { status: 404 })
    }

    const tierById = new Map(tierRows.map((t) => [t.id, t]))

    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      const expectedCount = tier.is_group
        ? tables.filter((tb) => tb.tierId === it.tierId).length
        : attendees.filter((a) => a.tierId === it.tierId).length
      if (expectedCount !== it.quantity) {
        return NextResponse.json(
          { error: `${tier.is_group ? 'Table' : 'Attendee'} details don't match the cart quantities for "${tier.name}".` },
          { status: 400 }
        )
      }
      if (Number(tier.price) !== 0) {
        return NextResponse.json(
          { error: `"${tier.name}" requires payment — please use checkout instead.` },
          { status: 400 }
        )
      }
      if (!tier.is_active) return NextResponse.json({ error: `"${tier.name}" is not currently available` }, { status: 400 })
      if (tier.quantity !== null) {
        const seatsPerUnit = tier.is_group ? tier.seats_per_unit : 1
        const unitsSold = Math.floor(tier.quantity_sold / seatsPerUnit)
        const unitsRemaining = tier.quantity - unitsSold
        if (unitsRemaining < it.quantity) {
          return NextResponse.json({ error: `Only ${unitsRemaining} ${tier.is_group ? 'table(s)' : 'spot(s)'} remaining for "${tier.name}"` }, { status: 400 })
        }
      }
    }
    for (const a of attendees) {
      if (!a.name?.trim()) return NextResponse.json({ error: 'Every ticket needs an attendee name' }, { status: 400 })
      if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) {
        return NextResponse.json({ error: `"${a.email}" doesn't look like a valid email.` }, { status: 400 })
      }
    }

    // Add-ons — must ALL be free in this flow.
    const addonIds = new Set<string>()
    for (const a of attendees) for (const ad of a.addons || []) addonIds.add(ad.addon_id)
    for (const tb of tables) for (const ad of tb.addons || []) addonIds.add(ad.addon_id)

    const { data: addonRows } = addonIds.size
      ? await admin.from('event_addons').select('id, ticket_tier_id, name, price, has_choice, choice_options, is_active').in('id', Array.from(addonIds))
      : { data: [] as any[] }
    const addonById = new Map((addonRows || []).map((a) => [a.id, a]))

    for (const id of addonIds) {
      const addon = addonById.get(id)
      if (!addon || !addon.is_active) return NextResponse.json({ error: 'One of the selected add-ons is no longer available.' }, { status: 400 })
      if (Number(addon.price) !== 0) {
        return NextResponse.json({ error: `"${addon.name}" has a cost — please use checkout instead.` }, { status: 400 })
      }
    }

    for (const a of attendees) {
      for (const ad of a.addons || []) {
        const addon = addonById.get(ad.addon_id)!
        if (addon.ticket_tier_id !== a.tierId) return NextResponse.json({ error: `"${addon.name}" isn't available for this ticket type.` }, { status: 400 })
        if (addon.has_choice) {
          const opts: string[] = addon.choice_options || []
          if (!ad.choice || !opts.includes(ad.choice)) return NextResponse.json({ error: `Please choose an option for "${addon.name}".` }, { status: 400 })
        }
      }
    }
    for (const tb of tables) {
      const tier = tierById.get(tb.tierId)!
      for (const ad of tb.addons || []) {
        const addon = addonById.get(ad.addon_id)!
        if (addon.ticket_tier_id !== tb.tierId) return NextResponse.json({ error: `"${addon.name}" isn't available for this ticket type.` }, { status: 400 })
        if (ad.quantity < 0 || ad.quantity > tier.seats_per_unit) {
          return NextResponse.json({ error: `"${addon.name}" quantity can't exceed the table's ${tier.seats_per_unit} seats.` }, { status: 400 })
        }
        if (addon.has_choice && ad.quantity > 0) {
          const opts: string[] = addon.choice_options || []
          if (!ad.choice || !opts.includes(ad.choice)) return NextResponse.json({ error: `Please choose an option for "${addon.name}".` }, { status: 400 })
        }
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
        if (!(responseMap.get(f.id) || '').length) return NextResponse.json({ error: `"${f.label}" is required for ${a.name}.` }, { status: 400 })
      }
    }
    for (const tb of tables) {
      const responseMap = new Map(tb.responses.map((r) => [r.field_id, (r.value || '').trim()]))
      const required = [...eventLevelRequired, ...(tierRequiredMap[tb.tierId] || [])]
      for (const f of required) {
        if (!(responseMap.get(f.id) || '').length) return NextResponse.json({ error: `"${f.label}" is required for the table.` }, { status: 400 })
      }
    }

    let buyerEmail: string
    let buyerName: string | null
    let buyerPhone: string | null
    let buyerUserId: string | null

    if (user) {
      const { data: profile } = await admin.from('profiles').select('email, full_name, phone_number').eq('id', user.id).single()
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

    const dedupeQuery = admin.from('tickets').select('id').eq('event_id', eventId).eq('payment_status', 'paid')
    const { data: existing } = buyerUserId
      ? await dedupeQuery.eq('buyer_user_id', buyerUserId).maybeSingle()
      : await dedupeQuery.ilike('buyer_email', buyerEmail).maybeSingle()
    if (existing) return NextResponse.json({ error: 'An RSVP already exists for this email at this event' }, { status: 400 })

    // ── Mint tickets ─────────────────────────────────────────────
    // Individual tiers: one row per attendee, exactly as before.
    // Group tiers: seats_per_unit rows per table, all under the
    // purchaser's name (no per-seat identity to collect).
    type PendingTicket = {
      tierId: string
      buyerName: string
      isTableRow: boolean
      tableIndex?: number // which `tables[]` entry this seat belongs to
    }
    const pending: PendingTicket[] = []

    for (const a of attendees) {
      pending.push({ tierId: a.tierId, buyerName: a.name.trim(), isTableRow: false })
    }
    tables.forEach((tb, tableIndex) => {
      const tier = tierById.get(tb.tierId)!
      for (let i = 0; i < tier.seats_per_unit; i++) {
        pending.push({ tierId: tb.tierId, buyerName: buyerName || 'Guest', isTableRow: true, tableIndex })
      }
    })

    const ticketRows = pending.map((p, i) => {
      const attendeeMatch = !p.isTableRow ? attendees[i] : null // attendees are pushed first, in order — index i directly corresponds
      return {
        ticket_tier_id: p.tierId,
        event_id: eventId,
        buyer_user_id: buyerUserId,
        buyer_email: buyerEmail,
        buyer_name: p.buyerName,
        buyer_phone: buyerPhone,
        attendee_email: !p.isTableRow ? (attendeeMatch?.email?.trim().toLowerCase() || null) : null,
        payment_status: 'paid' as const,
        amount_paid: 0,
        platform_fee: 0,
        status: 'valid' as const,
      }
    })

    const { data: inserted, error: insertError } = await admin
      .from('tickets')
      .insert(ticketRows)
      .select('id, qr_token, ticket_tier_id, attendee_email, buyer_name')

    if (insertError || !inserted) {
      console.error('[tickets/rsvp] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save your RSVP' }, { status: 500 })
    }

    // Save custom question responses. Individual tickets: their own
    // answers. Table tickets: the table's answers, duplicated across
    // every seat of that table (keeps existing per-ticket response
    // display/CSV code working with zero special-casing).
    const responseRows: Record<string, any>[] = []
    const addonRowsToInsert: Record<string, any>[] = []

    let attendeeCursor = 0
    inserted.forEach((t, i) => {
      const p = pending[i]
      if (!p.isTableRow) {
        const a = attendees[attendeeCursor]
        attendeeCursor++
        for (const r of a.responses || []) {
          if (!r.field_id || !r.value?.trim()) continue
          responseRows.push({ event_id: eventId, ticket_id: t.id, field_id: r.field_id, response: r.value.trim() })
        }
        for (const ad of a.addons || []) {
          const addon = addonById.get(ad.addon_id)!
          addonRowsToInsert.push({ ticket_id: t.id, addon_id: ad.addon_id, choice: ad.choice || null, price_paid: 0 })
        }
      } else {
        const tb = tables[p.tableIndex!]
        for (const r of tb.responses || []) {
          if (!r.field_id || !r.value?.trim()) continue
          responseRows.push({ event_id: eventId, ticket_id: t.id, field_id: r.field_id, response: r.value.trim() })
        }
      }
    })

    // Distribute each table's add-on selections across that table's
    // minted seat rows (order doesn't matter — no per-seat identity).
    tables.forEach((tb, tableIndex) => {
      const seatTicketIds = inserted
        .map((t, i) => ({ t, p: pending[i] }))
        .filter(({ p }) => p.isTableRow && p.tableIndex === tableIndex)
        .map(({ t }) => t.id)

      let seatCursor = 0
      for (const ad of tb.addons || []) {
        for (let i = 0; i < ad.quantity; i++) {
          const ticketId = seatTicketIds[seatCursor]
          if (!ticketId) break // shouldn't happen — validated above
          addonRowsToInsert.push({ ticket_id: ticketId, addon_id: ad.addon_id, choice: ad.choice || null, price_paid: 0 })
          seatCursor++
        }
      }
    })

    if (responseRows.length > 0) {
      const { error: responseErr } = await admin.from('event_registration_responses').insert(responseRows)
      if (responseErr) console.error('[tickets/rsvp] failed to save responses:', responseErr)
    }
    if (addonRowsToInsert.length > 0) {
      const { error: addonErr } = await admin.from('ticket_addons').insert(addonRowsToInsert)
      if (addonErr) console.error('[tickets/rsvp] failed to save ticket add-ons:', addonErr)
    }

    // Notify any attendee with their own distinct email (individual
    // tickets only — table seats have no per-seat email to notify).
    const buyerEmailLower = buyerEmail.toLowerCase()
    const attendeesNeedingEmail = inserted
      .map((t, i) => ({ ticket: t, pending: pending[i] }))
      .filter(({ ticket, pending: p }) => !p.isTableRow && ticket.attendee_email && ticket.attendee_email.toLowerCase() !== buyerEmailLower)

    if (attendeesNeedingEmail.length > 0) {
      try {
        const tierIdsForEmail = [...new Set(attendeesNeedingEmail.map((a) => a.ticket.ticket_tier_id))]
        const { data: tierRowsForEmail } = await admin.from('ticket_tiers').select('id, name').in('id', tierIdsForEmail)
        const tierNameById = new Map((tierRowsForEmail || []).map((t) => [t.id, t.name]))

        const { data: ev } = await admin
          .from('events')
          .select(`
            title, slug, image_url, event_date, event_start_time, event_end_time,
            venues ( name, address ), profiles!events_auth_user_id_profile_fkey ( full_name, email )
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
              console.error('[tickets/rsvp] attendee notification send failed (non-fatal):', attendeeEmailErr)
            }
          }
        }
      } catch (lookupErr) {
        console.error('[tickets/rsvp] attendee notification lookup failed (non-fatal):', lookupErr)
      }
    }

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0)

    return NextResponse.json({
      ok: true,
      tickets: inserted,
      message: `RSVP confirmed for ${totalQuantity} ${items.some((it) => tierById.get(it.tierId)?.is_group) ? 'table(s)' : 'guest(s)'}`,
    })
  } catch (err: any) {
    console.error('[tickets/rsvp] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
