import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  // Create the redirect response first so cookies can be set on it
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

  // Auto-link auth user to artist record on first login
  const userEmail = session.user.email
  if (userEmail) {
    const { data: artist } = await supabase
      .from('artists')
      .select('id, auth_user_id')
      .eq('artist_email', userEmail)
      .single()

    if (artist && !artist.auth_user_id) {
      const { error: linkError } = await supabase
        .from('artists')
        .update({ auth_user_id: session.user.id })
        .eq('id', artist.id)
      if (linkError) {
        console.error('[auth/callback] Failed to link auth_user_id:', linkError.message)
      }
    } else if (!artist) {
      console.error('[auth/callback] No artist found for email:', userEmail)
    }
  }

  return response
}
