import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Admin client — server-side only, never expose service role key to browser
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, lastName } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const fullName = [firstName, lastName].filter(Boolean).join(' ')

    // Get current phone-authenticated user from session cookie
    const response = NextResponse.next()
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

    const { data: { user: phoneUser } } = await supabase.auth.getUser()

    if (!phoneUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Look for an existing auth user with this email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    })

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    const existingEmailUser = users.find(u =>
      u.email?.toLowerCase() === email.toLowerCase() && u.id !== phoneUser.id
    )

    if (existingEmailUser) {
      // ── MERGE: found existing email-based account ──
      const oldId = existingEmailUser.id
      const newId = phoneUser.id

      // 1. Add email + name to the phone auth user
      await supabaseAdmin.auth.admin.updateUserById(newId, {
        email,
        user_metadata: { full_name: fullName, first_name: firstName, last_name: lastName },
      })

      // 2. Migrate join tables from old user → new user
      await Promise.all([
        supabaseAdmin.from('artist_users').update({ user_id: newId }).eq('user_id', oldId),
        supabaseAdmin.from('venue_users').update({ user_id: newId }).eq('user_id', oldId),
        supabaseAdmin.from('event_users').update({ user_id: newId }).eq('user_id', oldId),
      ])

      // 3. Migrate auth_user_id on entity tables
      await Promise.all([
        supabaseAdmin.from('artists').update({ auth_user_id: newId }).eq('auth_user_id', oldId),
        supabaseAdmin.from('venues').update({ auth_user_id: newId }).eq('auth_user_id', oldId),
        supabaseAdmin.from('events').update({ auth_user_id: newId }).eq('auth_user_id', oldId),
      ])

      // 4. Migrate or create profile
      const { data: oldProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', oldId)
        .maybeSingle()

      if (oldProfile) {
        await supabaseAdmin.from('profiles').upsert({
          ...oldProfile,
          id: newId,
          email,
          full_name: fullName,
          phone_number: phoneUser.phone,
        })
        await supabaseAdmin.from('profiles').delete().eq('id', oldId)
      } else {
        await supabaseAdmin.from('profiles').upsert({
          id: newId,
          email,
          full_name: fullName,
          phone_number: phoneUser.phone,
        })
      }

      // 5. Delete the old email-only auth user
      await supabaseAdmin.auth.admin.deleteUser(oldId)

    } else {
      // ── NEW USER: no existing account — just add email + name ──
      await supabaseAdmin.auth.admin.updateUserById(phoneUser.id, {
        email,
        user_metadata: { full_name: fullName, first_name: firstName, last_name: lastName },
      })

      await supabaseAdmin.from('profiles').upsert({
        id: phoneUser.id,
        email,
        full_name: fullName,
        phone_number: phoneUser.phone,
      })
    }

    // Run entity matching for both paths
    const { data: role, error: matchError } = await supabaseAdmin
      .rpc('match_user_to_entities', {
        p_user_id: phoneUser.id,
        p_email: email,
      })

    if (matchError) {
      console.error('[auth/merge] match error:', matchError.message)
      return NextResponse.json({ error: matchError.message }, { status: 500 })
    }

    return NextResponse.json({ role })

  } catch (err) {
    console.error('[auth/merge] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
