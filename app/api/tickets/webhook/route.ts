import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { stripe } from '@/lib/stripe'
import { syncStripeAccountToProfile } from '@/lib/stripeSync'
import { sendTicketEmail } from '@/app/lib/email'

/**
 * POST /api/tickets/webhook
 *
 * Stripe webhook handler. Verifies signature, then dispatches on event.type:
 *   - checkout.session.completed → mint ticket(s) + send email / activate ads
 *   - payment_intent.succeeded   → fallback ticket mint + email
 *   - charge.refunded            → mark refunded
 *   - account.updated            → sync Connect status to profile
 *
 * Stripe Dashboard → Webhooks → Endpoint URL:
 *   https://yourdomain.com/api/tickets/webhook
 *
 * MUST be subscribed to:
 *   checkout.session.completed
 *   payment_intent.succeeded
 *   charge.refunded
 *   account.updated
 *
 * Env: STRIPE_WEBHOOK_SECRET (whsec_...)
 *      RESEND_API_KEY (re_...)
 *      NEXT_PUBLIC_SITE_URL (https://...)
 *
 * Buyer info resolution order (per ticket):
 *   1. metadata.buyer_email + metadata.buyer_name + metadata.buyer_phone
 *      (set by the checkout API for BOTH logged-in and guest buyers)
 *   2. Fallback: lookup profile by buyer_user_id (legacy code path)
 *   3. Last resort: pull from Stripe's session.customer_details
 *
 * Email sending: errors during email send are caught and logged but
 * do NOT fail the webhook. If we returned 500, Stripe would retry and
 * we'd double-mint tickets. The user can re-trigger the email from
 * their ticket page (or we re-send manually) if delivery fails.
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: import('stripe').Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err: any) {
    console.error('[webhook] signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook error: ${err.message}` },
      { status: 400 }
    )
  }

  const admin = createClient()

  try {
    switch (event.type) {
      // ── checkout.session.completed ───────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as import('stripe').Stripe.Checkout.Session

        if (session.payment_status !== 'paid') break

        const meta = session.metadata || {}

        // Advertisement (unchanged)
        if (meta.type === 'advertisement' && meta.ad_id) {
          const { error: adError } = await admin
            .from('advertisements')
            .update({ payment_status: 'paid', status: 'active' })
            .eq('id', meta.ad_id)

          if (adError) {
            console.error('[webhook] failed to activate advertisement:', adError)
            return NextResponse.json(
              { error: 'Failed to activate advertisement' },
              { status: 500 }
            )
          }

          console.log(`[webhook] advertisement ${meta.ad_id} activated`)
          break
        }

        // Ticket purchase
        const tierId = meta.tier_id
        const eventId = meta.event_id
        const buyerUserId = meta.buyer_user_id || null
        const quantity = parseInt(meta.quantity || '1', 10)
        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id

        if (!tierId || !eventId) {
          console.error(
            '[webhook] checkout.session.completed missing tier_id/event_id',
            meta
          )
          break
        }

        const buyerInfo = await resolveBuyerInfo({
          metadata: meta,
          buyerUserId,
          session,
          admin,
        })

        if (!buyerInfo.email) {
          console.error('[webhook] could not resolve buyer email', meta)
          return NextResponse.json(
            { error: 'Buyer email could not be resolved' },
            { status: 500 }
          )
        }

        const amountTotal = session.amount_total ? session.amount_total / 100 : null
        const platformFee = paymentIntentId
          ? await getPlatformFee(paymentIntentId)
          : null

        const ticketRows = Array.from({ length: quantity }, () => ({
          ticket_tier_id: tierId,
          event_id: eventId,
          buyer_user_id: buyerUserId,
          buyer_email: buyerInfo.email,
          buyer_name: buyerInfo.name,
          buyer_phone: buyerInfo.phone,
          stripe_payment_intent_id: paymentIntentId || null,
          stripe_checkout_session_id: session.id,
          payment_status: 'paid' as const,
          amount_paid: amountTotal ? amountTotal / quantity : null,
          platform_fee: platformFee ? platformFee / quantity : null,
          status: 'valid' as const,
        }))

        // Insert tickets and get back qr_tokens for the email
        const { data: inserted, error: insertError } = await admin
          .from('tickets')
          .insert(ticketRows)
          .select('id, qr_token')

        if (insertError || !inserted) {
          console.error('[webhook] failed to insert tickets:', insertError)
          return NextResponse.json(
            { error: 'Failed to create tickets' },
            { status: 500 }
          )
        }

        console.log(
          `[webhook] minted ${inserted.length} ticket(s) for event ${eventId} (guest=${!buyerUserId})`
        )

        // Fire-and-log email send. Failures must not bubble up — they
        // would cause Stripe to retry and double-mint tickets.
        try {
          await sendTicketConfirmation({
            admin,
            buyerEmail: buyerInfo.email,
            buyerName: buyerInfo.name,
            eventId,
            tierId,
            ticketRows: inserted,
            amountPaid: amountTotal,
            orderRef: session.id,
          })
        } catch (emailErr) {
          console.error('[webhook] ticket email send failed (non-fatal):', emailErr)
        }
        break
      }

      // ── payment_intent.succeeded (fallback) ──────────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object as import('stripe').Stripe.PaymentIntent
        const meta = pi.metadata || {}

        if (!meta.tier_id) break

        const { data: existing } = await admin
          .from('tickets')
          .select('id')
          .eq('stripe_payment_intent_id', pi.id)
          .limit(1)
          .maybeSingle()

        if (existing) break // checkout.session.completed already minted

        const quantity = parseInt(meta.quantity || '1', 10)
        const buyerUserId = meta.buyer_user_id || null

        const buyerInfo = await resolveBuyerInfo({
          metadata: meta,
          buyerUserId,
          session: null,
          admin,
        })

        if (!buyerInfo.email) {
          console.error(
            '[webhook] payment_intent.succeeded could not resolve buyer email',
            meta
          )
          break
        }

        const fallbackRows = Array.from({ length: quantity }, () => ({
          ticket_tier_id: meta.tier_id,
          event_id: meta.event_id,
          buyer_user_id: buyerUserId,
          buyer_email: buyerInfo.email,
          buyer_name: buyerInfo.name,
          buyer_phone: buyerInfo.phone,
          stripe_payment_intent_id: pi.id,
          payment_status: 'paid' as const,
          amount_paid: pi.amount_received
            ? pi.amount_received / 100 / quantity
            : null,
          status: 'valid' as const,
        }))

        const { data: insertedFallback, error: fallbackError } = await admin
          .from('tickets')
          .insert(fallbackRows)
          .select('id, qr_token')

        if (fallbackError || !insertedFallback) {
          console.error(
            '[webhook] payment_intent.succeeded ticket insert failed:',
            fallbackError
          )
          break
        }

        /**
 * Look up event + venue + tier names + organizer info and dispatch the 
 * confirmation email via Resend.
 */
async function sendTicketConfirmation(args: {
  admin: ReturnType<typeof createClient>
  buyerEmail: string
  buyerName: string | null
  eventId: string
  tierId: string
  ticketRows: { id: string; qr_token: string }[]
  amountPaid: number | null
  orderRef: string
}) {
  const { admin, buyerEmail, buyerName, eventId, tierId, ticketRows, amountPaid, orderRef } =
    args

  // Pull event + venue + organizer
  const { data: ev, error: evErr } = await admin
    .from('events')
    .select(`
      title,
      slug,
      image_url,
      event_date,
      event_start_time,
      event_end_time,
      description,
      auth_user_id,
      venues (
        name,
        address,
        city,
        state
      ),
      profiles!events_auth_user_id_profile_fkey (
        full_name,
        email
      )
    `)
    .eq('id', eventId)
    .single()

  if (evErr || !ev) {
    console.error('[webhook] could not load event for email:', evErr)
    return
  }

  const venue = Array.isArray(ev.venues) ? ev.venues[0] : ev.venues
  const creatorProfile = Array.isArray(ev.profiles) ? ev.profiles[0] : ev.profiles

  // Pull tier name
  const { data: tier } = await admin
    .from('ticket_tiers')
    .select('name')
    .eq('id', tierId)
    .single()

  const tierName = tier?.name || 'Ticket'

  await sendTicketEmail({
    to: buyerEmail,
    buyerName,
    event: {
      title: ev.title,
      slug: ev.slug,
      date: ev.event_date,
      startTime: ev.event_start_time,
      endTime: ev.event_end_time,
      image_url: ev.image_url,
      venueName: venue?.name || null,
      venueAddress: venue?.address || null,
      // Don't include city/state here — it's already in the address
      venueCityState: null,
    },
    tickets: ticketRows.map((t) => ({
      qr_token: t.qr_token,
      ticket_tier_name: tierName,
    })),
    amountPaid,
    orderRef,
    // Organizer contact info
    organizerName: creatorProfile?.full_name || null,
    organizerEmail: creatorProfile?.email || null,
  })
}


      // ── charge.refunded ──────────────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as import('stripe').Stripe.Charge
        const piId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id

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

/**
 * Look up event + venue + tier names and dispatch the confirmation
 * email via Resend.
 */
async function sendTicketConfirmation(args: {
  admin: ReturnType<typeof createClient>
  buyerEmail: string
  buyerName: string | null
  eventId: string
  tierId: string
  ticketRows: { id: string; qr_token: string }[]
  amountPaid: number | null
  orderRef: string
}) {
  const { admin, buyerEmail, buyerName, eventId, tierId, ticketRows, amountPaid, orderRef } =
    args

  // Pull event + venue
  const { data: ev, error: evErr } = await admin
    .from('events')
    .select(`
      title,
      slug,
      image_url,
      event_date,
      event_start_time,
      event_end_time,
      description,
      venues (
        name,
        address,
        city,
        state
      )
    `)
    .eq('id', eventId)
    .single()

  if (evErr || !ev) {
    console.error('[webhook] could not load event for email:', evErr)
    return
  }

  const venue = Array.isArray(ev.venues) ? ev.venues[0] : ev.venues

  // Pull tier name (one query, used for every ticket in this batch)
  const { data: tier } = await admin
    .from('ticket_tiers')
    .select('name')
    .eq('id', tierId)
    .single()

  const tierName = tier?.name || 'Ticket'

  await sendTicketEmail({
    to: buyerEmail,
    buyerName,
    event: {
      title: ev.title,
      slug: ev.slug,
      date: ev.event_date,
      startTime: ev.event_start_time,
      endTime: ev.event_end_time,
      image_url: ev.image_url,
      venueName: venue?.name || null,
      venueAddress: venue?.address || null,
      venueCityState: [venue?.city, venue?.state].filter(Boolean).join(', ') || null,
    },
    tickets: ticketRows.map((t) => ({
      qr_token: t.qr_token,
      ticket_tier_name: tierName,
    })),
    amountPaid,
    orderRef,
  })
}

/**
 * Resolve buyer name / email / phone from whatever sources are available.
 * Metadata is the source of truth (we wrote it deliberately at checkout).
 * For legacy logged-in tickets that have a buyer_user_id but missing
 * metadata fields, fall back to the profile. As a last resort, use
 * Stripe's own customer_details on the session.
 */
async function resolveBuyerInfo(args: {
  metadata: Record<string, string>
  buyerUserId: string | null
  session: import('stripe').Stripe.Checkout.Session | null
  admin: ReturnType<typeof createClient>
}): Promise<{ email: string | null; name: string | null; phone: string | null }> {
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

  return { email, name, phone }
}

async function getPlatformFee(paymentIntentId: string): Promise<number | null> {
  try {
    const charges = await stripe.charges.list({
      payment_intent: paymentIntentId,
      limit: 1,
    })
    const fee = charges.data[0]?.application_fee_amount
    return fee ? fee / 100 : null
  } catch {
    return null
  }
}
