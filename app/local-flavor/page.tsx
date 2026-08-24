import type { Metadata } from 'next'
import { createClient } from '@/lib/supabaseServer'
import { client as sanityClient } from '@/lib/sanity'
import LocalFlavorClient from './LocalFlavorClient'

export const metadata: Metadata = {
  title: 'Local Flavor Topeka KS | Restaurants, Bars & Coffee | seveneightfive',
  description: 'Find where to eat and drink in Topeka, KS — locally-owned restaurants, bars, breweries, and coffee shops. The 785 is your guide to local flavor in Topeka.',
  keywords: ['restaurants topeka ks', 'topeka local flavor', 'where to eat topeka', 'topeka bars', 'topeka breweries', 'topeka coffee shops', 'kansas local restaurants'],
  openGraph: {
    title: 'Local Flavor Topeka KS | Restaurants, Bars & Coffee | seveneightfive',
    description: 'Find where to eat and drink in Topeka, KS — locally-owned restaurants, bars, breweries, and coffee shops.',
    images: [{ url: 'https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/hero-images/local-flavor-hero.jpg' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Local Flavor Topeka KS | seveneightfive',
    description: 'Find where to eat and drink in Topeka, KS — locally-owned restaurants, bars, breweries, and coffee shops.',
    images: ['https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/hero-images/local-flavor-hero.jpg'],
  },
  alternates: {
    canonical: 'https://seveneightfive.com/local-flavor',
  },
}

const FOOD_VENUE_TYPES = ['Local Flavor', 'Bar/Tavern', 'Brewery / Winery', 'Coffee Shop', 'Catering']

const PROCLAMATIONS_QUERY = `*[_type == "post" && status == "published" && "Local Flavor" in categories[]->name] | order(publishedAt desc) [0...6]{
  _id, title, "slug": slug.current, excerpt, mainImageUrl, publishedAt,
  "authorName": author->name
}`

export default async function LocalFlavorPage() {
  const supabase = createClient()

  const [
    { data: venueData },
    { data: procData },
    proclamations,
  ] = await Promise.all([
    supabase
      .from('venues')
      .select('id, name, slug, description, address, neighborhood, image_url, logo, venue_type, tags, blkowned, womenowned, lgbtq')
      .overlaps('venue_type', FOOD_VENUE_TYPES)
      .eq('status', 'active')
      .order('name'),

    supabase
      .from('menu_procs')
      .select(`
        id, title, content, images, created_at,
        venues (id, name, slug),
        profiles (id, username, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false })
      .limit(12),

    sanityClient.fetch(PROCLAMATIONS_QUERY).catch((err: unknown) => {
      console.error('[local-flavor] Sanity fetch failed:', err)
      return []
    }),
  ])

  const venues = (venueData || []).map((v: any) => ({
    ...v,
    tags: v.tags || [],
  }))

  const communityPhotos = (procData || [])
    .filter((p: any) => Array.isArray(p.images) && p.images.length > 0)
    .map((p: any) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      image: p.images[0],
      createdAt: p.created_at,
      venue: Array.isArray(p.venues) ? p.venues[0] || null : p.venues || null,
      submitter: Array.isArray(p.profiles) ? p.profiles[0] || null : p.profiles || null,
    }))

  return (
    <LocalFlavorClient
      venues={venues}
      communityPhotos={communityPhotos}
      proclamations={proclamations || []}
    />
  )
}
