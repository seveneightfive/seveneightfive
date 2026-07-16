import { createClient } from '@/lib/supabaseServer'
import type { Metadata } from 'next'
import MagazineArchiveClient from './MagazineArchiveClient'

export const metadata: Metadata = {
  title: 'Magazine Archive — seveneightfive Magazine',
  description:
    'Browse back issues of seveneightfive magazine — flip through every past issue online.',
}

export const dynamic = 'force-dynamic'

export type Issue = {
  id: string
  issue_number: number | null
  title: string
  cover_image_url: string
  flipbook_url: string
  published_date: string | null
  featured: boolean
}

export default async function MagazineArchivePage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('magazine_issues')
    .select('id, issue_number, title, cover_image_url, flipbook_url, published_date, featured')
    // Sort by issue number.
    .order('issue_number', { ascending: false, nullsFirst: false })

  const issues: Issue[] = data ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="mb-1 font-body text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
          Archive
        </p>
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-gray-900 dark:text-white">
          Back Issues
        </h1>
        <p className="mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-300">
          Every past issue of seveneightfive, right here. Click a cover to flip through it.
        </p>
      </div>

      {issues.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          No issues have been added yet.
        </p>
      ) : (
        <MagazineArchiveClient issues={issues} />
      )}
    </div>
  )
}
