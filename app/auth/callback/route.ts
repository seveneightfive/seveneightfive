import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const response = NextResponse.redirect(`${origin}/dashboard`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !session) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const user = session.user
  const userEmail = user.email

  if (userEmail) {
    // Check if this email user is linked to an artist or venue
    const { data: artist } = await supabase
      .from('artists')
      .select('id, auth_user_id')
      .eq('artist_email', userEmail)
      .maybeSingle()

    if (artist) {
      // Link auth_user_id if not already set
      if (!artist.auth_user_id) {
        await supabase
          .from('artists')
          .update({ auth_user_id: user.id })
          .eq('id', artist.id)
      }
      // Route to dashboard
      return NextResponse.redirect(`${origin}/dashboard`)
    }

    // Check venues
    const { data: venue } = await supabase
      .from('venues')
      .select('id, auth_user_id')
      .eq('email', userEmail)
      .maybeSingle()

    if (venue) {
      if (!venue.auth_user_id) {
        await supabase
          .from('venues')
          .update({ auth_user_id: user.id })
          .eq('id', venue.id)
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }

    // No entity match — check if user has completed signup (has a profile)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      // New user who signed up via magic link but hasn't completed merge yet
      return NextResponse.redirect(`${origin}/login?complete=1`)
    }

    // Returning user with no linked entities — send home
    return NextResponse.redirect(`${origin}/`)
  }

  return response
}
