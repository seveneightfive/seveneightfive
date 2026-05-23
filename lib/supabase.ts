import { createBrowserClient } from '@supabase/ssr'

// Singleton browser client. Reads/writes auth from Next.js cookies, so
// server-rendered logins are visible to client components and requests go
// out with the user's JWT instead of the anon key.
//
// Lazy initialization means this file is safe to import from anywhere — the
// actual createBrowserClient() call only runs the first time `supabase` is
// touched in a browser context. (Server code that accidentally imports this
// won't crash at module-load time; it'll only fail if it actually uses it.)
let _client: ReturnType<typeof createBrowserClient> | undefined

function getClient() {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return _client
}

// Lazy getter via a getter on a module-level object. Preserves the
// `import { supabase } from '@/lib/supabase'` API at all callsites, and
// keeps TypeScript's type inference intact (no Proxy in the way).
export const supabase = new Proxy(
  {} as ReturnType<typeof createBrowserClient>,
  {
    get(_target, prop, receiver) {
      return Reflect.get(getClient(), prop, receiver)
    },
  }
)
