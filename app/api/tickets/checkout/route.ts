import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import {
  stripe,
  serviceFeeAmount,
  applicationFeeAmount,
} from '@/lib/stripe'

/**
 * POST /api/tickets/checkout
 *
 * Cart checkout with full per-attendee data. A buyer can purchase
 * multiple DIFFERENT tiers in one transaction (e.g. 2 "Regular" + 1
 * "Artist"), and each individual ticket collects its own attendee
 * name and its own answers to that tier's questions — not one shared
 * name/answer set for the whole order.
 *
 * The "guest"/purchaser fields remain separate from attendee data:
 * they're the billing identity (who's charged, who gets the Stripe
 * customer record and the order confirmation email), not necessarily
 * who's attending. Attendee 1 is prefilled from the purchaser's name
 * client-side for convenience on single-ticket orders, but that's a
 * UI nicety — server-side, attendees are independent data.
 *
 * All items in one checkout call must be PAID tiers (price > 0). Free
 * tiers go through /api/tickets/rsvp — the two can't be mixed in one
 * transaction.
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

// Stripe metadata: 500 chars per value, 50 keys max. A full order
// (tier/quantity/price + every attendee's name and answers) is packed
// as one JSON blob, chunked across order_data_0.._N so it scales with
// however many attendees/questions an order actually has.
const METADATA_CHUNK_SIZE = 450
const MAX_METADATA_CHUNKS = 40
const MAX_NAME_LEN = 60
const MAX_ANSWER_LEN = 120

function chunkString(input: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < input.length; i += size) chunks.push(input.slice(i, i + size))
  return chunks
}

type PackedItem = { t: string; q: number; u: number }
type PackedAttendee = { t: string; n: string; e: string | null; r: { i: string; v: string }[] }

function packOrderForMetadata(items: PackedItem[], attendees: PackedAttendee[]): Record<string, string> {
  const packed = {
    items,
    attendees: attendees.map((a) => ({
      t: a.t,
      n: a.n.slice(0, MAX_NAME_LEN),
      e: a.e ? a.e.slice(0, 200) : null,
      r: a.r.map((r) => ({ i: r.i, v: r.v.slice(0, MAX_ANSWER_LEN) })),
    })),
  }
  const json = JSON.stringify(packed)
  const chunks = chunkString(json, METADATA_CHUNK_SIZE).slice(0, MAX_METADATA_CHUNKS)
  const out: Record<string, string> = { order_data_count: String(chunks.length) }
  chunks.forEach((c, i) => { out[`order_data_${i}`] = c })
  return out
}

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
      return NextResponse.json({ error: 'eventId and at least one cart item are required' }, { status: 400 })
    }
    if (!user && !guest) {
      return NextResponse.json({ error: 'Buyer information is required for guest checkout' }, { status: 400 })
    }
    if (!user && guest && (!guest.name?.trim() || !guest.email?.trim())) {
      return NextResponse.json({ error: 'Guest name and email are required' }, { status: 400 })
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
    // Attendee counts per tier must match the cart exactly.
    for (const it of items) {
      const count = attendees.filter((a) => a.tierId === it.tierId).length
      if (count !== it.quantity) {
        return NextResponse.json({ error: 'Attendee details don\'t match the cart quantities' }, { status: 400 })
      }
    }

    const admin = createAdminClient()
    const origin = request.nextUrl.origin
    const tierIds = items.map((it) => it.tierId)

    const { data: tierRows, error: tiersError } = await admin
      .from('ticket_tiers')
      .select(`
        id, name, description, price, quantity, quantity_sold, is_active,
        sale_starts_at, sale_ends_at, event_id,

        events!inner (
          id, title, slug, auth_user_id,
          profiles!events_auth_user_id_profile_fkey ( id, stripe_account_id, stripe_account_status )
        )
      `)
      .in('id', tierIds)
      .eq('event_id', eventId)

    if (tiersError || !tierRows || tierRows.length !== tierIds.length) {
      console.error('[tickets/checkout] tier query error:', tiersError)
      return NextResponse.json({ error: 'One or more ticket tiers were not found' }, { status: 404 })
    }

    const event = Array.isArray(tierRows[0].events) ? tierRows[0].events[0] : tierRows[0].events
    const creatorProfile = Array.isArray(event?.profiles) ? event.profiles[0] : event?.profiles

    const tierById = new Map(tierRows.map((t) => [t.id, t]))
    const now = new Date()

    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      if (Number(tier.price) === 0) {
        return NextResponse.json(
          { error: `"${tier.name}" is free — free and paid tickets can't be purchased together. Please check out separately.` },
          { status: 400 }
        )
      }
      if (!tier.is_active) {
        return NextResponse.json({ error: `"${tier.name}" is not currently available` }, { status: 400 })
      }
      if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) {
        return NextResponse.json({ error: `"${tier.name}" sales have not started yet` }, { status: 400 })
      }
      if (tier.sale_ends_at && new Date(tier.sale_ends_at) < now) {
        return NextResponse.json({ error: `"${tier.name}" sales have ended` }, { status: 400 })
      }
      if (tier.quantity !== null) {
        const remaining = tier.quantity - tier.quantity_sold
        if (remaining < it.quantity) {
          return NextResponse.json({ error: `Only ${remaining} "${tier.name}" ticket(s) remaining` }, { status: 400 })
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

    // Organizer Stripe setup
    const stripeAccountId = creatorProfile?.stripe_account_id
    const stripeStatus = creatorProfile?.stripe_account_status
    if (!stripeAccountId) {
      return NextResponse.json({ error: 'Event creator has not connected Stripe' }, { status: 400 })
    }
    if (stripeStatus !== 'enabled') {
      return NextResponse.json({ error: 'Event creator has not completed payment setup' }, { status: 400 })
    }

    // Buyer / customer handling (purchaser identity — separate from attendees)
    let customerId: string
    let buyerEmail: string
    let buyerName: string | null
    let buyerPhone: string | null
    let buyerUserId: string | null

    if (user) {
      const { data: buyerProfile } = await admin
        .from('profiles')
        .select('email, full_name, phone_number, stripe_customer_id')
        .eq('id', user.id)
        .single()

      buyerEmail = buyerProfile?.email || user.email || ''
      buyerName = buyerProfile?.full_name || null
      buyerPhone = buyerProfile?.phone_number || null
      buyerUserId = user.id

      let existingCustomerId = buyerProfile?.stripe_customer_id
      if (!existingCustomerId) {
        const customer = await stripe.customers.create({
          email: buyerEmail,
          name: buyerName || undefined,
          phone: buyerPhone || undefined,
          metadata: { supabase_user_id: user.id },
        })
        existingCustomerId = customer.id
        await admin.from('profiles').update({ stripe_customer_id: existingCustomerId }).eq('id', user.id)
      }
      customerId = existingCustomerId
    } else {
      buyerEmail = guest.email.trim().toLowerCase()
      buyerName = guest.name.trim()
      buyerPhone = guest.phone || null
      buyerUserId = null

      const customer = await stripe.customers.create({
        email: buyerEmail,
        name: buyerName || undefined,
        phone: buyerPhone || undefined,
        metadata: { guest_checkout: 'true' },
      })
      customerId = customer.id
    }

    // Pricing — one line item per tier, plus one aggregated service fee line.
    const lineItems: import('stripe').Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let totalServiceFeeCents = 0
    let totalApplicationFeeCents = 0
    const packedItems: PackedItem[] = []

    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      const unitAmount = Math.round(Number(tier.price) * 100)
      const serviceFeePerTicket = serviceFeeAmount(unitAmount)
      const appFeePerTicket = applicationFeeAmount(unitAmount)

      totalServiceFeeCents += serviceFeePerTicket * it.quantity
      totalApplicationFeeCents += appFeePerTicket * it.quantity
      packedItems.push({ t: it.tierId, q: it.quantity, u: unitAmount })

      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          product_data: {
            name: `${tier.name} — ${event.title}`,
            description: tier.description || undefined,
            metadata: { tier_id: tier.id, event_id: eventId },
          },
        },
        quantity: it.quantity,
      })
    }

    if (totalServiceFeeCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: totalServiceFeeCents,
          product_data: { name: 'Service fee', description: 'Covers payment processing.' },
        },
        quantity: 1,
      })
    }

    const packedAttendees: PackedAttendee[] = attendees.map((a) => ({
      t: a.tierId,
      n: a.name.trim(),
      e: a.email?.trim().toLowerCase() || null,
      r: a.responses.filter((r) => r.field_id && r.value).map((r) => ({ i: r.field_id, v: r.value })),
    }))

    const sessionMetadata: Record<string, string> = {
      event_id: eventId,
      total_quantity: String(totalQuantity),
      buyer_email: buyerEmail,
      buyer_name: buyerName || '',
      buyer_phone: buyerPhone || '',
      ...packOrderForMetadata(packedItems, packedAttendees),
    }
    if (buyerUserId) sessionMetadata.buyer_user_id = buyerUserId

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: totalApplicationFeeCents,
        transfer_data: { destination: stripeAccountId },
        metadata: sessionMetadata,
      },
      metadata: sessionMetadata,
      success_url: `${origin}/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/events/${event.slug}?ticket_cancelled=1`,
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (err: any) {
    console.error('[tickets/checkout] error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create checkout session' }, { status: 500 })
  }
}
