import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'

/**
 * POST /api/seller/slug
 *
 * Lets a seller change their public /sellers/[slug] URL — once. After
 * a successful change, seller_slug_changed_at is set and this route
 * refuses further changes for that account (see the 409 below). This
 * is a deliberate product decision: an unlimited self-serve slug lets
 * a seller silently break links they've already shared (flyers, QR
 * codes, their own website) with no trace of what the old URL was.
 * One free change covers "I picked a bad slug at signup" without
 * opening the door to habitual churn.
 *
 * Body: { slug: string }
 */

const RESERVED_SLUGS = new Set([
  'new', 'edit', 'create', 'delete', 'settings', 'admin', 'api',
  'login', 'logout', 'signup', 'dashboard', 'help', 'support',
  'about', 'terms', 'privacy', 'contact', 'index', 'null', 'undefined',
])

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const rawSlug = typeof body.slug === 'string' ? body.slug : ''
    const candidate = slugify(rawSlug)

    if (candidate.length < 3) {
      return NextResponse.json(
        { error: 'Your URL needs to be at least 3 characters (letters, numbers, and dashes only).' },
        { status: 400 }
      )
    }

    if (RESERVED_SLUGS.has(candidate)) {
      return NextResponse.json(
        { error: `"${candidate}" is reserved. Please choose something else.` },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('seller_slug, seller_slug_changed_at, is_seller')
      .eq('id', user.id)
      .maybeSingle()

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!profile.is_seller || !profile.seller_slug) {
      return NextResponse.json(
        { error: 'You need an active seller page before you can set a custom URL.' },
        { status: 400 }
      )
    }

    if (profile.seller_slug_changed_at) {
      return NextResponse.json(
        {
          error:
            "You've already used your one-time URL change. Contact support@seveneightfive.com if you need it changed again.",
        },
        { status: 409 }
      )
    }

    if (candidate === profile.seller_slug) {
      return NextResponse.json(
        { error: "That's already your current URL." },
        { status: 400 }
      )
    }

    // Uniqueness check, excluding this profile itself (defensive — the
    // DB unique index on seller_slug is the real enforcement, this just
    // gives a friendlier error before we hit it).
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('seller_slug', candidate)
      .neq('id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'That URL is already taken. Please try another.' },
        { status: 409 }
      )
    }

    const previousSlug = profile.seller_slug

    const { error: updateErr } = await admin
      .from('profiles')
      .update({
        seller_slug: candidate,
        seller_slug_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateErr) {
      // Most likely the unique index caught a race — someone else took
      // this slug between our check and this write.
      if (updateErr.code === '23505') {
        return NextResponse.json(
          { error: 'That URL was just taken by someone else. Please try another.' },
          { status: 409 }
        )
      }
      console.error('[seller/slug] update failed:', updateErr)
      return NextResponse.json({ error: 'Could not update your URL. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ slug: candidate, previousSlug })
  } catch (err: any) {
    console.error('[seller/slug] error:', err)
    return NextResponse.json({ error: err?.message || 'Something went wrong' }, { status: 500 })
  }
}
