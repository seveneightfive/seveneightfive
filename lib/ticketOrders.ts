import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import type { createClient } from '@/lib/supabaseServer'

type Admin = ReturnType<typeof createClient>

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Writes (or refreshes) the ticket_orders row for one Stripe payment
 * intent. Safe to call any number of times — it upserts on
 * stripe_payment_intent_id.
 *
 * The money figures come from Stripe (what the card was actually
 * charged, the application fee, the processing fee); the ticket and
 * add-on subtotals come from the tickets/ticket_addons rows already
 * minted for this payment. The service fee is whatever is left over:
 * amount_total - tickets - add-ons.
 *
 * Called from the webhook right after tickets are minted, and from
 * /api/events/[id]/sales to fill in any order that doesn't have a row
 * yet (orders from before this table existed, or a webhook hiccup).
 */
export async function syncTicketOrder(admin: Admin, paymentIntentId: string): Promise<boolean> {
  const { data: tickets } = await admin
    .from('tickets')
    .select('id, event_id, amount_paid, status, buyer_user_id, buyer_name, purchaser_name, buyer_email, stripe_checkout_session_id, created_at')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .order('created_at', { ascending: true })

  // Duplicate mints that were cleaned up are 'cancelled' — they were
  // never paid for separately, so they don't count toward the order.
  const live = (tickets || []).filter((t) => t.status !== 'cancelled')
  if (live.length === 0) return false

  const { data: addons } = await admin
    .from('ticket_addons')
    .select('price_paid')
    .in('ticket_id', live.map((t) => t.id))

  const ticketsSubtotal = round2(live.reduce((s, t) => s + Number(t.amount_paid || 0), 0))
  const addonsSubtotal = round2((addons || []).reduce((s, a) => s + Number(a.price_paid || 0), 0))

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge.balance_transaction'],
  })
  const charge = (typeof pi.latest_charge === 'object' ? pi.latest_charge : null) as Stripe.Charge | null
  const bt = (charge && typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null) as Stripe.BalanceTransaction | null

  const amountTotal = round2((pi.amount_received || pi.amount || 0) / 100)
  const applicationFee = round2((charge?.application_fee_amount ?? pi.application_fee_amount ?? 0) / 100)
  const amountRefunded = round2((charge?.amount_refunded || 0) / 100)
  const status =
    amountRefunded <= 0 ? 'paid' : amountRefunded >= amountTotal ? 'refunded' : 'partially_refunded'

  const meta = pi.metadata || {}
  const first = live[0]
  // When a seller renames a seat, buyer_name becomes the guest and the
  // original buyer moves to purchaser_name — so prefer purchaser_name.
  const buyerName =
    meta.buyer_name || live.find((t) => t.purchaser_name)?.purchaser_name || first.buyer_name || null

  const { error } = await admin.from('ticket_orders').upsert(
    {
      event_id: first.event_id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_checkout_session_id: live.find((t) => t.stripe_checkout_session_id)?.stripe_checkout_session_id || null,
      stripe_charge_id: charge?.id || null,
      buyer_user_id: first.buyer_user_id,
      buyer_name: buyerName,
      buyer_email: meta.buyer_email || first.buyer_email,
      tickets_subtotal: ticketsSubtotal,
      addons_subtotal: addonsSubtotal,
      service_fee: round2(Math.max(0, amountTotal - ticketsSubtotal - addonsSubtotal)),
      amount_total: amountTotal,
      application_fee: applicationFee,
      stripe_fee: bt ? round2(bt.fee / 100) : null,
      amount_refunded: amountRefunded,
      status,
      purchased_at: new Date(pi.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_payment_intent_id' }
  )
  if (error) {
    console.error('[ticketOrders] upsert failed for', paymentIntentId, error)
    return false
  }
  return true
}
