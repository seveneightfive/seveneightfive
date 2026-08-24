'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseBrowser'
import { Loader2, Plus, FileText } from 'lucide-react'

type Post = {
  _id: string
  title: string
  slug: { current: string } | null
  status: 'draft' | 'published'
  publishedAt: string | null
  mainImageUrl: string | null
}

export default function MyArticlesPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?next=${encodeURIComponent('/dashboard/articles')}`)
        return
      }

      // Sanity read is via the public read-only client, filtered to this
      // user's own authUserId — no server round trip needed for a list view.
      const { client } = await import('@/lib/sanity')
      const data = await client.fetch(
        `*[_type == "post" && authUserId == $uid] | order(_updatedAt desc){
          _id, title, slug, status, publishedAt, mainImageUrl
        }`,
        { uid: session.user.id }
      )
      setPosts(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="mb-1 font-display text-xl font-bold uppercase tracking-wide text-gray-900 dark:text-white">
            My Articles
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Articles you've written for the magazine.
          </p>
        </div>
        <Link
          href="/dashboard/articles/edit"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Article
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center dark:border-gray-700 dark:bg-white/[0.02]">
          <FileText className="h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You haven't written anything yet.
          </p>
          <Link
            href="/dashboard/articles/edit"
            className="mt-1 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Write Your First Article
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {posts.map(post => (
            <Link
              key={post._id}
              href={`/dashboard/articles/edit?id=${post._id}`}
              className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700"
            >
              {post.mainImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.mainImageUrl} alt={post.title} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/[0.06]">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-base font-semibold text-gray-900 dark:text-white">
                  {post.title}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-bold uppercase tracking-wide ${
                      post.status === 'published'
                        ? 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400'
                    }`}
                  >
                    {post.status}
                  </span>
                  {post.publishedAt && (
                    <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </ul>
      )}
    </div>
  )
}
