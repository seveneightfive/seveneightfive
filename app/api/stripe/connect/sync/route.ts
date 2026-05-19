import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { syncStripeAccountToProfile } from '@/lib/stripeSync'

/**
 * POST /api/stripe/connect/sync
 *
 * Re-checks the current user's Stripe Connect account against Stripe and
 * updates their profile. Lets people self-heal when the return-URL flow
 * didn't fire (e.g. they closed the tab early) or when the account.updated
 * webhook wasn't configured.
 *
 * Idempotent. Safe to call on every Payouts page load.
 */
export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_account_id) {
    return NextResponse.json({ error: 'No Stripe account on file' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const result = await syncStripeAccountToProfile(admin, profile.stripe_account_id)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[stripe/connect/sync] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Sync failed' },
      { status: 500 }
    )
  }
}