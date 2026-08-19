import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { stripe, serviceFeeAmount, applicationFeeAmount } from '@/lib/stripe'

/**
 * POST /api/embed/checkout
 *
 * Public, CORS-open, GUEST-ONLY counterpart to /api/tickets/checkout,
 * used by the embed widget (public/embed/tickets.js) running on a
 * seller's own website. Two real differences from the main route:
 *
 *   1. Always guest — there's no way for a third-party page to send
 *      seveneightfive.com's session cookie cross-site (browsers block
 *      that by default), so this never looks up a logged-in user.
 *   2. ui_mode: 'embedded' instead of the default hosted mode — Stripe
 *      returns a client_secret instead of a redirect url, and the
 *      widget mounts the payment form inline via Stripe.js
 *      (initEmbeddedCheckout), so the buyer never navigates away from
 *      the seller's page for the common case (no 3-D Secure redirect
 *      needed). return_url is still required by Stripe as a fallback
 *      for payment methods that DO need a full-page redirect — it
 *      points at the same /tickets/success page the hosted flow uses.
 *
 * Order metadata is packed with the exact same order_data_* chunked
 * format as /api/tickets/checkout, so the existing webhook
 * (app/api/tickets/webhook/route.ts) needs zero changes to mint
 * tickets from embed orders — it can't tell the difference.
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

    if (!eventSlug || items.length === 0) {
      return jsonError('eventSlug and at least one cart item are required', 400)
    }
    if (!guest?.name?.trim() || !guest?.email?.trim()) {
      return jsonError('Name and email are required', 400)
    }

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0)
    if (attendees.length !== totalQuantity) {
      return jsonError('Attendee details are missing for one or more tickets', 400)
    }
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
      .select(`
        id, title, slug, auth_user_id, ticketing_enabled,
        profiles!events_auth_user_id_profile_fkey ( id, stripe_account_id, stripe_account_status )
      `)
      .eq('slug', eventSlug)
      .maybeSingle()

    if (!eventRow || !eventRow.ticketing_enabled) return jsonError('Event not found', 404)

    const eventId = eventRow.id
    const creatorProfile = Array.isArray(eventRow.profiles) ? eventRow.profiles[0] : eventRow.profiles
    const tierIds = items.map((it) => it.tierId)

    const { data: tierRows, error: tiersError } = await admin
      .from('ticket_tiers')
      .select('id, name, description, price, quantity, quantity_sold, is_active, sale_starts_at, sale_ends_at')
      .in('id', tierIds)
      .eq('event_id', eventId)

    if (tiersError || !tierRows || tierRows.length !== tierIds.length) {
      return jsonError('One or more ticket tiers were not found', 404)
    }

    const tierById = new Map(tierRows.map((t) => [t.id, t]))
    const now = new Date()

    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      if (Number(tier.price) === 0) {
        return jsonError(`"${tier.name}" is free — free and paid tickets can't be purchased together.`, 400)
      }
      if (!tier.is_active) return jsonError(`"${tier.name}" is not currently available`, 400)
      if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) return jsonError(`"${tier.name}" sales have not started yet`, 400)
      if (tier.sale_ends_at && new Date(tier.sale_ends_at) < now) return jsonError(`"${tier.name}" sales have ended`, 400)
      if (tier.quantity !== null) {
        const remaining = tier.quantity - tier.quantity_sold
        if (remaining < it.quantity) return jsonError(`Only ${remaining} "${tier.name}" ticket(s) remaining`, 400)
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
        if (!(responseMap.get(f.id) || '').length) {
          return jsonError(`"${f.label}" is required for ${a.name}.`, 400)
        }
      }
    }

    const stripeAccountId = creatorProfile?.stripe_account_id
    const stripeStatus = creatorProfile?.stripe_account_status
    if (!stripeAccountId || stripeStatus !== 'enabled') {
      return jsonError('This event is not yet accepting payments.', 400)
    }

    // Guest checkout only — no session lookup possible cross-origin.
    const buyerEmail = guest.email.trim().toLowerCase()
    const buyerName = guest.name.trim()
    const buyerPhone = guest.phone || null

    const customer = await stripe.customers.create({
      email: buyerEmail,
      name: buyerName,
      phone: buyerPhone || undefined,
      metadata: { guest_checkout: 'true', source: 'embed' },
    })

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
            name: `${tier.name} — ${eventRow.title}`,
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
      buyer_name: buyerName,
      buyer_phone: buyerPhone || '',
      source: 'embed',
      ...packOrderForMetadata(packedItems, packedAttendees),
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://seveneightfive.com'

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      customer: customer.id,
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: totalApplicationFeeCents,
        transfer_data: { destination: stripeAccountId },
        metadata: sessionMetadata,
      },
      metadata: sessionMetadata,
      return_url: `${origin}/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
    })

    return NextResponse.json({ clientSecret: session.client_secret }, { headers: corsHeaders() })
  } catch (err: any) {
    console.error('[embed/checkout] error:', err)
    return jsonError(err?.message || 'Failed to start checkout', 500)
  }
}
