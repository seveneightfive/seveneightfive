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

/** Stripe processing fee: 2.9% of ticket price */
export const STRIPE_FEE_PERCENT = 0.029

/** Per-ticket fee: $0.30 Stripe fixed fee + $0.70 platform fee = $1.00 total */
export const PER_TICKET_FEE = 1.00

/**
 * Calculate the application_fee_amount (in cents) to pass to Stripe.
 * This is the $0.70 platform fee only — Stripe takes its 2.9% + $0.30 automatically.
 */
export function platformFeeAmount(priceInCents: number): number {
  return 70 // $0.70 in cents per ticket
}
