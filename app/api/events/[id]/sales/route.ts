import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { syncTicketOrder } from '@/lib/ticketOrders'

/**
 * GET /api/events/[id]/sales
 *
 * The organizer's order ledger for one event: one row per paid purchase
 * with what the buyer was charged and how it breaks down (tickets,
 * add-ons, service fee, platform fee, net to the organizer), plus what
 * was in the order and which seats it produced.
 *
 * Orders that don't have a ticket_orders row yet (anything bought before
 * the ledger existed, or a webhook that failed to record one) are
 * filled in from Stripe here, a batch at a time.
 *
 * Deliberately leaves out stripe_fee — that's seveneightfive's cost,
 * covered by the buyer's service fee, not something the organizer pays.
 */

const SYNC_BATCH = 40
const round2 = (n: number) => Math.round(n * 100) / 100

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const access = await canManageEvent(admin, eventId, user.id)
    if (access === 'not_found') return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Every ticket for the event — used both to find orders that still
    // need recording and to list each order's seats.
    const { data: tickets, error: ticketsErr } = await admin
      .from('tickets')
      .select('id, ticket_tier_id, buyer_name, purchaser_name, status, stripe_payment_intent_id, created_at')
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
    if (ticketsErr) throw ticketsErr

    const allTickets = tickets || []
    const paidPiIds = [...new Set(allTickets.map((t) => t.stripe_payment_intent_id).filter(Boolean))] as string[]
    const unpaidTicketCount = allTickets.filter((t) => !t.stripe_payment_intent_id).length

    // Fill in missing orders, plus any recorded before Stripe had the
    // processing fee ready.
    const { data: existing } = await admin
      .from('ticket_orders')
      .select('stripe_payment_intent_id, stripe_fee')
      .eq('event_id', eventId)
    const recorded = new Map((existing || []).map((o) => [o.stripe_payment_intent_id, o]))
    const toSync = paidPiIds
      .filter((pi) => !recorded.has(pi) || recorded.get(pi)!.stripe_fee === null)
      .slice(0, SYNC_BATCH)
    for (let i = 0; i < toSync.length; i += 5) {
      await Promise.all(
        toSync.slice(i, i + 5).map((pi) =>
          syncTicketOrder(admin, pi).catch((err) => {
            console.error('[sales] sync failed for', pi, err?.message || err)
            return false
          })
        )
      )
    }

    const { data: orders, error: ordersErr } = await admin
      .from('ticket_orders')
      .select(`
        id, stripe_payment_intent_id, buyer_name, buyer_email, status, purchased_at,
        tickets_subtotal, addons_subtotal, service_fee, amount_total,
        platform_fee, net_to_organizer, amount_refunded
      `)
      .eq('event_id', eventId)
      .order('purchased_at', { ascending: false })
    if (ordersErr) throw ordersErr

    const orderPiIds = new Set((orders || []).map((o) => o.stripe_payment_intent_id))
    const stillMissing = paidPiIds.filter((pi) => !orderPiIds.has(pi)).length

    // Lookups for the per-order breakdown
    const { data: tiers } = await admin
      .from('ticket_tiers')
      .select('id, name, is_group, seats_per_unit')
      .eq('event_id', eventId)
    const tierById = new Map((tiers || []).map((t) => [t.id, t]))

    const paidTicketIds = allTickets.filter((t) => t.stripe_payment_intent_id).map((t) => t.id)
    const addonRows: { ticket_id: string; choice: string | null; price_paid: number; event_addons: any }[] = []
    for (let i = 0; i < paidTicketIds.length; i += 200) {
      const { data } = await admin
        .from('ticket_addons')
        .select('ticket_id, choice, price_paid, event_addons(name)')
        .in('ticket_id', paidTicketIds.slice(i, i + 200))
      addonRows.push(...((data as any[]) || []))
    }
    const addonsByTicket = new Map<string, typeof addonRows>()
    for (const a of addonRows) {
      const list = addonsByTicket.get(a.ticket_id) || []
      list.push(a)
      addonsByTicket.set(a.ticket_id, list)
    }

    const ticketsByPi = new Map<string, typeof allTickets>()
    for (const t of allTickets) {
      if (!t.stripe_payment_intent_id) continue
      const list = ticketsByPi.get(t.stripe_payment_intent_id) || []
      list.push(t)
      ticketsByPi.set(t.stripe_payment_intent_id, list)
    }

    const shaped = (orders || []).map((o) => {
      const seats = ticketsByPi.get(o.stripe_payment_intent_id) || []

      // What was bought: tables counted as tables, individual tickets as tickets
      const seatsByTier = new Map<string, number>()
      for (const s of seats) seatsByTier.set(s.ticket_tier_id, (seatsByTier.get(s.ticket_tier_id) || 0) + 1)
      const items = [...seatsByTier.entries()].map(([tierId, seatCount]) => {
        const tier = tierById.get(tierId)
        const perUnit = tier?.is_group ? tier.seats_per_unit || 1 : 1
        return {
          name: tier?.name || 'Ticket',
          quantity: Math.max(1, Math.round(seatCount / perUnit)),
          isTable: !!tier?.is_group,
          seats: seatCount,
        }
      })

      // Add-ons grouped by name + choice (e.g. Meal — Crab Cake × 3)
      const addonGroups = new Map<string, { name: string; choice: string | null; quantity: number; amount: number }>()
      for (const s of seats) {
        for (const a of addonsByTicket.get(s.id) || []) {
          const name = (Array.isArray(a.event_addons) ? a.event_addons[0]?.name : a.event_addons?.name) || 'Add-on'
          const key = `${name}::${a.choice || ''}`
          const g = addonGroups.get(key) || { name, choice: a.choice, quantity: 0, amount: 0 }
          g.quantity += 1
          g.amount = round2(g.amount + Number(a.price_paid || 0))
          addonGroups.set(key, g)
        }
      }

      return {
        id: o.id,
        paymentIntentId: o.stripe_payment_intent_id,
        purchasedAt: o.purchased_at,
        buyerName: o.buyer_name,
        buyerEmail: o.buyer_email,
        status: o.status,
        ticketsSubtotal: Number(o.tickets_subtotal),
        addonsSubtotal: Number(o.addons_subtotal),
        serviceFee: Number(o.service_fee),
        amountTotal: Number(o.amount_total),
        platformFee: Number(o.platform_fee),
        net: Number(o.net_to_organizer),
        amountRefunded: Number(o.amount_refunded),
        items,
        addons: [...addonGroups.values()],
        seats: seats.map((s) => ({
          id: s.id,
          name: s.buyer_name,
          tier: tierById.get(s.ticket_tier_id)?.name || 'Ticket',
          status: s.status,
        })),
      }
    })

    // Totals leave out fully refunded orders
    const counted = shaped.filter((o) => o.status !== 'refunded')
    const sum = (f: (o: (typeof shaped)[number]) => number) => round2(counted.reduce((s, o) => s + f(o), 0))

    return NextResponse.json({
      orders: shaped,
      totals: {
        orders: counted.length,
        ticketsSubtotal: sum((o) => o.ticketsSubtotal),
        addonsSubtotal: sum((o) => o.addonsSubtotal),
        serviceFee: sum((o) => o.serviceFee),
        amountTotal: sum((o) => o.amountTotal),
        platformFee: sum((o) => o.platformFee),
        net: sum((o) => o.net),
      },
      stillMissing,
      unpaidTicketCount,
    })
  } catch (err: any) {
    console.error('[sales] error:', err)
    return NextResponse.json({ error: 'Failed to load sales' }, { status: 500 })
  }
}

// Same access rule as /api/events/[id]/scanner-link: the event's owner,
// its venue's owner, or an artist linked to the event.
async function canManageEvent(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  userId: string
): Promise<boolean | 'not_found'> {
  const { data: eventRow } = await admin
    .from('events')
    .select('id, auth_user_id, venues(auth_user_id)')
    .eq('id', eventId)
    .maybeSingle()
  if (!eventRow) return 'not_found'
  if (eventRow.auth_user_id === userId) return true

  const venue = Array.isArray(eventRow.venues) ? eventRow.venues[0] : (eventRow.venues as any)
  if (venue?.auth_user_id === userId) return true

  const { data: myArtists } = await admin.from('artists').select('id').eq('auth_user_id', userId)
  const myArtistIds = (myArtists || []).map((a: any) => a.id)
  if (myArtistIds.length) {
    const { data: link } = await admin
      .from('event_artists')
      .select('artist_id')
      .eq('event_id', eventId)
      .in('artist_id', myArtistIds)
      .limit(1)
      .maybeSingle()
    if (link) return true
  }
  return false
}
