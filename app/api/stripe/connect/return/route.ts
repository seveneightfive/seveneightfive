import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { stripe } from '@/lib/stripe'

/**
 * GET /api/stripe/connect/return?account=acct_xxx&return=/dashboard
 *
 * Stripe redirects here after Connect onboarding completes.
 * We check the account status and update the profile accordingly.
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

    // Check the account status with Stripe
    const account = await stripe.accounts.retrieve(accountId)

    const isEnabled =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted

    const status = isEnabled ? 'enabled' : 'restricted'

    // Update profile with latest status using admin client
    const admin = createAdminClient()
    await admin
      .from('profiles')
      .update({
        stripe_account_id: accountId,
        stripe_account_status: status,
      })
      .eq('id', user.id)

    const redirectUrl = isEnabled
      ? `${origin}${returnPath}?stripe_connected=1`
      : `${origin}${returnPath}?stripe_pending=1`

    return NextResponse.redirect(redirectUrl)

  } catch (err: any) {
    console.error('[stripe/connect/return] error:', err)
    return NextResponse.redirect(`${origin}${returnPath}?stripe_error=1`)
  }
}
