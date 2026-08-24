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

// Same guard as /local-flavor and /[slug]: lib/sanity.js's createClient()
// throws at import time if the env vars aren't set, so this loads it
// dynamically inside a try/catch rather than as a static top-level import.
async function getArticles(): Promise<ArticleSummary[]> {
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || !process.env.NEXT_PUBLIC_SANITY_DATASET) {
    console.warn('[articles] Sanity env vars not set — showing empty list.')
    return []
  }
  try {
    const { client } = await import('@/lib/sanity')
    return await client.fetch(QUERY)
  } catch (err) {
    console.error('[articles] Sanity fetch failed:', err)
    return []
  }
}

export default async function ArticlesPage() {
  const articles = await getArticles()
  return <ArticlesClient articles={articles} />
}
