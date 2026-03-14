import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/stripe/connect
 *
 * Generates a Stripe Connect Express onboarding link for the
 * currently authenticated user. Stores the stripe_account_id
 * on their profile once created.
 *
 * Body: { returnPath?: string }  — where to redirect after onboarding
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const returnPath = body.returnPath || '/dashboard'
    const origin = request.nextUrl.origin

    // Check if they already have a Stripe connected account
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_account_status, full_name, email')
      .eq('id', user.id)
      .single()

    let accountId = profile?.stripe_account_id

    // Create a new Express account if they don't have one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile?.email || user.email,
        metadata: {
          supabase_user_id: user.id,
          platform: '785magazine',
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        settings: {
          payouts: {
            schedule: { interval: 'weekly', weekly_anchor: 'friday' },
          },
        },
      })

      accountId = account.id

      // Save account ID to profile immediately
      await supabase
        .from('profiles')
        .update({
          stripe_account_id: accountId,
          stripe_account_status: 'pending',
        })
        .eq('id', user.id)
    }

    // Generate an onboarding link (valid for ~5 minutes)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/api/stripe/connect?refresh=1&return=${encodeURIComponent(returnPath)}`,
      return_url: `${origin}/api/stripe/connect/return?account=${accountId}&return=${encodeURIComponent(returnPath)}`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url, accountId })

  } catch (err: any) {
    console.error('[stripe/connect] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to create Connect link' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/stripe/connect?refresh=1&return=/dashboard
 * Called by Stripe when the onboarding link expires — regenerates it.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const isRefresh = searchParams.get('refresh') === '1'
  const returnPath = searchParams.get('return') || '/dashboard'

  if (isRefresh) {
    // Redirect back to dashboard which will re-trigger onboarding
    return NextResponse.redirect(`${origin}${returnPath}?stripe_refresh=1`)
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
