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
// platform fee per seat, platform retains ~$0.70/seat".
//
// All amounts in CENTS.
//
// Per ticket/seat:
//   service_fee    = roundUpToDime(stripe_fee_est)   (buyer-side, computed
//                                                      INCLUSIVE of itself —
//                                                      see stripeFeeEstimate)
//   buyer_total    = price + service_fee
//   app_fee        = service_fee + (70 * seatMultiplier)
//   transfer_to_org = buyer_total - app_fee

/** Stripe processing fee percentage: 2.9% */
export const STRIPE_FEE_PERCENT = 0.029

/** Stripe fixed per-transaction fee: $0.30 = 30¢ */
export const STRIPE_FIXED_FEE_CENTS = 30

/** Platform margin per seat: $0.70 = 70¢ */
export const PLATFORM_FEE_CENTS = 70

/**
 * Estimate the Stripe processing fee INCLUSIVE of itself — i.e. the fee
 * on the buyer's grand total (price + fee), not on price alone. Stripe
 * charges 2.9% + $0.30 on whatever the customer actually pays, so the
 * fee has to be solved for algebraically:
 *
 *   fee = STRIPE_FEE_PERCENT * (price + fee) + STRIPE_FIXED_FEE_CENTS
 *   fee = (STRIPE_FEE_PERCENT * price + STRIPE_FIXED_FEE_CENTS) / (1 - STRIPE_FEE_PERCENT)
 *
 * Computing this off `price` alone (the old approach) undercounts the
 * fee more as price grows, since the buyer's real total (and Stripe's
 * real cut) is always bigger than price alone. At $600 this was a ~51¢
 * shortfall — most of the intended $0.70 margin.
 */
export function stripeFeeEstimate(priceInCents: number): number {
  return Math.ceil(
    (priceInCents * STRIPE_FEE_PERCENT + STRIPE_FIXED_FEE_CENTS) / (1 - STRIPE_FEE_PERCENT)
  )
}

/** Round cents UP to the next 10. */
function roundUpToDime(cents: number): number {
  return Math.ceil(cents / 10) * 10
}

/**
 * Buyer-facing service fee, per unit, in cents.
 * Dime-rounded, self-inclusive Stripe fee estimate. Buyer pays price + this.
 */
export function serviceFeeAmount(priceInCents: number): number {
  if (priceInCents <= 0) return 0
  return roundUpToDime(stripeFeeEstimate(priceInCents))
}

/**
 * application_fee_amount per unit, in cents.
 *
 * Equals service_fee + (PLATFORM_FEE_CENTS * seatMultiplier). Pass the
 * tier's seats_per_unit as seatMultiplier for group/table tiers so the
 * platform's margin scales with seats actually sold, not just the
 * number of table units purchased. Individual tiers pass 1 (default).
 */
export function applicationFeeAmount(priceInCents: number, seatMultiplier: number = 1): number {
  if (priceInCents <= 0) return 0
  return serviceFeeAmount(priceInCents) + PLATFORM_FEE_CENTS * seatMultiplier
}

/** Buyer's grand total for one unit, in cents. */
export function buyerTotalAmount(priceInCents: number): number {
  return priceInCents + serviceFeeAmount(priceInCents)
}
