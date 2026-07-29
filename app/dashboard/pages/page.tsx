'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import Link from 'next/link'
import { User, Building2, ArrowUpRight } from 'lucide-react'

type PageRow = {
  id: string
  type: 'artist' | 'venue'
  name: string
  slug: string | null
  image_url: string | null
  editHref: string
  publicHref: string | null
}

/**
 * My Pages — restyled to match the mockup's page-card treatment:
 * gradient-header cards with a category pill top-right, name below,
 * "MANAGE →" as its own line. Same Supabase fetch logic as before,
 * unchanged: artists/venues by auth_user_id, same edit/public hrefs.
 *
 * Note: the mockup's cards use photographic cover images; since this
 * data may or may not have a real image_url, cards without one fall
 * back to a flat gradient tile (varied per row so a list of "no image"
 * pages doesn't look identical) rather than leaving it blank.
 */

const FALLBACK_GRADIENTS = [
  'from-orange-400 via-rose-400 to-brand-600',
  'from-fuchsia-900 via-brand-700 to-gray-950',
  'from-lime-700 via-olive-800 to-gray-950',
]

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-pulse rounded-full bg-gray-300 dark:bg-gray-700"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export default function MyPagesPage() {
  const router = useRouter()
  const [pages, setPages] = useState<PageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const [artistRes, venueRes] = await Promise.all([
        supabase
          .from('artists')
          .select('id, name, slug, image_url, avatar_url')
          .eq('auth_user_id', user.id)
          .maybeSingle(),
        supabase
          .from('venues')
          .select('id, name, slug, image_url')
          .eq('auth_user_id', user.id)
          .maybeSingle(),
      ])

      const rows: PageRow[] = []

      if (artistRes.data) {
        rows.push({
          id: artistRes.data.id,
          type: 'artist',
          name: artistRes.data.name,
          slug: artistRes.data.slug,
          image_url: artistRes.data.image_url || artistRes.data.avatar_url,
          editHref: `/dashboard/edit?id=${artistRes.data.id}`,
          publicHref: artistRes.data.slug ? `/artists/${artistRes.data.slug}` : null,
        })
      }

      if (venueRes.data) {
        rows.push({
          id: venueRes.data.id,
          type: 'venue',
          name: venueRes.data.name,
          slug: venueRes.data.slug,
          image_url: venueRes.data.image_url,
          editHref: `/dashboard/venue?id=${venueRes.data.id}`,
          publicHref: venueRes.data.slug ? `/venues/${venueRes.data.slug}` : null,
        })
      }

      setPages(rows)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <LoadingState />

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {pages.length === 0
          ? "You don't manage any pages yet."
          : `${pages.length} page${pages.length === 1 ? '' : 's'} you manage.`}
      </p>

      {pages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-white/[0.02]">
          <User className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
            No pages yet
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Artist and venue pages are created during onboarding — contact 785 if
            you need one set up.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page, i) => (
            <PageCard key={`${page.type}-${page.id}`} page={page} gradientIndex={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function PageCard({
  page,
  gradientIndex,
}: {
  page: PageRow
  gradientIndex: number
}) {
  const Icon = page.type === 'artist' ? User : Building2
  const gradient = FALLBACK_GRADIENTS[gradientIndex % FALLBACK_GRADIENTS.length]

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-gray-700">
      {/* Header image — gradient tile if no real cover photo, mockup style */}
      <Link href={page.editHref} className="relative block h-[140px] shrink-0">
        {page.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${gradient}`} />
        )}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gray-950/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
          <Icon className="h-2.5 w-2.5" />
          {page.type === 'artist' ? 'Artist' : 'Venue'}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <Link href={page.editHref} className="group min-w-0">
          <div className="truncate font-display text-lg font-bold uppercase tracking-wide text-gray-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
            {page.name}
          </div>
        </Link>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <Link
            href={page.editHref}
            className="inline-flex items-center gap-1 font-display text-xs font-bold uppercase tracking-[0.1em] text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Manage →
          </Link>
          {page.publicHref && (
            <a
              href={page.publicHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.08]"
              title="View public page"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
