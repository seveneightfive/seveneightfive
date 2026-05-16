import { createClient } from '@/lib/supabaseServerAuth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Following — 785 Magazine',
  description: 'Artists and venues you follow on 785 Magazine.',
}

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

type FollowRow = {
  entity_type: 'artist' | 'venue'
  entity_id: string
  created_at: string | null
}

type FollowedItem = {
  kind: 'artist' | 'venue'
  id: string
  name: string
  slug: string | null
  type: string | null
  imageUrl: string | null
  followedAt: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FollowingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Guard. Middleware already protects /dashboard sub-routes, but we double
  // up because this page surfaces personalized data and a hard redirect is
  // a clearer UX than rendering an empty shell.
  if (!user) {
    redirect('/login?next=/dashboard/following')
  }

  // 1. Pull every follow row for this user, keeping created_at so we can sort
  //    by recency. If your `follows` table doesn't have created_at, drop it
  //    from the select — the fallback alphabetical sort below still works.
  const { data: followRows } = await supabase
    .from('follows')
    .select('entity_type, entity_id, created_at')
    .eq('follower_id', user.id)
    .in('entity_type', ['artist', 'venue'])

  const rows: FollowRow[] = (followRows as FollowRow[]) || []

  const artistIds = rows.filter((r) => r.entity_type === 'artist').map((r) => r.entity_id)
  const venueIds  = rows.filter((r) => r.entity_type === 'venue').map((r) => r.entity_id)

  // 2. Resolve names/slugs/avatars in parallel. Bail out cleanly when either
  //    list is empty so we don't issue empty IN() queries.
  const [{ data: artists }, { data: venues }] = await Promise.all([
    artistIds.length
      ? supabase
          .from('artists')
          .select('id, name, slug, avatar_url, image_url, artist_type')
          .in('id', artistIds)
      : Promise.resolve({ data: [] as any[] }),
    venueIds.length
      ? supabase
          .from('venues')
          .select('id, name, slug, logo, image_url, venue_type')
          .in('id', venueIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // 3. Build a lookup keyed by entity_id so we can splice each follow row
  //    back to its display data without an N+1 scan.
  const artistMap = new Map<string, any>((artists || []).map((a: any) => [a.id, a]))
  const venueMap  = new Map<string, any>((venues  || []).map((v: any) => [v.id, v]))

  // 4. Merge into a single list. We preserve the follow row's created_at
  //    so the page can sort by "most recently followed" — which matches the
  //    mental model of a follow feed.
  const items: FollowedItem[] = rows
    .map((row) => {
      if (row.entity_type === 'artist') {
        const a = artistMap.get(row.entity_id)
        if (!a) return null
        return {
          kind: 'artist' as const,
          id: a.id,
          name: a.name,
          slug: a.slug ?? null,
          type: a.artist_type ?? null,
          imageUrl: a.avatar_url || a.image_url || null,
          followedAt: row.created_at,
        }
      }
      const v = venueMap.get(row.entity_id)
      if (!v) return null
      return {
        kind: 'venue' as const,
        id: v.id,
        name: v.name,
        slug: v.slug ?? null,
        // venue_type may be string OR string[] in your schema — handle both.
        type: Array.isArray(v.venue_type) ? v.venue_type[0] : v.venue_type ?? null,
        imageUrl: v.logo || v.image_url || null,
        followedAt: row.created_at,
      }
    })
    .filter((x): x is FollowedItem => x !== null)
    // Newest follow first. Falls back to alphabetical by name when
    // created_at is missing (e.g., older follow rows pre-timestamp).
    .sort((a, b) => {
      if (a.followedAt && b.followedAt) {
        return b.followedAt.localeCompare(a.followedAt)
      }
      if (a.followedAt) return -1
      if (b.followedAt) return 1
      return a.name.localeCompare(b.name)
    })

  const artistCount = items.filter((i) => i.kind === 'artist').length
  const venueCount  = items.filter((i) => i.kind === 'venue').length

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // Shell (sidebar + header) is provided by app/dashboard/layout.tsx, so this
  // page just renders the content card.
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400 mb-1">
          Artists &amp; Venues
        </p>
        <h1 className="font-display text-3xl font-bold leading-none text-gray-900 dark:text-white mb-2">
          Following
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {items.length > 0
            ? `${items.length} total — ${artistCount} ${artistCount === 1 ? 'artist' : 'artists'}, ${venueCount} ${venueCount === 1 ? 'venue' : 'venues'}`
            : "You haven't followed anyone yet."}
        </p>
      </div>

      {/* List card */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => (
              <FollowRowItem key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function FollowRowItem({ item }: { item: FollowedItem }) {
  // Public profile URL. If your slugs route differently (e.g. legacy
  // /topeka-art-galleries/[slug] for some venues), tweak here.
  const href = item.slug
    ? item.kind === 'artist'
      ? `/artists/${item.slug}`
      : `/venues/${item.slug}`
    : '#'

  const typeLabel =
    item.type ?? (item.kind === 'artist' ? 'Artist' : 'Venue')

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50 dark:hover:bg-white/[0.02]"
      >
        <Avatar kind={item.kind} name={item.name} src={item.imageUrl} />
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {item.name}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              {typeLabel}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
              · {item.kind === 'artist' ? 'Artist' : 'Venue'}
            </span>
          </div>
        </div>
        <span
          className="text-gray-300 group-hover:text-gray-500 dark:text-gray-600"
          aria-hidden
        >
          →
        </span>
      </Link>
    </li>
  )
}

function Avatar({
  kind,
  name,
  src,
}: {
  kind: 'artist' | 'venue'
  name: string
  src: string | null
}) {
  // Same shape convention as the dashboard cards: circles for people,
  // rounded squares for places.
  const shape = kind === 'venue' ? 'rounded-lg' : 'rounded-full'
  return (
    <div
      className={`flex items-center justify-center w-10 h-10 ${shape} bg-brand-50 text-brand-700 text-sm font-bold shrink-0 overflow-hidden dark:bg-brand-500/15 dark:text-brand-300`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        name?.[0] ?? '?'
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-display text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Nothing followed yet
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
        Follow artists and venues to see them here. You&apos;ll be the first to
        hear when they post events, announcements, or new ticket drops.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/artists"
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold"
        >
          Discover artists
        </Link>
        <Link
          href="/venues"
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.02] text-sm font-semibold"
        >
          Browse venues
        </Link>
      </div>
    </div>
  )
}
