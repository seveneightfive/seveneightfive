import type { SupabaseClient } from '@supabase/supabase-js'
import { stripe } from './stripe'

/**
 * Single source of truth for converting a Stripe Connect account into
 * the profile fields we care about. Used by:
 *
 *   - /api/stripe/connect/return    (post-onboarding redirect)
 *   - /api/tickets/webhook           (account.updated webhook)
 *   - /api/stripe/connect/sync       (manual / self-heal endpoint)
 */

export type StripeAccountStatus = 'pending' | 'restricted' | 'enabled'

export type SyncResult = {
  accountId: string
  status: StripeAccountStatus
  isEnabled: boolean
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

/** Pure inspection — no DB writes. */
export async function inspectStripeAccount(accountId: string): Promise<SyncResult> {
  const account = await stripe.accounts.retrieve(accountId)

  const chargesEnabled = !!account.charges_enabled
  const payoutsEnabled = !!account.payouts_enabled
  const detailsSubmitted = !!account.details_submitted

  const isEnabled = chargesEnabled && payoutsEnabled && detailsSubmitted

  // - enabled    → can sell + receive payouts
  // - restricted → submitted details but Stripe wants more (e.g. ID verification)
  // - pending    → hasn't submitted details yet (backed out of onboarding)
  const status: StripeAccountStatus = isEnabled
    ? 'enabled'
    : detailsSubmitted
      ? 'restricted'
      : 'pending'

  return { accountId, status, isEnabled, detailsSubmitted, chargesEnabled, payoutsEnabled }
}

/**
 * Inspect AND persist. Updates the profile matched by stripe_account_id.
 * On first enable: also sets seller_activated_at, wants_ticketing, is_seller.
 * Pass the admin client — webhooks have no user context.
 */
export async function syncStripeAccountToProfile(
  admin: SupabaseClient,
  accountId: string
): Promise<SyncResult> {
  const result = await inspectStripeAccount(accountId)

  const { data: existing } = await admin
    .from('profiles')
    .select('seller_activated_at, wants_ticketing, is_seller')
    .eq('stripe_account_id', accountId)
    .maybeSingle()

  const updates: Record<string, any> = {
    stripe_account_status: result.status,
    updated_at: new Date().toISOString(),
  }

  if (result.isEnabled) {
    if (!existing?.seller_activated_at) updates.seller_activated_at = new Date().toISOString()
    if (!existing?.wants_ticketing) updates.wants_ticketing = true
    if (!existing?.is_seller) updates.is_seller = true
  }

  const { error } = await admin
    .from('profiles')
    .update(updates)
    .eq('stripe_account_id', accountId)

  if (error) {
    console.error('[stripeSync] failed to update profile:', error)
    throw error
  }

  return result
}