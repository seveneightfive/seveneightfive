import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { syncStripeAccountToProfile } from '@/lib/stripeSync'

/**
 * GET /api/stripe/connect/return?account=acct_xxx&return=/dashboard
 *
 * Stripe redirects here after Connect onboarding completes (or is abandoned).
 * Uses the shared sync helper so the side effects (seller_activated_at,
 * wants_ticketing) are consistent with the webhook path.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const accountId = searchParams.get('account')
  const returnPath = searchParams.get('return') || '/dashboard'

  if (!accountId) {
    return NextResponse.redirect(`${origin}${returnPath}?stripe_error=missing_account`)
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${origin}/login`)
    }

    const admin = createAdminClient()
    const result = await syncStripeAccountToProfile(admin, accountId)

    const redirectUrl = result.isEnabled
      ? `${origin}${returnPath}?stripe_connected=1`
      : `${origin}${returnPath}?stripe_pending=1`

    return NextResponse.redirect(redirectUrl)
  } catch (err: any) {
    console.error('[stripe/connect/return] error:', err)
    return NextResponse.redirect(`${origin}${returnPath}?stripe_error=1`)
  }
}