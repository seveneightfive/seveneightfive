import type { Metadata } from 'next'
import ArticlesClient from './ArticlesClient'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Articles | seveneightfive Magazine',
  description: 'Read stories about Topeka — local flavor, live music, art, and community from seveneightfive magazine.',
  alternates: {
    canonical: 'https://seveneightfive.com/articles',
  },
}

export type ArticleSummary = {
  _id: string
  title: string
  slug: string
  excerpt: string | null
  mainImageUrl: string | null
  publishedAt: string | null
  authorName: string | null
  categoryNames: string[]
  tagNames: string[]
}

const QUERY = `*[_type == "post" && status == "published"] | order(publishedAt desc){
  _id, title, "slug": slug.current, excerpt, publishedAt,
  "mainImageUrl": coalesce(mainImageUrl, mainImage.asset->url),
  "authorName": coalesce(authorName, author->name),
  "categoryNames": coalesce(categoryNames, categories[]->name, []),
  "tagNames": coalesce(tagNames, tags, [])
}`

// Data reality check: the imported `tags` field is a plain string array on
// 81 of 82 tagged posts, but at least one has a stray reference object in
// there instead (leftover from an inconsistent import batch). Rendering
// that object directly as a React child crashes the whole page — hence the
// `.filter(x => typeof x === 'string')` below. This is a general safety
// net (not a one-off patch for that single document): anything that isn't
// actually a string gets silently dropped rather than reaching JSX.
function sanitizeArticle(a: any): ArticleSummary {
  return {
    ...a,
    categoryNames: (a.categoryNames || []).filter((x: unknown) => typeof x === 'string'),
    tagNames: (a.tagNames || []).filter((x: unknown) => typeof x === 'string'),
  }
}

async function getArticles(): Promise<ArticleSummary[]> {
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || !process.env.NEXT_PUBLIC_SANITY_DATASET) {
    console.warn('[articles] Sanity env vars not set — showing empty list.')
    return []
  }
  try {
    const { client } = await import('@/lib/sanity')
    const raw = await client.fetch(QUERY)
    return (raw || []).map(sanitizeArticle)
  } catch (err) {
    console.error('[articles] Sanity fetch failed:', err)
    return []
  }
}

export default async function ArticlesPage() {
  const articles = await getArticles()
  return <ArticlesClient articles={articles} />
}
