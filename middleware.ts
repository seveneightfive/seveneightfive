import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Legacy "-N" slug redirects ───────────────────────────────────────────────
//
// Until Oct 2026 the Airtable pull sync's upsert made the slug trigger see the
// row's own slug as "taken" and append -1 (sometimes flipping back on a later
// sync), so lots of shared links / Google results point at e.g.
// /events/smoke-on-the-water-1. Those rows have since been renamed back to the
// clean slug. When a /events|venues|artists/<slug>-<N> URL no longer exists
// but <slug> does, send a permanent redirect so old links keep working and
// Google moves its index over. Real duplicates (e.g. two events both titled
// "Trivia Night" -> trivia-night and trivia-night-2) still exist under their
// suffixed slug, so they're found directly and never redirected.

const SLUG_ROUTE = /^\/(events|venues|artists)\/([a-z0-9-]+)-\d+\/?$/

async function legacySlugRedirect(request: NextRequest): Promise<NextResponse | null> {
  const match = request.nextUrl.pathname.match(SLUG_ROUTE)
  if (!match) return null

  const [, table] = match
  const fullSlug = request.nextUrl.pathname.split('/')[2]
  const baseSlug = match[2]

  try {
    const url =
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}` +
      `?select=slug&slug=in.(${encodeURIComponent(`"${fullSlug}","${baseSlug}"`)})`
    const res = await fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    })
    if (!res.ok) return null

    const rows: { slug: string }[] = await res.json()
    const slugs = new Set(rows.map((r) => r.slug))

    // The suffixed slug is a real row (a genuine duplicate) — leave it alone.
    if (slugs.has(fullSlug)) return null

    if (slugs.has(baseSlug)) {
      const target = request.nextUrl.clone()
      target.pathname = `/${table}/${baseSlug}`
      return NextResponse.redirect(target, 308)
    }
  } catch {
    // Never let a lookup failure break the page — just fall through.
  }
  return null
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public detail pages: only the legacy-slug check, no auth/session work.
  if (!pathname.startsWith('/dashboard')) {
    return (await legacySlugRedirect(request)) ?? NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const PROTECTED = [
    '/dashboard/tickets',
    '/dashboard/following',
    '/dashboard/edit',
    '/dashboard/venue',
    '/dashboard/events',
    '/dashboard/advertise',
    '/dashboard/scan',
    '/dashboard/appearances',
    '/dashboard/announcements',
    '/dashboard/settings',
    '/dashboard/save-the-date',
  ]

  const needsAuth = PROTECTED.some(p => pathname.startsWith(p))

  if (!user && needsAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/events/:slug', '/venues/:slug', '/artists/:slug'],
}
