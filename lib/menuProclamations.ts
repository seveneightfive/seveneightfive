// lib/menuProclamations.ts
//
// Latest "Menu Proclamations" (Local Flavor reviews) from Sanity — the same
// posts the Local Flavor page shows. Loaded dynamically and wrapped in
// try/catch, like app/local-flavor/page.tsx, so a missing Sanity env just
// means an empty list rather than a broken page.

export type MenuProclamation = {
  _id: string
  title: string
  slug: string | null
  excerpt: string | null
  mainImageUrl: string | null
  publishedAt: string | null
  authorName: string | null
}

const QUERY = (limit: number) => `*[_type == "post" && status == "published" && ("Local Flavor" in categories[]->name || "Local Flavor" in categoryNames)] | order(publishedAt desc) [0...${limit}]{
  _id, title, "slug": slug.current, excerpt, publishedAt,
  "mainImageUrl": coalesce(mainImageUrl, mainImage.asset->url),
  "authorName": coalesce(authorName, author->name)
}`

export async function getMenuProclamations(limit = 6): Promise<MenuProclamation[]> {
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || !process.env.NEXT_PUBLIC_SANITY_DATASET) return []
  try {
    const { client } = await import('@/lib/sanity')
    return (await client.fetch(QUERY(limit))) ?? []
  } catch (err) {
    console.error('[menuProclamations] Sanity fetch failed:', err)
    return []
  }
}
