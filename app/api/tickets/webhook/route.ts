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
 * FULL PER-ATTENDEE DATA: /api/tickets/checkout packs the whole order
 * (tier/quantity/price + every individual attendee's name and answers)
 * as one JSON blob, chunked across order_data_0.._N metadata keys
 * (a single 500-char metadata value can't reliably hold an order with
 * several attendees, each with their own name and answers). Each
 * attendee becomes its own ticket row with its own buyer_name — not
 * a shared name duplicated across `quantity` identical rows like the
 * original single-tier implementation. Two older metadata shapes are
 * still parsed as a fallback so any session already in flight when
 * this ships still completes correctly:
 *   1. cart_items_*/custom_responses_* (multi-tier, order-level Q&A)
 *   2. tier_id/quantity/custom_responses (original single-tier)
 *
 * Buyer info resolution order (the purchaser/billing identity, not
 * attendees):
 *   1. metadata.buyer_email + metadata.buyer_name + metadata.buyer_phone
 *   2. Fallback: lookup profile by buyer_user_id (legacy code path)
 *   3. Last resort: pull from Stripe's session.customer_details
 *
 * Email sending: errors during email send are caught and logged but
 * do NOT fail the webhook. If we returned 500, Stripe would retry and
 * we'd double-mint tickets.
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }
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
      // ── checkout.session.completed ───────────────────────────────────
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
          typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id

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
          admin,
          eventId,
          order,
          buyerUserId,
          buyerInfo,
          paymentIntentId,
          checkoutSessionId: session.id,
          totalPlatformFeeCents: platformFee ? Math.round(platformFee * 100) : null,
          orderRef: session.id,
        })
        break
      }

      // ── payment_intent.succeeded (fallback) ──────────────────────────
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
        if (existing) break // checkout.session.completed already minted

        const buyerUserId = meta.buyer_user_id || null
        const buyerInfo = await resolveBuyerInfo({ metadata: meta, buyerUserId, session: null, admin })
        if (!buyerInfo.email) {
          console.error('[webhook] payment_intent.succeeded could not resolve buyer email', meta)
          break
        }

        await mintOrderTickets({
          admin,
          eventId: meta.event_id,
          order,
          buyerUserId,
          buyerInfo,
          paymentIntentId: pi.id,
          checkoutSessionId: null,
          totalPlatformFeeCents: pi.application_fee_amount ?? null,
          orderRef: pi.id,
        })
        break
      }

      // ── charge.refunded ──────────────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as import('stripe').Stripe.Charge
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        if (!piId) break
        await admin
          .from('tickets')
          .update({ payment_status: 'refunded', status: 'refunded' })
          .eq('stripe_payment_intent_id', piId)
        break
      }

      // ── account.updated ──────────────────────────────────────────────
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

type OrderItem = { tierId: string; quantity: number; unitAmountCents: number }
type OrderAttendee = { tierId: string; name: string | null; email: string | null; responses: { fieldId: string; value: string }[] }
type Order = { items: OrderItem[]; attendees: OrderAttendee[] }

function readChunked(meta: Record<string, string>, prefix: string): string | null {
  const countKey = `${prefix}_count`
  if (!meta[countKey]) return null
  const count = parseInt(meta[countKey], 10) || 0
  let json = ''
  for (let i = 0; i < count; i++) json += meta[`${prefix}_${i}`] || ''
  return json
}

/**
 * Parses the current order_data_* format (items + per-attendee name
 * and answers). Falls back to the two older metadata shapes for any
 * session already in flight when this shipped — see file header.
 */
function parseOrder(meta: Record<string, string>): Order {
  const empty: Order = { items: [], attendees: [] }

  // Current format
  const orderJson = readChunked(meta, 'order_data')
  if (orderJson) {
    try {
      const parsed = JSON.parse(orderJson) as {
        items: { t: string; q: number; u: number }[]
        attendees: { t: string; n: string; e: string | null; r: { i: string; v: string }[] }[]
      }
      return {
        items: (parsed.items || []).filter((it) => it?.t && it.q > 0).map((it) => ({
          tierId: it.t, quantity: it.q, unitAmountCents: it.u || 0,
        })),
        attendees: (parsed.attendees || []).map((a) => ({
          tierId: a.t,
          name: a.n || null,
          email: a.e || null,
          responses: (a.r || []).map((r) => ({ fieldId: r.i, value: r.v })),
        })),
      }
    } catch (err) {
      console.error('[webhook] failed to parse order_data metadata:', err)
      return empty
    }
  }

  // Previous multi-tier format (order-level Q&A, no per-attendee names)
  const cartJson = readChunked(meta, 'cart_items')
  if (cartJson) {
    try {
      const items = (JSON.parse(cartJson) as { t: string; q: number; u: number }[])
        .filter((it) => it?.t && it.q > 0)
        .map((it) => ({ tierId: it.t, quantity: it.q, unitAmountCents: it.u || 0 }))

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

      // No per-attendee names in this legacy format — every ticket in
      // a tier group shares the same (order-level) answers and a null
      // name, which falls back to the purchaser's name at insert time.
      const attendees: OrderAttendee[] = []
      for (const it of items) {
        const tierResponses = [...eventResponses, ...(byTier[it.tierId] || [])]
          .map((r) => ({ fieldId: r.i, value: r.v }))
        for (let i = 0; i < it.quantity; i++) {
          attendees.push({ tierId: it.tierId, name: null, email: null, responses: tierResponses })
        }
      }
      return { items, attendees }
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
      tierId: meta.tier_id, name: null, email: null, responses,
    }))
    return { items: [{ tierId: meta.tier_id, quantity, unitAmountCents }], attendees }
  }

  return empty
}

// ── Ticket minting ──────────────────────────────────────────────────

/**
 * Mints one ticket row per attendee — each with its own buyer_name
 * (falling back to the purchaser's name only for legacy orders that
 * had no per-attendee name captured) — saves each attendee's answers
 * against their specific ticket, and sends one confirmation email
 * covering the whole order with per-ticket attendee names.
 *
 * Platform fee is split evenly across the total ticket count (same
 * simplification as the original implementation — Stripe doesn't
 * expose a clean per-tier fee breakdown on a single PaymentIntent).
 */
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
  const totalQuantity = order.attendees.length
  const platformFeePerTicketCents = totalPlatformFeeCents && totalQuantity ? totalPlatformFeeCents / totalQuantity : 0

  // Insert order matches order.attendees order exactly — Postgres
  // preserves row order for a single multi-row INSERT ... RETURNING,
  // so we can zip the returned ids straight back to attendees below.
  const ticketRows = order.attendees.map((a) => ({
    ticket_tier_id: a.tierId,
    event_id: eventId,
    buyer_user_id: buyerUserId,
    buyer_email: buyerInfo.email,
    buyer_name: a.name || buyerInfo.name, // fallback covers legacy orders only
    buyer_phone: buyerInfo.phone,
    attendee_email: a.email,
    stripe_payment_intent_id: paymentIntentId,
    stripe_checkout_session_id: checkoutSessionId,
    payment_status: 'paid' as const,
    amount_paid: (unitAmountByTier.get(a.tierId) || 0) / 100,
    platform_fee: platformFeePerTicketCents / 100,
    status: 'valid' as const,
  }))

  const { data: inserted, error: insertError } = await admin
    .from('tickets')
    .insert(ticketRows)
    .select('id, qr_token, ticket_tier_id, attendee_email')

  if (insertError || !inserted) {
    console.error('[webhook] failed to insert tickets:', insertError)
    throw new Error('Failed to create tickets')
  }

  console.log(`[webhook] minted ${inserted.length} ticket(s) across ${order.items.length} tier(s) for event ${eventId} (guest=${!buyerUserId})`)

  // Save each attendee's answers against their own ticket.
  const responseRows: Record<string, any>[] = []
  inserted.forEach((t, i) => {
    const attendee = order.attendees[i]
    for (const r of attendee?.responses || []) {
      if (!r.fieldId || !r.value) continue
      responseRows.push({ event_id: eventId, ticket_id: t.id, field_id: r.fieldId, response: r.value })
    }
  })
  if (responseRows.length > 0) {
    const { error: responseErr } = await admin.from('event_registration_responses').insert(responseRows)
    if (responseErr) console.error('[webhook] failed to save attendee responses:', responseErr)
  }

  // Email — one confirmation covering every ticket, each with its own
  // correct tier name and attendee name.
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
        venues ( name, address ),
        profiles!events_auth_user_id_profile_fkey ( full_name, email )
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
          attendee_name: order.attendees[i]?.name || null,
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

  // Notify any attendee who has their own email that isn't the
  // purchaser's — one small email per attendee, just their ticket.
  if (eventDetails) {
    const buyerEmailLower = buyerInfo.email.toLowerCase()
    for (let i = 0; i < inserted.length; i++) {
      const t = inserted[i]
      const attendee = order.attendees[i]
      const attendeeEmail = t.attendee_email || attendee?.email
      if (!attendeeEmail || attendeeEmail.toLowerCase() === buyerEmailLower) continue

      const tierIds2 = [...new Set(order.items.map((it) => it.tierId))]
      try {
        const { data: tierRow } = await admin.from('ticket_tiers').select('name').eq('id', t.ticket_tier_id).single()
        await sendAttendeeTicketEmail({
          to: attendeeEmail,
          attendeeName: attendee?.name || null,
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
    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name, phone_number')
      .eq('id', buyerUserId)
      .single()
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
