import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { renderPortableText, type PortableTextBlock } from '@/lib/renderPortableText'

export const revalidate = 60

type ArticlePost = {
  _id: string
  title: string
  slug: string
  excerpt: string | null
  mainImageUrl: string | null
  publishedAt: string | null
  authorName: string | null
  tagNames: string[]
  body: PortableTextBlock[]
}

const QUERY = `*[_type == "post" && status == "published" && slug.current == $slug][0]{
  _id, title, "slug": slug.current, excerpt, publishedAt, body,
  "mainImageUrl": coalesce(mainImageUrl, mainImage.asset->url),
  "authorName": coalesce(authorName, author->name),
  "tagNames": coalesce(tagNames, tags, [])
}`

// Same reasoning as app/articles/page.tsx: the imported `tags` data has at
// least one stray reference object where a string was expected, which
// crashes rendering if handed straight to JSX. General safety net, not a
// one-off patch.
async function getArticle(slug: string): Promise<ArticlePost | null> {
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || !process.env.NEXT_PUBLIC_SANITY_DATASET) {
    console.warn('[slug] Sanity env vars not set — article pages will 404.')
    return null
  }
  try {
    const { client } = await import('@/lib/sanity')
    const article = await client.fetch(QUERY, { slug })
    if (!article) return null
    return {
      ...article,
      tagNames: (article.tagNames || []).filter((x: unknown) => typeof x === 'string'),
    }
  } catch (err) {
    console.error('[slug] Sanity fetch failed:', err)
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) return {}

  return {
    title: `${article.title} — 785 Magazine`,
    description: article.excerpt || undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt || undefined,
      images: article.mainImageUrl ? [article.mainImageUrl] : undefined,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt || undefined,
      images: article.mainImageUrl ? [article.mainImageUrl] : undefined,
    },
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticle(slug)

  // Not a known article slug — fall through to Next's 404. Static routes
  // (e.g. /shop, /local-flavor, /venues) always win over this catch-all,
  // since Next.js prefers a matching static segment at the same level.
  if (!article) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    image: article.mainImageUrl ? [article.mainImageUrl] : undefined,
    datePublished: article.publishedAt || undefined,
    author: article.authorName ? { '@type': 'Person', name: article.authorName } : undefined,
  }

  return (
    <article className="mx-auto max-w-2xl px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {article.tagNames?.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {article.tagNames.map(t => (
            <span key={t} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
              {t}
            </span>
          ))}
        </div>
      )}

      <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-gray-900 dark:text-white sm:text-4xl">
        {article.title}
      </h1>

      <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        {article.authorName && <span>By {article.authorName}</span>}
        {article.publishedAt && (
          <>
            {article.authorName && <span>·</span>}
            <span>{new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </>
        )}
      </div>

      {article.mainImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.mainImageUrl} alt={article.title} className="my-8 w-full rounded-xl object-cover" />
      )}

      <div className="text-gray-800 dark:text-gray-200">
        {renderPortableText(article.body)}
      </div>
    </article>
  )
}
