'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ArticleSummary } from './page'
import { Search } from 'lucide-react'

export default function ArticlesClient({ articles }: { articles: ArticleSummary[] }) {
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('All')

  const allTags = useMemo(() => {
    const set = new Set<string>()
    articles.forEach(a => {
      ;[...(a.categoryNames || []), ...(a.tagNames || [])].forEach(t => set.add(t))
    })
    return ['All', ...Array.from(set).sort()]
  }, [articles])

  const filtered = useMemo(() => {
    let list = articles
    if (tagFilter !== 'All') {
      list = list.filter(a => (a.categoryNames || []).includes(tagFilter) || (a.tagNames || []).includes(tagFilter))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt?.toLowerCase().includes(q) ||
        a.authorName?.toLowerCase().includes(q)
      )
    }
    return list
  }, [articles, search, tagFilter])

  const [featured, ...rest] = filtered

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="mb-1 font-body text-xs font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">
          seveneightfive
        </p>
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Articles
        </h1>
        <p className="mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-300">
          Stories about Topeka — local flavor, live music, art, and everything else going on around the 785.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search articles…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
          aria-label="Search articles"
        />
      </div>

      {/* Tag filter */}
      {allTags.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                tagFilter === tag
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center dark:border-gray-700 dark:bg-white/[0.02]">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {articles.length === 0 ? 'No articles published yet.' : 'No articles match your search.'}
          </p>
        </div>
      ) : (
        <>
          {/* Featured — first (most recent) result gets a bigger card, but
              only when not actively filtering, so search results read as a
              flat, equal-weight list instead. */}
          {featured && !search.trim() && tagFilter === 'All' && (
            <Link
              href={`/${featured.slug}`}
              className="group mb-8 grid gap-5 overflow-hidden rounded-2xl border border-gray-200 transition hover:border-gray-300 hover:shadow-theme-md sm:grid-cols-2 dark:border-gray-800"
            >
              {featured.mainImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featured.mainImageUrl}
                  alt={featured.title}
                  className="h-64 w-full object-cover transition group-hover:scale-[1.02] sm:h-full"
                />
              )}
              <div className="flex flex-col justify-center p-6">
                {(featured.categoryNames?.[0] || featured.tagNames?.[0]) && (
                  <span className="mb-2 inline-block w-fit rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
                    {featured.categoryNames?.[0] || featured.tagNames?.[0]}
                  </span>
                )}
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                  {featured.title}
                </h2>
                {featured.excerpt && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{featured.excerpt}</p>
                )}
                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  {featured.authorName && <span>By {featured.authorName}</span>}
                  {featured.publishedAt && (
                    <>
                      {featured.authorName && <span> · </span>}
                      <span>{new Date(featured.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(search.trim() || tagFilter !== 'All' ? filtered : rest).map(article => (
              <Link
                key={article._id}
                href={`/${article.slug}`}
                className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.02]"
              >
                {article.mainImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={article.mainImageUrl}
                    alt={article.title}
                    className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 dark:bg-white/[0.04]">
                    <span className="font-display text-3xl font-bold text-gray-300 dark:text-gray-700">785</span>
                  </div>
                )}
                <div className="p-4">
                  {(article.categoryNames?.[0] || article.tagNames?.[0]) && (
                    <span className="mb-1.5 inline-block text-[10px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                      {article.categoryNames?.[0] || article.tagNames?.[0]}
                    </span>
                  )}
                  <h3 className="font-display text-base font-semibold leading-snug text-gray-900 dark:text-white">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">{article.excerpt}</p>
                  )}
                  <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-500">
                    {article.publishedAt && new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
