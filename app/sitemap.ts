import { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'

const BASE_URL = 'https://www.seveneightfive.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [
    { data: events },
    { data: venues },
    { data: artists },
  ] = await Promise.all([
    supabase.from('events').select('slug, updated_at'),
    supabase.from('venues').select('slug, updated_at'),
    supabase.from('artists').select('slug, updated_at'),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                           lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/events`,               lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${BASE_URL}/live-music`,           lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE_URL}/venues`,               lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/artists`,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/topeka-art-galleries`, lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${BASE_URL}/neighborhoods`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/save-the-date`,        lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.6 },
  ]

  const eventRoutes: MetadataRoute.Sitemap = (events ?? [])
    .filter((e) => e.slug)
    .map((e) => ({
      url: `${BASE_URL}/events/${e.slug}`,
      lastModified: e.updated_at ? new Date(e.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  const venueRoutes: MetadataRoute.Sitemap = (venues ?? [])
    .filter((v) => v.slug)
    .map((v) => ({
      url: `${BASE_URL}/venues/${v.slug}`,
      lastModified: v.updated_at ? new Date(v.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

  const artistRoutes: MetadataRoute.Sitemap = (artists ?? [])
    .filter((a) => a.slug)
    .map((a) => ({
      url: `${BASE_URL}/artists/${a.slug}`,
      lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }))

  return [...staticRoutes, ...eventRoutes, ...venueRoutes, ...artistRoutes]
}
