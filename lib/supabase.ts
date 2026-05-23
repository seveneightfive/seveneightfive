'use client'

import { createBrowserClient, type SupabaseClient } from '@supabase/ssr'

// Memoize so we don't spin up "Multiple GoTrueClient instances" — that warning
// you saw in Firefox devtools comes from multiple Supabase clients fighting over
// the same cookie/storage namespace. One client per browser tab is the rule.
let _client: SupabaseClient | undefined

function getClient(): SupabaseClient {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return _client
}

// Drop-in replacement for the previous `export const supabase = createClient(...)`.
// Same call sites, but reads/writes the auth session from Next.js cookies, so
// server-rendered logins are visible to client components and requests go out
// with the user's JWT instead of the anon key.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>
    return c[prop as string]
  },
})
