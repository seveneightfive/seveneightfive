import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY env var')
}

/**
 * Server-side Stripe client — never import in client components.
 * Use STRIPE_SECRET_KEY (no NEXT_PUBLIC_ prefix).
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover' as const,
  typescript: true,
})

/** Platform fee percentage charged to event creators (e.g. 0.05 = 5%) */
export const PLATFORM_FEE_PERCENT = 0.05
