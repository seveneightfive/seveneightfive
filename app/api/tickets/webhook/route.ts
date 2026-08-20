import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { stripe } from '@/lib/stripe'
import { syncStripeAccountToProfile } from '@/lib/stripeSync'
import { sendTicketEmail, sendAttendeeTicketEmail } from '@/app/lib/email'

/**
 * POST /api/tickets/webhook
 *
 * Stripe webhook handler. Verifies signature, then dispatches on event.type:
 *   - checkout.session.completed → mint ticket(s) + send email / activate ads
 *   - payment_intent.succeeded   → fallback ticket mint + email
 *   - charge.refunded            → mark refunded
 *   - account.updated            → sync Connect status to profile
 *
 * GROUP/TABLE TIERS: an order_data item with g:true mints
 * quantity * seats_per_unit ticket rows (not quantity rows) — one
 * "table" purchase covers seats_per_unit seats, all under the
 * purchaser's name since there's no per-seat identity collected.
 *
 * ADD-ONS: attendee-level add-ons (individual tiers) attach directly
 * to that attendee's ticket. Table-level add-ons (group tiers) are
 * aggregate quantities + a choice breakdown for the whole table,
 * distributed across that table's minted seat rows — order doesn't
 * matter since none of those rows have a specific name attached.
 *
 * Metadata parsing supports three generations, oldest last:
 *   1. order_data_* (current — items + attendees + tables, each with addons)
 *   2. cart_items_* and custom_responses_* (multi-tier, no per-attendee names, no addons)
 *   3. tier_id/quantity/custom_responses (original single-tier)
 * Older sessions still in flight when this shipped complete correctly.
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: import('stripe').Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('[webhook] signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const admin = createClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as import('stripe').Stripe.Checkout.Session
        if (session.payment_status !== 'paid') break

        const meta = session.metadata || {}

        if (meta.type === 'advertisement' && meta.ad_id) {
          const { error: adError } = await admin
            .from('advertisements')
            .update({ payment_status: 'paid', status: 'active' })
            .eq('id', meta.ad_id)
          if (adError) {
            console.error('[webhook] failed to activate advertisement:', adError)
            return NextResponse.json({ error: 'Failed to activate advertisement' }, { status: 500 })
          }
          console.log(`[webhook] advertisement ${meta.ad_id} activated`)
          break
        }

        const eventId = meta.event_id
        const buyerUserId = meta.buyer_user_id || null
        const paymentIntentId =
          (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id) ?? null

        const order = parseOrder(meta)
        if (!eventId || order.items.length === 0) {
          console.error('[webhook] checkout.session.completed missing event_id/order items', meta)
          break
        }

        const buyerInfo = await resolveBuyerInfo({ metadata: meta, buyerUserId, session, admin })
        if (!buyerInfo.email) {
          console.error('[webhook] could not resolve buyer email', meta)
          return NextResponse.json({ error: 'Buyer email could not be resolved' }, { status: 500 })
        }

        const platformFee = paymentIntentId ? await getPlatformFee(paymentIntentId) : null

        await mintOrderTickets({
          admin, eventId, order, buyerUserId, buyerInfo,
          paymentIntentId, checkoutSessionId: session.id,
          totalPlatformFeeCents: platformFee ? Math.round(platformFee * 100) : null,
          orderRef: session.id,
        })
        break
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as import('stripe').Stripe.PaymentIntent
        const meta = pi.metadata || {}

        const order = parseOrder(meta)
        if (order.items.length === 0) break

        const { data: existing } = await admin
          .from('tickets')
          .select('id')
          .eq('stripe_payment_intent_id', pi.id)
          .limit(1)
          .maybeSingle()
        if (existing) break

        const buyerUserId = meta.buyer_user_id || null
        const buyerInfo = await resolveBuyerInfo({ metadata: meta, buyerUserId, session: null, admin })
        if (!buyerInfo.email) {
          console.error('[webhook] payment_intent.succeeded could not resolve buyer email', meta)
          break
        }

        await mintOrderTickets({
          admin, eventId: meta.event_id, order, buyerUserId, buyerInfo,
          paymentIntentId: pi.id, checkoutSessionId: null,
          totalPlatformFeeCents: pi.application_fee_amount ?? null,
          orderRef: pi.id,
        })
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as import('stripe').Stripe.Charge
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        if (!piId) break
        await admin.from('tickets').update({ payment_status: 'refunded', status: 'refunded' }).eq('stripe_payment_intent_id', piId)
        break
      }

      case 'account.updated': {
        const account = event.data.object as import('stripe').Stripe.Account
        try {
          await syncStripeAccountToProfile(admin, account.id)
          console.log(`[webhook] synced Connect account ${account.id}`)
        } catch (err) {
          console.error('[webhook] account.updated sync failed:', err)
        }
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[webhook] handler error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Metadata parsing ────────────────────────────────────────────────

type OrderItem = { tierId: string; quantity: number; unitAmountCents: number; isGroup: boolean; seatsPerUnit: number }
type OrderAttendeeAddon = { addonId: string; choice: string | null }
type OrderAttendee = { tierId: string; name: string | null; email: string | null; responses: { fieldId: string; value: string }[]; addons: OrderAttendeeAddon[] }
type OrderTableAddon = { addonId: string; choice: string | null; quantity: number; unitAmountCents: number }
type OrderTable = { tierId: string; responses: { fieldId: string; value: string }[]; addons: OrderTableAddon[] }
type Order = { items: OrderItem[]; attendees: OrderAttendee[]; tables: OrderTable[] }

function readChunked(meta: Record<string, string>, prefix: string): string | null {
  const countKey = `${prefix}_count`
  if (!meta[countKey]) return null
  const count = parseInt(meta[countKey], 10) || 0
  let json = ''
  for (let i = 0; i < count; i++) json += meta[`${prefix}_${i}`] || ''
  return json
}

function parseOrder(meta: Record<string, string>): Order {
  const empty: Order = { items: [], attendees: [], tables: [] }

  // Current format
  const orderJson = readChunked(meta, 'order_data')
  if (orderJson) {
    try {
      const parsed = JSON.parse(orderJson) as {
        items: { t: string; q: number; u: number; g?: boolean; s?: number }[]
        attendees: { t: string; n: string; e: string | null; r: { i: string; v: string }[]; a?: { i: string; c: string | null }[] }[]
        tables?: { t: string; r: { i: string; v: string }[]; a?: { i: string; c: string | null; q: number; u: number }[] }[]
      }
      return {
        items: (parsed.items || []).filter((it) => it?.t && it.q > 0).map((it) => ({
          tierId: it.t, quantity: it.q, unitAmountCents: it.u || 0,
          isGroup: !!it.g, seatsPerUnit: it.s || 1,
        })),
        attendees: (parsed.attendees || []).map((a) => ({
          tierId: a.t, name: a.n || null, email: a.e || null,
          responses: (a.r || []).map((r) => ({ fieldId: r.i, value: r.v })),
          addons: (a.a || []).map((ad) => ({ addonId: ad.i, choice: ad.c })),
        })),
        tables: (parsed.tables || []).map((tb) => ({
          tierId: tb.t,
          responses: (tb.r || []).map((r) => ({ fieldId: r.i, value: r.v })),
          addons: (tb.a || []).map((ad) => ({ addonId: ad.i, choice: ad.c, quantity: ad.q, unitAmountCents: ad.u })),
        })),
      }
    } catch (err) {
      console.error('[webhook] failed to parse order_data metadata:', err)
      return empty
    }
  }

  // Previous multi-tier format (no per-attendee names, no addons, no group tiers)
  const cartJson = readChunked(meta, 'cart_items')
  if (cartJson) {
    try {
      const items = (JSON.parse(cartJson) as { t: string; q: number; u: number }[])
        .filter((it) => it?.t && it.q > 0)
        .map((it) => ({ tierId: it.t, quantity: it.q, unitAmountCents: it.u || 0, isGroup: false, seatsPerUnit: 1 }))

      const responsesJson = readChunked(meta, 'custom_responses')
      let eventResponses: { i: string; v: string }[] = []
      let byTier: Record<string, { i: string; v: string }[]> = {}
      if (responsesJson) {
        try {
          const parsed = JSON.parse(responsesJson)
          eventResponses = parsed?.e || []
          byTier = parsed?.t || {}
        } catch { /* ignore */ }
      }

      const attendees: OrderAttendee[] = []
      for (const it of items) {
        const tierResponses = [...eventResponses, ...(byTier[it.tierId] || [])].map((r) => ({ fieldId: r.i, value: r.v }))
        for (let i = 0; i < it.quantity; i++) {
          attendees.push({ tierId: it.tierId, name: null, email: null, responses: tierResponses, addons: [] })
        }
      }
      return { items, attendees, tables: [] }
    } catch (err) {
      console.error('[webhook] failed to parse legacy cart_items metadata:', err)
      return empty
    }
  }

  // Original single-tier format
  if (meta.tier_id) {
    const quantity = parseInt(meta.quantity || '1', 10)
    const unitAmountCents = parseInt(meta.ticket_unit_amount || '0', 10)
    let eventResponses: { i: string; v: string }[] = []
    if (meta.custom_responses) {
      try { eventResponses = JSON.parse(meta.custom_responses) } catch { /* ignore */ }
    }
    const responses = eventResponses.map((r) => ({ fieldId: r.i, value: r.v }))
    const attendees: OrderAttendee[] = Array.from({ length: quantity }, () => ({
      tierId: meta.tier_id, name: null, email: null, responses, addons: [],
    }))
    return { items: [{ tierId: meta.tier_id, quantity, unitAmountCents, isGroup: false, seatsPerUnit: 1 }], attendees, tables: [] }
  }

  return empty
}

// ── Ticket minting ──────────────────────────────────────────────────

async function mintOrderTickets(args: {
  admin: ReturnType<typeof createClient>
  eventId: string
  order: Order
  buyerUserId: string | null
  buyerInfo: { email: string; name: string | null; phone: string | null }
  paymentIntentId: string | null
  checkoutSessionId: string | null
  totalPlatformFeeCents: number | null
  orderRef: string
}) {
  const {
    admin, eventId, order, buyerUserId, buyerInfo, paymentIntentId,
    checkoutSessionId, totalPlatformFeeCents, orderRef,
  } = args

  const unitAmountByTier = new Map(order.items.map((it) => [it.tierId, it.unitAmountCents]))

  // Build a flat "pending seat" list: one entry per ticket row about
  // to be minted. Individual-tier attendees map 1:1. Group-tier
  // tables expand into seatsPerUnit rows each, all under the
  // purchaser's name.
  type PendingSeat = {
    tierId: string
    buyerName: string | null
    isTableRow: boolean
    attendeeIndex?: number // index into order.attendees, for individual seats
    tableIndex?: number    // index into order.tables, for table seats
  }
  const pending: PendingSeat[] = []

  order.attendees.forEach((a, i) => {
    pending.push({ tierId: a.tierId, buyerName: a.name, isTableRow: false, attendeeIndex: i })
  })
  order.tables.forEach((tb, tableIndex) => {
    const item = order.items.find((it) => it.tierId === tb.tierId)
    const seats = item?.seatsPerUnit || 1
    // A single `tables` entry represents ONE table; if quantity > 1
    // tables of the same tier were bought, each gets its own entry in
    // order.tables (checkout route emits one table entry per unit).
    for (let i = 0; i < seats; i++) {
      pending.push({ tierId: tb.tierId, buyerName: buyerInfo.name, isTableRow: true, tableIndex })
    }
  })

  const totalQuantity = pending.length
  const platformFeePerTicketCents = totalPlatformFeeCents && totalQuantity ? totalPlatformFeeCents / totalQuantity : 0

  const ticketRows = pending.map((p) => {
    const attendee = p.attendeeIndex !== undefined ? order.attendees[p.attendeeIndex] : null
    return {
      ticket_tier_id: p.tierId,
      event_id: eventId,
      buyer_user_id: buyerUserId,
      buyer_email: buyerInfo.email,
      buyer_name: p.buyerName || buyerInfo.name,
      buyer_phone: buyerInfo.phone,
      attendee_email: attendee?.email || null,
      stripe_payment_intent_id: paymentIntentId,
      stripe_checkout_session_id: checkoutSessionId,
      payment_status: 'paid' as const,
      amount_paid: (unitAmountByTier.get(p.tierId) || 0) / (p.isTableRow ? (order.items.find((it) => it.tierId === p.tierId)?.seatsPerUnit || 1) : 1) / 100,
      platform_fee: platformFeePerTicketCents / 100,
      status: 'valid' as const,
    }
  })

  const { data: inserted, error: insertError } = await admin
    .from('tickets')
    .insert(ticketRows)
    .select('id, qr_token, ticket_tier_id, attendee_email')

  if (insertError || !inserted) {
    console.error('[webhook] failed to insert tickets:', insertError)
    throw new Error('Failed to create tickets')
  }

  console.log(`[webhook] minted ${inserted.length} ticket(s) across ${order.items.length} tier(s) for event ${eventId} (guest=${!buyerUserId})`)

  // Custom question responses — individual attendees get their own
  // answers; every seat of a table gets that table's answers
  // duplicated (keeps existing per-ticket response display/CSV code
  // working unchanged).
  const responseRows: Record<string, any>[] = []
  inserted.forEach((t, i) => {
    const p = pending[i]
    const responses = p.isTableRow
      ? order.tables[p.tableIndex!]?.responses || []
      : order.attendees[p.attendeeIndex!]?.responses || []
    for (const r of responses) {
      if (!r.fieldId || !r.value) continue
      responseRows.push({ event_id: eventId, ticket_id: t.id, field_id: r.fieldId, response: r.value })
    }
  })
  if (responseRows.length > 0) {
    const { error: responseErr } = await admin.from('event_registration_responses').insert(responseRows)
    if (responseErr) console.error('[webhook] failed to save responses:', responseErr)
  }

  // Add-ons — individual attendees attach directly to their own
  // ticket. Table add-on quantities get distributed across that
  // table's minted seat rows.
  const addonRows: Record<string, any>[] = []
  inserted.forEach((t, i) => {
    const p = pending[i]
    if (p.isTableRow) return
    const attendee = order.attendees[p.attendeeIndex!]
    for (const ad of attendee?.addons || []) {
      addonRows.push({ ticket_id: t.id, addon_id: ad.addonId, choice: ad.choice, price_paid: 0 }) // price_paid backfilled below
    }
  })

  order.tables.forEach((tb, tableIndex) => {
    const seatTicketIds = inserted
      .map((t, i) => ({ t, p: pending[i] }))
      .filter(({ p }) => p.isTableRow && p.tableIndex === tableIndex)
      .map(({ t }) => t.id)

    let seatCursor = 0
    for (const ad of tb.addons) {
      for (let i = 0; i < ad.quantity; i++) {
        const ticketId = seatTicketIds[seatCursor]
        if (!ticketId) break
        addonRows.push({ ticket_id: ticketId, addon_id: ad.addonId, choice: ad.choice, price_paid: ad.unitAmountCents / 100 })
        seatCursor++
      }
    }
  })

  // Backfill price_paid for individual-attendee addons (webhook has
  // the addon's unit price only via the packed attendee data if we
  // stored it — current format doesn't carry per-attendee-addon price
  // separately since it's identical to the addon's price at purchase
  // time; look it up once here).
  if (addonRows.some((r) => r.price_paid === 0 && r.addon_id)) {
    const addonIds = [...new Set(addonRows.map((r) => r.addon_id))]
    const { data: addonPrices } = await admin.from('event_addons').select('id, price').in('id', addonIds)
    const priceById = new Map((addonPrices || []).map((a) => [a.id, Number(a.price)]))
    for (const r of addonRows) {
      if (r.price_paid === 0 && priceById.has(r.addon_id)) {
        // Only backfill individual-attendee rows (table rows already
        // have the correct snapshot price set above).
        const wasTableRow = order.tables.some((tb) => tb.addons.some((ad) => ad.addonId === r.addon_id))
        if (!wasTableRow || priceById.get(r.addon_id) === 0) r.price_paid = priceById.get(r.addon_id) || 0
      }
    }
  }

  if (addonRows.length > 0) {
    const { error: addonErr } = await admin.from('ticket_addons').insert(addonRows)
    if (addonErr) console.error('[webhook] failed to save ticket add-ons:', addonErr)
  }

  // Confirmation email — one order confirmation to the purchaser,
  // covering every seat with its correct tier name and attendee name.
  let eventDetails: {
    title: string; slug: string; date: string | null; startTime: string | null; endTime: string | null
    image_url: string | null; venueName: string | null; venueAddress: string | null
  } | null = null
  let organizerName: string | null = null
  let organizerEmail: string | null = null

  try {
    const tierIds = [...new Set(order.items.map((it) => it.tierId))]
    const { data: tierRows } = await admin.from('ticket_tiers').select('id, name').in('id', tierIds)
    const tierNameById = new Map((tierRows || []).map((t) => [t.id, t.name]))

    const { data: ev } = await admin
      .from('events')
      .select(`
        title, slug, image_url, event_date, event_start_time, event_end_time, auth_user_id,
        venues ( name, address ), profiles!events_auth_user_id_profile_fkey ( full_name, email )
      `)
      .eq('id', eventId)
      .single()

    if (ev) {
      const venue = Array.isArray(ev.venues) ? ev.venues[0] : ev.venues
      const creatorProfile = Array.isArray(ev.profiles) ? ev.profiles[0] : ev.profiles
      eventDetails = {
        title: ev.title, slug: ev.slug, date: ev.event_date, startTime: ev.event_start_time,
        endTime: ev.event_end_time, image_url: ev.image_url,
        venueName: venue?.name || null, venueAddress: venue?.address || null,
      }
      organizerName = creatorProfile?.full_name || null
      organizerEmail = creatorProfile?.email || null
    }

    if (eventDetails) {
      await sendTicketEmail({
        to: buyerInfo.email,
        buyerName: buyerInfo.name,
        event: { ...eventDetails, venueCityState: null },
        tickets: inserted.map((t, i) => ({
          qr_token: t.qr_token,
          ticket_tier_name: tierNameById.get(t.ticket_tier_id) || 'Ticket',
          attendee_name: pending[i].isTableRow ? null : (order.attendees[pending[i].attendeeIndex!]?.name || null),
        })),
        amountPaid: ticketRows.reduce((sum, r) => sum + (r.amount_paid || 0), 0),
        orderRef,
        organizerName,
        organizerEmail,
      })
    }
  } catch (emailErr) {
    console.error('[webhook] ticket email send failed (non-fatal):', emailErr)
  }

  // Attendee notifications — individual tickets only, when a distinct
  // email was given (table seats have no per-seat email).
  if (eventDetails) {
    const buyerEmailLower = buyerInfo.email.toLowerCase()
    for (let i = 0; i < inserted.length; i++) {
      const t = inserted[i]
      const p = pending[i]
      if (p.isTableRow) continue
      const attendeeEmail = t.attendee_email
      if (!attendeeEmail || attendeeEmail.toLowerCase() === buyerEmailLower) continue

      try {
        const { data: tierRow } = await admin.from('ticket_tiers').select('name').eq('id', t.ticket_tier_id).single()
        await sendAttendeeTicketEmail({
          to: attendeeEmail,
          attendeeName: order.attendees[p.attendeeIndex!]?.name || null,
          purchaserName: buyerInfo.name,
          event: { ...eventDetails, venueCityState: null },
          ticket: { qr_token: t.qr_token, ticket_tier_name: tierRow?.name || 'Ticket' },
          amountPaid: null,
          organizerName,
          organizerEmail,
        })
      } catch (attendeeEmailErr) {
        console.error('[webhook] attendee notification send failed (non-fatal):', attendeeEmailErr)
      }
    }
  }
}

async function resolveBuyerInfo(args: {
  metadata: Record<string, string>
  buyerUserId: string | null
  session: import('stripe').Stripe.Checkout.Session | null
  admin: ReturnType<typeof createClient>
}): Promise<{ email: string; name: string | null; phone: string | null }> {
  const { metadata, buyerUserId, session, admin } = args

  let email = metadata.buyer_email || null
  let name = metadata.buyer_name || null
  let phone = metadata.buyer_phone || null

  if (buyerUserId && (!email || !name)) {
    const { data: profile } = await admin.from('profiles').select('email, full_name, phone_number').eq('id', buyerUserId).single()
    email = email || profile?.email || null
    name = name || profile?.full_name || null
    phone = phone || profile?.phone_number || null
  }

  if (session?.customer_details) {
    email = email || session.customer_details.email || null
    name = name || session.customer_details.name || null
    phone = phone || session.customer_details.phone || null
  }

  return { email: email || '', name, phone }
}

async function getPlatformFee(paymentIntentId: string): Promise<number | null> {
  try {
    const charges = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 })
    const fee = charges.data[0]?.application_fee_amount
    return fee ? fee / 100 : null
  } catch {
    return null
  }
}
