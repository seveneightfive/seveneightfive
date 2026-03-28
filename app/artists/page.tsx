import type { Metadata } from 'next'
import { createClient } from '@/lib/supabaseServer'
import ArtistDirectory from './ArtistDirectory'

export const metadata: Metadata = {
  title: 'Artists in Topeka, KS | seveneightfive',
  description: 'Discover musicians, visual artists, performers, and literary artists in Topeka, Kansas.',
  openGraph: {
    title: 'Artists in Topeka, KS | seveneightfive',
    description: 'Discover musicians, visual artists, performers, and literary artists in Topeka, Kansas.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Artists in Topeka, KS | seveneightfive',
    description: 'Discover artists in Topeka, Kansas.',
  },
}

export default async function ArtistsPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: artistData },
    { data: eventCounts },
    { data: exData },
    { data: prodData },
    { data: oppData },
  ] = await Promise.all([
    supabase
      .from('artists')
      .select(`
        id, name, slug, bio, tagline, image_url, avatar_url,
        artist_type, verified, location_city, location_state,
        artist_musician_profiles (musical_genres),
        artist_visual_profiles (visual_mediums)
      `)
      .eq('published', true)
      .order('name'),

    supabase
      .from('event_artists')
      .select('artist_id, events!inner(event_date)')
      .gte('events.event_date', today),

    supabase
      .from('events')
      .select(`
        id, title, slug, image_url,
        exhibition_details!inner (
          closing_date, gallery_hours, admission, exhibition_type, artist_count, opening_reception
        ),
        venues (name)
      `)
      .contains('event_types', ['Exhibition'])
      .or(`closing_date.gte.${today},closing_date.is.null`, { foreignTable: 'exhibition_details' })
      .order('event_date', { ascending: false })
      .limit(6),

    supabase
      .from('events')
      .select(`
        id, title, slug, image_url, end_date,
        event_performances (performance_date, performance_time),
        venues (name)
      `)
      .eq('event_format', 'production')
      .gte('end_date', new Date().toISOString())
      .order('event_date', { ascending: false })
      .limit(4),

    supabase
      .from('opportunities')
      .select(`
        id, slug, title, excerpt, type_slug, compensation_slug,
        organization_name, deadline_date, is_featured,
        opportunity_types (label),
        compensation_types (label, is_paid)
      `)
      .eq('status', 'active')
      .eq('is_public', true)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Build upcoming event count map
  const countMap: Record<string, number> = {}
  ;(eventCounts || []).forEach((row: any) => {
    countMap[row.artist_id] = (countMap[row.artist_id] || 0) + 1
  })

  const artists = (artistData || []).map((a: any) => ({
    ...a,
    upcoming_event_count: countMap[a.id] || 0,
    musician_profile: Array.isArray(a.artist_musician_profiles)
      ? a.artist_musician_profiles[0] || null
      : a.artist_musician_profiles || null,
    visual_profile: Array.isArray(a.artist_visual_profiles)
      ? a.artist_visual_profiles[0] || null
      : a.artist_visual_profiles || null,
  }))

  const featured = artists
    .filter((a: any) => a.verified)
    .sort((a: any, b: any) => (b.upcoming_event_count ?? 0) - (a.upcoming_event_count ?? 0))
    .slice(0, 5)

  const exhibitions = (exData || []).map((e: any) => ({
    id: e.id,
    title: e.title,
    slug: e.slug,
    image_url: e.image_url,
    venue_name: e.venues?.name ?? null,
    closing_date: e.exhibition_details?.closing_date ?? null,
    gallery_hours: e.exhibition_details?.gallery_hours ?? null,
    admission: e.exhibition_details?.admission ?? null,
    exhibition_type: e.exhibition_details?.exhibition_type ?? null,
    artist_count: e.exhibition_details?.artist_count ?? null,
    opening_reception: e.exhibition_details?.opening_reception ?? false,
  }))

  const productions = (prodData || []).map((p: any) => {
    const upcoming = (p.event_performances || [])
      .filter((perf: any) => perf.performance_date >= today)
      .sort((a: any, b: any) => a.performance_date.localeCompare(b.performance_date))
    const next = upcoming[0]
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      image_url: p.image_url,
      venue_name: p.venues?.name ?? null,
      end_date: p.end_date ? p.end_date.split('T')[0] : null,
      next_performance_date: next?.performance_date ?? null,
      next_performance_time: next?.performance_time ?? null,
    }
  })

  const opportunities = (oppData || []).map((o: any) => ({
    id: o.id,
    slug: o.slug,
    title: o.title,
    excerpt: o.excerpt,
    type_slug: o.type_slug,
    type_label: o.opportunity_types?.label ?? o.type_slug,
    compensation_slug: o.compensation_slug,
    compensation_label: o.compensation_types?.label ?? null,
    is_paid: o.compensation_types?.is_paid ?? false,
    organization_name: o.organization_name,
    deadline_date: o.deadline_date,
  }))

  return (
    <ArtistDirectory
      initialData={{ artists, featured, exhibitions, productions, opportunities }}
    />
  )
}
