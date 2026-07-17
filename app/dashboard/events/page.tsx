'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import Link from 'next/link'
import { User, Building2, ArrowUpRight, Plus } from 'lucide-react'

type PageRow = {
  id: string
  type: 'artist' | 'venue'
  name: string
  slug: string | null
  image_url: string | null
  editHref: string
  publicHref: string | null
}

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
    <div className="mx-auto max-w-2xl space-y-6">
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
        <div className="flex flex-col gap-2.5">
          {pages.map((page) => (
            <PageCard key={`${page.type}-${page.id}`} page={page} />
          ))}
        </div>
      )}
    </div>
  )
}

function PageCard({ page }: { page: PageRow }) {
  const Icon = page.type === 'artist' ? User : Building2

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-gray-300 bg-white p-4 transition hover:border-brand-400 hover:shadow-theme-sm dark:border-gray-700 dark:bg-white/[0.03] dark:hover:border-brand-500/50">
      {/* Thumbnail */}
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/[0.05]">
        {page.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className="h-5 w-5 text-gray-400 dark:text-gray-600" />
          </div>
        )}
      </div>

      <Link href={page.editHref} className="min-w-0 flex-1">
        <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-700 dark:border-gray-700 dark:bg-white/[0.05] dark:text-gray-300">
          <Icon className="h-2.5 w-2.5" />
          {page.type === 'artist' ? 'Artist page' : 'Venue page'}
        </div>
        <div className="truncate font-display text-sm font-semibold uppercase tracking-wide text-gray-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
          {page.name}
        </div>
      </Link>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {page.publicHref && (
          <a
            href={page.publicHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.08]"
            title="View public page"
          >
            <ArrowUpRight className="h-4 w-4" />
          </a>
        )}
        <Link
          href={page.editHref}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-brand-700"
        >
          Manage
        </Link>
      </div>
    </div>
  )
}
