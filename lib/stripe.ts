import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY env var')
}

// Use the literal version string the package ships with.
// Typed as `typeof ApiVersion` (i.e. the exact literal) to satisfy StripeConfig.
const API_VERSION = '2026-02-25.clover' satisfies Stripe.LatestApiVersion

/**
 * Server-side Stripe client — never import in client components.
 * Use STRIPE_SECRET_KEY (no NEXT_PUBLIC_ prefix).
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: API_VERSION,
  typescript: true,
})

/** Platform fee percentage charged to event creators (e.g. 0.05 = 5%) */
export const PLATFORM_FEE_PERCENT = 0.05
