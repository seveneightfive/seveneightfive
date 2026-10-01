import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { stripe, serviceFeeAmount, applicationFeeAmount } from '@/lib/stripe'
import { effectiveTierSaleEnd } from '@/lib/ticketSalesCutoff'

/**
 * POST /api/embed/checkout
 *
 * Public, CORS-open, GUEST-ONLY counterpart to /api/tickets/checkout,
 * used by the embed widget (public/embed/tickets.js) running on a
 * seller's own website. Validation, pricing, fees and the order
 * metadata format are the same as the main route — including
 * group/table tiers and priced add-ons — so the existing webhook mints
 * embed orders with no special-casing. Differences:
 *
 *   1. Always guest — a third-party page can't send seveneightfive.com's
 *      session cookie cross-site, so this never looks up a logged-in user.
 *   2. Looks the event up by slug (that's what the embed snippet carries).
 *   3. ui_mode: 'embedded' — Stripe returns a client_secret and the
 *      widget mounts the payment form inline. return_url is Stripe's
 *      fallback for payment methods that need a full-page redirect.
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

const METADATA_CHUNK_SIZE = 450
const MAX_METADATA_CHUNKS = 60
const MAX_NAME_LEN = 60
const MAX_ANSWER_LEN = 120

function chunkString(input: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < input.length; i += size) chunks.push(input.slice(i, i + size))
  return chunks
}

type PackedItem = { t: string; q: number; u: number; g: boolean; s: number }
type PackedAttendeeAddon = { i: string; c: string | null }
type PackedAttendee = { t: string; n: string; e: string | null; r: { i: string; v: string }[]; a: PackedAttendeeAddon[] }
type PackedTableAddon = { i: string; c: string | null; q: number; u: number }
type PackedTable = { t: string; r: { i: string; v: string }[]; a: PackedTableAddon[] }

function packOrderForMetadata(items: PackedItem[], attendees: PackedAttendee[], tables: PackedTable[]): Record<string, string> {
  const packed = {
    items,
    attendees: attendees.map((a) => ({
      t: a.t,
      n: a.n.slice(0, MAX_NAME_LEN),
      e: a.e ? a.e.slice(0, 200) : null,
      r: a.r.map((r) => ({ i: r.i, v: r.v.slice(0, MAX_ANSWER_LEN) })),
      a: a.a,
    })),
    tables: tables.map((tb) => ({
      t: tb.t,
      r: tb.r.map((r) => ({ i: r.i, v: r.v.slice(0, MAX_ANSWER_LEN) })),
      a: tb.a,
    })),
  }
  const json = JSON.stringify(packed)
  const chunks = chunkString(json, METADATA_CHUNK_SIZE)
  if (chunks.length > MAX_METADATA_CHUNKS) {
    // Truncating would corrupt the JSON and the webhook couldn't mint the
    // order after payment — refuse up front instead.
    throw new Error('This order is too large to process in one checkout. Please split it into smaller orders.')
  }
  const out: Record<string, string> = { order_data_count: String(chunks.length) }
  chunks.forEach((c, i) => { out[`order_data_${i}`] = c })
  return out
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

    if (!eventSlug || items.length === 0) return jsonError('eventSlug and at least one cart item are required', 400)
    if (!guest?.name?.trim() || !guest?.email?.trim()) return jsonError('Name and email are required', 400)

    const admin = createAdminClient()

    const { data: eventRow } = await admin
      .from('events')
      .select(`
        id, title, slug, auth_user_id, ticketing_enabled,
        event_date, event_start_time, ticket_sales_end_mode, ticket_sales_end_offset_minutes, ticket_sales_end_at,
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
      .select('id, name, description, price, quantity, quantity_sold, is_active, sale_starts_at, sale_ends_at, is_group, seats_per_unit')
      .in('id', tierIds)
      .eq('event_id', eventId)

    if (tiersError || !tierRows || tierRows.length !== tierIds.length) {
      return jsonError('One or more ticket tiers were not found', 404)
    }

    const tierById = new Map(tierRows.map((t) => [t.id, t]))
    const now = new Date()

    // ── Cart shape: one attendee per individual seat, one table entry per group unit ──
    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      const expectedCount = tier.is_group
        ? tables.filter((tb) => tb.tierId === it.tierId).length
        : attendees.filter((a) => a.tierId === it.tierId).length
      if (expectedCount !== it.quantity) {
        return jsonError(`${tier.is_group ? 'Table' : 'Attendee'} details don't match the cart quantities for "${tier.name}".`, 400)
      }
    }
    for (const a of attendees) {
      if (!a.name?.trim()) return jsonError('Every ticket needs an attendee name', 400)
      if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) {
        return jsonError(`"${a.email}" doesn't look like a valid email.`, 400)
      }
    }

    // ── Tier availability ──
    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      if (!tier.is_active) return jsonError(`"${tier.name}" is not currently available`, 400)
      if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) return jsonError(`"${tier.name}" sales have not started yet`, 400)
      const saleEnd = effectiveTierSaleEnd(tier.sale_ends_at, eventRow as any)
      if (saleEnd && saleEnd < now) return jsonError(`"${tier.name}" sales have ended`, 400)
      if (tier.quantity !== null) {
        const seatsPerUnit = tier.is_group ? tier.seats_per_unit : 1
        const unitsRemaining = tier.quantity - Math.floor(tier.quantity_sold / seatsPerUnit)
        if (unitsRemaining < it.quantity) {
          return jsonError(`Only ${unitsRemaining} ${tier.is_group ? 'table(s)' : 'ticket(s)'} remaining for "${tier.name}"`, 400)
        }
      }
    }

    // ── Add-ons ──
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

    const stripeAccountId = creatorProfile?.stripe_account_id
    if (!stripeAccountId || creatorProfile?.stripe_account_status !== 'enabled') {
      return jsonError('This event is not yet accepting payments.', 400)
    }

    // ── Line items & fees ──
    const lineItems: import('stripe').Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let totalServiceFeeCents = 0
    let totalApplicationFeeCents = 0
    const packedItems: PackedItem[] = []

    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      const unitAmount = Math.round(Number(tier.price) * 100)
      const seatMultiplier = tier.is_group ? (tier.seats_per_unit || 1) : 1

      totalServiceFeeCents += serviceFeeAmount(unitAmount) * it.quantity
      totalApplicationFeeCents += applicationFeeAmount(unitAmount, seatMultiplier) * it.quantity
      packedItems.push({ t: it.tierId, q: it.quantity, u: unitAmount, g: !!tier.is_group, s: tier.is_group ? tier.seats_per_unit : 1 })

      // Free tiers can ride along with paid add-ons; they just don't get a line item.
      if (unitAmount > 0) {
        lineItems.push({
          price_data: {
            currency: 'usd',
            unit_amount: unitAmount,
            product_data: {
              name: `${tier.name}${tier.is_group ? ' (table)' : ''} — ${eventRow.title}`,
              description: tier.description || undefined,
              metadata: { tier_id: tier.id, event_id: eventId },
            },
          },
          quantity: it.quantity,
        })
      }
    }

    const addonLineTotals = new Map<string, { name: string; choice: string | null; unitAmount: number; quantity: number }>()
    function addAddonQty(addonId: string, choice: string | null, qty: number) {
      if (qty <= 0) return
      const addon = addonById.get(addonId)!
      const unitAmount = Math.round(Number(addon.price) * 100)
      const key = addonId + '::' + (choice || '')
      const existing = addonLineTotals.get(key)
      if (existing) existing.quantity += qty
      else addonLineTotals.set(key, { name: addon.name, choice, unitAmount, quantity: qty })
    }

    const packedAttendees: PackedAttendee[] = attendees.map((a) => {
      for (const ad of a.addons || []) addAddonQty(ad.addon_id, ad.choice || null, 1)
      return {
        t: a.tierId,
        n: a.name.trim(),
        e: a.email?.trim().toLowerCase() || null,
        r: (a.responses || []).filter((r) => r.field_id && r.value).map((r) => ({ i: r.field_id, v: r.value })),
        a: (a.addons || []).map((ad) => ({ i: ad.addon_id, c: ad.choice || null })),
      }
    })

    const packedTables: PackedTable[] = tables.map((tb) => ({
      t: tb.tierId,
      r: (tb.responses || []).filter((r) => r.field_id && r.value).map((r) => ({ i: r.field_id, v: r.value })),
      a: (tb.addons || [])
        .filter((ad) => ad.quantity > 0)
        .map((ad) => {
          addAddonQty(ad.addon_id, ad.choice || null, ad.quantity)
          return { i: ad.addon_id, c: ad.choice || null, q: ad.quantity, u: Math.round(Number(addonById.get(ad.addon_id)!.price) * 100) }
        }),
    }))

    for (const { name, choice, unitAmount, quantity } of addonLineTotals.values()) {
      totalServiceFeeCents += serviceFeeAmount(unitAmount) * quantity
      totalApplicationFeeCents += applicationFeeAmount(unitAmount) * quantity
      if (unitAmount > 0) {
        lineItems.push({
          price_data: {
            currency: 'usd',
            unit_amount: unitAmount,
            product_data: { name: choice ? `${name} — ${choice}` : name },
          },
          quantity,
        })
      }
    }

    if (lineItems.length === 0) {
      return jsonError('This order has no charge — please use the free RSVP instead.', 400)
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

    // ── Guest customer & session ──
    const buyerEmail = guest.email.trim().toLowerCase()
    const buyerName = guest.name.trim()
    const buyerPhone = guest.phone || null

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0)
    const sessionMetadata: Record<string, string> = {
      event_id: eventId,
      total_quantity: String(totalQuantity),
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      buyer_phone: buyerPhone || '',
      source: 'embed',
      ...packOrderForMetadata(packedItems, packedAttendees, packedTables),
    }

    const customer = await stripe.customers.create({
      email: buyerEmail,
      name: buyerName,
      phone: buyerPhone || undefined,
      metadata: { guest_checkout: 'true', source: 'embed' },
    })

    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.seveneightfive.com'

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
