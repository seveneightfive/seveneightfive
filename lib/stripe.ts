import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY env var')
}

/**
 * Server-side Stripe client — never import in client components.
 * Use STRIPE_SECRET_KEY (no NEXT_PUBLIC_ prefix).
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion,
  typescript: true,
})

// ─── Fee model ──────────────────────────────────────────────────────────────
//
// Model: "Buyer absorbs Stripe fees, organizer gets face value minus a flat
// platform fee, platform retains ~$0.70/ticket".
//
// All amounts in CENTS.
//
// Per ticket:
//   stripe_fee_est = ceil(price * 0.029) + 30
//   service_fee    = roundUpToDime(stripe_fee_est)         (buyer-side)
//   buyer_total    = price + service_fee
//   app_fee        = service_fee + 70                       (pulled from
//                                                            organizer's
//                                                            transfer)
//   transfer_to_org = buyer_total - app_fee = price - 70
//
// Stripe deducts its real processing fee from the platform side, so the
// platform's net is roughly: app_fee - actual_stripe_fee ≈ $0.65–$0.74
// depending on ticket price (close enough to the $0.70 target).

/** Stripe processing fee percentage: 2.9% */
export const STRIPE_FEE_PERCENT = 0.029

/** Stripe fixed per-transaction fee: $0.30 = 30¢ */
export const STRIPE_FIXED_FEE_CENTS = 30

/** Platform margin per ticket: $0.70 = 70¢ */
export const PLATFORM_FEE_CENTS = 70

/**
 * Estimate the Stripe processing fee on a ticket's face value.
 * This is the buyer-facing approximation; the real Stripe fee at
 * capture is computed on the buyer's grand total, but the difference
 * is sub-penny at our prices and absorbed by dime-rounding below.
 */
export function stripeFeeEstimate(priceInCents: number): number {
  return Math.ceil(priceInCents * STRIPE_FEE_PERCENT) + STRIPE_FIXED_FEE_CENTS
}

/** Round cents UP to the next 10. */
function roundUpToDime(cents: number): number {
  return Math.ceil(cents / 10) * 10
}

/**
 * Buyer-facing service fee, per ticket, in cents.
 * Dime-rounded Stripe fee estimate. Buyer pays price + this.
 *
 * Examples:
 *   $5  → ceil(5·0.029)+30 = 45 → dime-up = 50  ($0.50)
 *   $10 → ceil(10·0.029)+30 = 59 → dime-up = 60 ($0.60)
 *   $25 → ceil(25·0.029)+30 = 103 → dime-up = 110 ($1.10)
 *   $50 → ceil(50·0.029)+30 = 175 → dime-up = 180 ($1.80)
 *   $100 → ceil(100·0.029)+30 = 320 → dime-up = 320 ($3.20)
 */
export function serviceFeeAmount(priceInCents: number): number {
  if (priceInCents <= 0) return 0
  return roundUpToDime(stripeFeeEstimate(priceInCents))
}

/**
 * application_fee_amount per ticket, in cents.
 *
 * Equals service_fee + PLATFORM_FEE_CENTS. That is, the platform pulls
 * back BOTH the buyer-side service fee AND the $0.70 platform margin
 * from the organizer's transfer. Stripe then takes its real fee from
 * the platform side, leaving the platform with ~$0.70 net.
 *
 * Math check on $10 ticket:
 *   buyer pays $10.60 → Stripe takes $0.61 from platform side
 *   $10.60 transferred to organizer
 *   $1.30 pulled back as app fee → organizer nets $9.30
 *   platform: $1.30 - $0.61 = $0.69 net ≈ $0.70 ✓
 */
export function applicationFeeAmount(priceInCents: number): number {
  if (priceInCents <= 0) return 0
  return serviceFeeAmount(priceInCents) + PLATFORM_FEE_CENTS
}

/** Buyer's grand total for one ticket, in cents. */
export function buyerTotalAmount(priceInCents: number): number {
  return priceInCents + serviceFeeAmount(priceInCents)
}
