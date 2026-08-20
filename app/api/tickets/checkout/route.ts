import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { stripe, serviceFeeAmount, applicationFeeAmount } from '@/lib/stripe'

/**
 * POST /api/tickets/checkout
 *
 * Cart checkout supporting:
 *   - Multiple tiers in one order (existing)
 *   - Full per-attendee name/email/question data on INDIVIDUAL tiers (existing)
 *   - GROUP/TABLE tiers (e.g. "VIP Sponsorship" = 1 table = 8 seats):
 *     one purchase mints seats_per_unit ticket rows, but the buyer
 *     only enters ONE set of info (the purchaser) per table, not one
 *     per seat. items[].quantity for a group tier means TABLES, not
 *     seats.
 *   - Priced add-ons (e.g. "Meal — $20"), scoped to a specific tier:
 *       - individual tiers: selected per attendee (their own ticket)
 *       - group tiers: selected as an aggregate quantity + a choice
 *         breakdown for the whole table, distributed across that
 *         table's minted seats server-side (no per-seat identity
 *         needed, matching how group tiers already work)
 *
 * Body: {
 *   eventId: string,
 *   items: { tierId: string, quantity: number }[],
 *   guest?: { name: string, email: string, phone: string | null },
 *   attendees: {                          // one per INDIVIDUAL-tier seat
 *     tierId: string, name: string, email?: string | null,
 *     responses: { field_id: string, value: string }[],
 *     addons: { addon_id: string, choice?: string | null }[]
 *   }[],
 *   tables: {                             // one per GROUP-tier table
 *     tierId: string,
 *     responses: { field_id: string, value: string }[],
 *     addons: { addon_id: string, choice: string | null, quantity: number }[]
 *   }[]
 * }
 */

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
      return NextResponse.json({ error: 'eventId and at least one cart item are required' }, { status: 400 })
    }
    if (!user && !guest) {
      return NextResponse.json({ error: 'Buyer information is required for guest checkout' }, { status: 400 })
    }
    if (!user && guest && (!guest.name?.trim() || !guest.email?.trim())) {
      return NextResponse.json({ error: 'Guest name and email are required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const origin = request.nextUrl.origin
    const tierIds = items.map((it) => it.tierId)

    const { data: tierRows, error: tiersError } = await admin
      .from('ticket_tiers')
      .select(`
        id, name, description, price, quantity, quantity_sold, is_active,
        sale_starts_at, sale_ends_at, is_group, seats_per_unit, event_id,

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
      const expectedCount = tier.is_group
        ? tables.filter((tb) => tb.tierId === it.tierId).length
        : attendees.filter((a) => a.tierId === it.tierId).length
      if (expectedCount !== it.quantity) {
        return NextResponse.json(
          { error: `${tier.is_group ? 'Table' : 'Attendee'} details don't match the cart quantities for "${tier.name}".` },
          { status: 400 }
        )
      }
    }
    for (const a of attendees) {
      if (!a.name?.trim()) return NextResponse.json({ error: 'Every ticket needs an attendee name' }, { status: 400 })
      if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) {
        return NextResponse.json({ error: `"${a.email}" doesn't look like a valid email.` }, { status: 400 })
      }
    }

    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      if (!tier.is_active) return NextResponse.json({ error: `"${tier.name}" is not currently available` }, { status: 400 })
      if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) {
        return NextResponse.json({ error: `"${tier.name}" sales have not started yet` }, { status: 400 })
      }
      if (tier.sale_ends_at && new Date(tier.sale_ends_at) < now) {
        return NextResponse.json({ error: `"${tier.name}" sales have ended` }, { status: 400 })
      }
      if (tier.quantity !== null) {
        const seatsPerUnit = tier.is_group ? tier.seats_per_unit : 1
        const unitsSold = Math.floor(tier.quantity_sold / seatsPerUnit)
        const unitsRemaining = tier.quantity - unitsSold
        if (unitsRemaining < it.quantity) {
          return NextResponse.json(
            { error: `Only ${unitsRemaining} ${tier.is_group ? 'table(s)' : 'ticket(s)'} remaining for "${tier.name}"` },
            { status: 400 }
          )
        }
      }
    }

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
    }

    for (const a of attendees) {
      for (const ad of a.addons || []) {
        const addon = addonById.get(ad.addon_id)!
        if (addon.ticket_tier_id !== a.tierId) {
          return NextResponse.json({ error: `"${addon.name}" isn't available for this ticket type.` }, { status: 400 })
        }
        if (addon.has_choice) {
          const opts: string[] = addon.choice_options || []
          if (!ad.choice || !opts.includes(ad.choice)) {
            return NextResponse.json({ error: `Please choose an option for "${addon.name}".` }, { status: 400 })
          }
        }
      }
    }

    for (const tb of tables) {
      const tier = tierById.get(tb.tierId)!
      for (const ad of tb.addons || []) {
        const addon = addonById.get(ad.addon_id)!
        if (addon.ticket_tier_id !== tb.tierId) {
          return NextResponse.json({ error: `"${addon.name}" isn't available for this ticket type.` }, { status: 400 })
        }
        if (ad.quantity < 0 || ad.quantity > tier.seats_per_unit) {
          return NextResponse.json({ error: `"${addon.name}" quantity can't exceed the table's ${tier.seats_per_unit} seats.` }, { status: 400 })
        }
        if (addon.has_choice && ad.quantity > 0) {
          const opts: string[] = addon.choice_options || []
          if (!ad.choice || !opts.includes(ad.choice)) {
            return NextResponse.json({ error: `Please choose an option for "${addon.name}".` }, { status: 400 })
          }
        }
      }
      const sumsByAddon: Record<string, number> = {}
      for (const ad of tb.addons || []) sumsByAddon[ad.addon_id] = (sumsByAddon[ad.addon_id] || 0) + ad.quantity
      for (const [addonId, sum] of Object.entries(sumsByAddon)) {
        if (sum > tier.seats_per_unit) {
          return NextResponse.json({ error: `"${addonById.get(addonId)?.name}" total can't exceed the table's ${tier.seats_per_unit} seats.` }, { status: 400 })
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

    const stripeAccountId = creatorProfile?.stripe_account_id
    const stripeStatus = creatorProfile?.stripe_account_status
    if (!stripeAccountId) return NextResponse.json({ error: 'Event creator has not connected Stripe' }, { status: 400 })
    if (stripeStatus !== 'enabled') return NextResponse.json({ error: 'Event creator has not completed payment setup' }, { status: 400 })

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
          email: buyerEmail, name: buyerName || undefined, phone: buyerPhone || undefined,
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
        email: buyerEmail, name: buyerName || undefined, phone: buyerPhone || undefined,
        metadata: { guest_checkout: 'true' },
      })
      customerId = customer.id
    }

    const lineItems: import('stripe').Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let totalServiceFeeCents = 0
    let totalApplicationFeeCents = 0
    const packedItems: PackedItem[] = []

    for (const it of items) {
      const tier = tierById.get(it.tierId)!
      const unitAmount = Math.round(Number(tier.price) * 100)
      const serviceFeePerUnit = serviceFeeAmount(unitAmount)
      const appFeePerUnit = applicationFeeAmount(unitAmount)

      totalServiceFeeCents += serviceFeePerUnit * it.quantity
      totalApplicationFeeCents += appFeePerUnit * it.quantity
      packedItems.push({ t: it.tierId, q: it.quantity, u: unitAmount, g: !!tier.is_group, s: tier.is_group ? tier.seats_per_unit : 1 })

      if (unitAmount > 0) {
        lineItems.push({
          price_data: {
            currency: 'usd',
            unit_amount: unitAmount,
            product_data: {
              name: `${tier.name}${tier.is_group ? ' (table)' : ''} — ${event.title}`,
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
        r: a.responses.filter((r) => r.field_id && r.value).map((r) => ({ i: r.field_id, v: r.value })),
        a: (a.addons || []).map((ad) => ({ i: ad.addon_id, c: ad.choice || null })),
      }
    })

    const packedTables: PackedTable[] = tables.map((tb) => {
      const packedAddons: PackedTableAddon[] = (tb.addons || [])
        .filter((ad) => ad.quantity > 0)
        .map((ad) => {
          addAddonQty(ad.addon_id, ad.choice || null, ad.quantity)
          const addon = addonById.get(ad.addon_id)!
          return { i: ad.addon_id, c: ad.choice || null, q: ad.quantity, u: Math.round(Number(addon.price) * 100) }
        })
      return {
        t: tb.tierId,
        r: tb.responses.filter((r) => r.field_id && r.value).map((r) => ({ i: r.field_id, v: r.value })),
        a: packedAddons,
      }
    })

    for (const { name, choice, unitAmount, quantity } of addonLineTotals.values()) {
      const serviceFeePerUnit = serviceFeeAmount(unitAmount)
      const appFeePerUnit = applicationFeeAmount(unitAmount)
      totalServiceFeeCents += serviceFeePerUnit * quantity
      totalApplicationFeeCents += appFeePerUnit * quantity

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

    const hasAnyCharge = lineItems.length > 0
    if (!hasAnyCharge) {
      return NextResponse.json({ error: 'This order has no charge — use the free RSVP flow instead.' }, { status: 400 })
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

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0)

    const sessionMetadata: Record<string, string> = {
      event_id: eventId,
      total_quantity: String(totalQuantity),
      buyer_email: buyerEmail,
      buyer_name: buyerName || '',
      buyer_phone: buyerPhone || '',
      ...packOrderForMetadata(packedItems, packedAttendees, packedTables),
    }
    if (buyerUserId) sessionMetadata.buyer_user_id = buyerUserId

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer: customerId,
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
