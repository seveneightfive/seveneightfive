import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  // ✅ Use a mutable redirectTo variable instead of a fixed response
  let redirectTo = `${origin}/`

  // ✅ Temp response just for cookie plumbing during exchangeCodeForSession
  const tempResponse = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            tempResponse.cookies.set(name, value, options)
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
    const { data: artist } = await supabase
      .from('artists')
      .select('id, auth_user_id')
      .eq('artist_email', userEmail)
      .maybeSingle()

    if (artist) {
      if (!artist.auth_user_id) {
        await supabase.from('artists').update({ auth_user_id: user.id }).eq('id', artist.id)
      }
      redirectTo = `${origin}/dashboard`
    } else {
      const { data: venue } = await supabase
        .from('venues')
        .select('id, auth_user_id')
        .eq('email', userEmail)
        .maybeSingle()

      if (venue) {
        if (!venue.auth_user_id) {
          await supabase.from('venues').update({ auth_user_id: user.id }).eq('id', venue.id)
        }
        redirectTo = `${origin}/dashboard`
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (!profile) {
          redirectTo = `${origin}/login?complete=1`
        } else {
          redirectTo = `${origin}/`
        }
      }
    }
  }

  // ✅ Build ONE final response and copy all cookies onto it
  const finalResponse = NextResponse.redirect(redirectTo)
  tempResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    finalResponse.cookies.set(name, value, options)
  })

  return finalResponse
}