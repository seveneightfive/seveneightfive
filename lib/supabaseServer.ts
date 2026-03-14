import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side admin client using the service role key.
 * - Bypasses RLS — use only in trusted server contexts (API routes, server actions).
 * - Never import this in client components or expose to the browser.
 * - For server components that need the user's session/RLS, use supabaseServerAuth.ts instead.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. ' +
      'Add SUPABASE_SERVICE_ROLE_KEY to your .env.local (never prefix with NEXT_PUBLIC_).'
    )
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
