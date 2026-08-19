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

// ── seller_slug generation ────────────────────────────────────────────
//
// Nothing else in the codebase writes profiles.seller_slug — it's read
// everywhere (lib/sellers.ts, /sellers/[slug]) but was never populated
// on the way in, which is why most existing sellers currently have no
// public page. This generates one the first time a seller is enabled.

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function generateUniqueSellerSlug(
  admin: SupabaseClient,
  seedCandidates: (string | null | undefined)[]
): Promise<string> {
  const root =
    seedCandidates.map((c) => (c ? slugify(c) : '')).find((s) => s.length > 0) || 'seller'

  let candidate = root
  let suffix = 2
  // Small, bounded loop — collisions on a slug root are rare in practice.
  while (suffix < 50) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('seller_slug', candidate)
      .maybeSingle()
    if (!data) return candidate
    candidate = `${root}-${suffix}`
    suffix++
  }
  // Extremely unlikely fallback to guarantee termination + uniqueness.
  return `${root}-${Date.now()}`
}

/**
 * Inspect AND persist. Updates the profile matched by stripe_account_id.
 * On first enable: also sets seller_activated_at, wants_ticketing, is_seller,
 * and — if not already set — a unique seller_slug so /sellers/[slug] works
 * immediately.
 * Pass the admin client — webhooks have no user context.
 */
export async function syncStripeAccountToProfile(
  admin: SupabaseClient,
  accountId: string
): Promise<SyncResult> {
  const result = await inspectStripeAccount(accountId)

  const { data: existing } = await admin
    .from('profiles')
    .select(
      'seller_activated_at, wants_ticketing, is_seller, seller_slug, seller_business_name, full_name, username'
    )
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

    if (!existing?.seller_slug) {
      updates.seller_slug = await generateUniqueSellerSlug(admin, [
        existing?.seller_business_name,
        existing?.full_name,
        existing?.username,
      ])
    }
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
