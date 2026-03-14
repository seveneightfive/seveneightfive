import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/tickets/webhook
 *
 * Handles Stripe webhook events. Verifies the signature using
 * STRIPE_WEBHOOK_SECRET, then processes:
 *
 *   - checkout.session.completed  → mint ticket(s), send confirmation
 *   - payment_intent.succeeded    → mark ticket as paid (fallback)
 *   - charge.refunded             → mark ticket as refunded
 *   - account.updated             → sync Connect account status to profile
 *
 * Must be registered in Stripe Dashboard → Webhooks pointing to:
 *   https://yourdomain.com/api/tickets/webhook
 *
 * Set STRIPE_WEBHOOK_SECRET in Vercel env vars (whsec_...).
 */

// Next.js must NOT parse the body — Stripe needs the raw bytes for signature verification
export const config = { api: { bodyParser: false } }

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

      // ── PRIMARY: checkout session completed ──────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as import('stripe').Stripe.Checkout.Session

        if (session.payment_status !== 'paid') break

        const meta = session.metadata || {}
        const tierId = meta.tier_id
        const eventId = meta.event_id
        const buyerUserId = meta.buyer_user_id
        const quantity = parseInt(meta.quantity || '1', 10)
        const paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id

        if (!tierId || !eventId || !buyerUserId) {
          console.error('[webhook] checkout.session.completed missing metadata', meta)
          break
        }

        // Get buyer email
        const { data: profile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', buyerUserId)
          .single()

        // Get the amount paid and platform fee
        const amountTotal = session.amount_total ? session.amount_total / 100 : null
        const platformFee = paymentIntentId
          ? await getPlatformFee(paymentIntentId)
          : null

        // Mint one ticket row per quantity
        const tickets = Array.from({ length: quantity }, () => ({
          ticket_tier_id: tierId,
          event_id: eventId,
          buyer_user_id: buyerUserId,
          buyer_email: profile?.email || '',
          buyer_name: profile?.full_name || null,
          stripe_payment_intent_id: paymentIntentId || null,
          stripe_checkout_session_id: session.id,
          payment_status: 'paid' as const,
          amount_paid: amountTotal ? amountTotal / quantity : null,
          platform_fee: platformFee ? platformFee / quantity : null,
          status: 'valid' as const,
        }))

        const { error: insertError } = await admin
          .from('tickets')
          .insert(tickets)

        if (insertError) {
          console.error('[webhook] failed to insert tickets:', insertError)
          // Return 500 so Stripe retries
          return NextResponse.json({ error: 'Failed to create tickets' }, { status: 500 })
        }

        console.log(`[webhook] minted ${quantity} ticket(s) for event ${eventId}`)
        break
      }

      // ── FALLBACK: payment intent succeeded (direct charge, not checkout) ──
      case 'payment_intent.succeeded': {
        const pi = event.data.object as import('stripe').Stripe.PaymentIntent
        const meta = pi.metadata || {}

        if (!meta.tier_id) break // not a 785ticket payment

        // Check if ticket already created by checkout.session.completed
        const { data: existing } = await admin
          .from('tickets')
          .select('id')
          .eq('stripe_payment_intent_id', pi.id)
          .limit(1)
          .maybeSingle()

        if (existing) break // already handled

        // Mint ticket (same logic as above, minimal metadata)
        const quantity = parseInt(meta.quantity || '1', 10)
        const { data: profile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', meta.buyer_user_id)
          .single()

        const tickets = Array.from({ length: quantity }, () => ({
          ticket_tier_id: meta.tier_id,
          event_id: meta.event_id,
          buyer_user_id: meta.buyer_user_id,
          buyer_email: profile?.email || '',
          buyer_name: profile?.full_name || null,
          stripe_payment_intent_id: pi.id,
          payment_status: 'paid' as const,
          amount_paid: pi.amount_received ? (pi.amount_received / 100) / quantity : null,
          status: 'valid' as const,
        }))

        await admin.from('tickets').insert(tickets)
        break
      }

      // ── REFUND ────────────────────────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as import('stripe').Stripe.Charge
        const piId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id

        if (!piId) break

        await admin
          .from('tickets')
          .update({ payment_status: 'refunded', status: 'refunded' })
          .eq('stripe_payment_intent_id', piId)

        break
      }

      // ── CONNECT ACCOUNT UPDATED ───────────────────────────────────────
      case 'account.updated': {
        const account = event.data.object as import('stripe').Stripe.Account
        const isEnabled = account.charges_enabled && account.payouts_enabled

        await admin
          .from('profiles')
          .update({ stripe_account_status: isEnabled ? 'enabled' : 'restricted' })
          .eq('stripe_account_id', account.id)

        break
      }

      default:
        // Ignore unhandled event types
        break
    }

    return NextResponse.json({ received: true })

  } catch (err: any) {
    console.error('[webhook] handler error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper: get application_fee_amount from a PaymentIntent's charges
async function getPlatformFee(paymentIntentId: string): Promise<number | null> {
  try {
    const charges = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 })
    const fee = charges.data[0]?.application_fee_amount
    return fee ? fee / 100 : null
  } catch {
    return null
  }
}
