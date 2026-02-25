import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
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
      await supabase
        .from('artists')
        .update({ auth_user_id: session.user.id })
        .eq('id', artist.id)
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
