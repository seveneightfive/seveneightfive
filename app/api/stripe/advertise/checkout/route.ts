import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/stripe/advertise/checkout
 *
 * Creates a Stripe Checkout Session for an advertisement purchase.
 * Charges directly to the platform account — no Stripe Connect involved.
 *
 * Body: {
 *   headline, ad_copy, content, ad_image_url,
 *   button_text, button_link, start_date, duration (5 | 14)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { headline, ad_copy, content, ad_image_url, button_text, button_link, start_date, duration } = body

    if (!headline || !ad_copy || !button_text || !button_link || !start_date || !duration) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (duration !== 5 && duration !== 14) {
      return NextResponse.json({ error: 'Invalid duration — must be 5 or 14' }, { status: 400 })
    }

    const priceInCents = duration === 5 ? 1000 : 1500

    // Calculate end_date
    const start = new Date(start_date + 'T12:00:00')
    start.setDate(start.getDate() + duration - 1)
    const end_date = start.toISOString().split('T')[0]

    const origin = request.nextUrl.origin
    const admin = createAdminClient()

    // Insert ad as draft/pending — goes live after payment confirmed by webhook
    const { data: ad, error: insertError } = await admin
      .from('advertisements')
      .insert({
        user_id: user.id,
        headline,
        ad_copy,
        content: content || null,
        ad_image_url: ad_image_url || null,
        button_text,
        button_link,
        start_date,
        end_date,
        duration,
        price: priceInCents,
        payment_status: 'pending',
        status: 'draft',
        views: 0,
        clicks: 0,
      })
      .select('id')
      .single()

    if (insertError || !ad) {
      console.error('[advertise/checkout] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save advertisement' }, { status: 500 })
    }

    // Create Stripe Checkout — direct charge, no transfer_data
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: priceInCents,
            product_data: {
              name: `seveneightfive Banner Ad — ${duration} Days`,
              description: `"${headline}" · ${start_date} → ${end_date}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'advertisement',
        ad_id: ad.id,
      },
      success_url: `${origin}/dashboard/advertise?success=1`,
      cancel_url: `${origin}/dashboard/advertise?cancelled=1&ad_id=${ad.id}`,
    })

    return NextResponse.json({ url: session.url })

  } catch (err: any) {
    console.error('[advertise/checkout] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
