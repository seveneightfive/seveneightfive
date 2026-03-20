import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ArtistPageClient from './ArtistPageClient'

// ─── Types ───────────────────────────────────────────────────────────────────

type MusicianProfile = {
  musical_genres: string[] | null
  audio_file_url: string | null
  audio_title: string | null
  video_url: string | null
  video_title: string | null
  artistvideoabout: string | null
  artist_spotify: string | null
  artist_youtube: string | null
  purchase_link: string | null
  bio_written_by_785: boolean | null
}

type VisualProfile = {
  visual_mediums: string[] | null
  works: string | null
}

type Artist = {
  id: string
  name: string
  slug: string
  bio: string | null
  tagline: string | null
  image_url: string | null
  avatar_url: string | null
  artist_type: string | null
  verified: boolean
  location_city: string | null
  location_state: string | null
  birth_place: string | null
  awards: string | null
  artist_website: string | null
  social_facebook: string | null
  artist_email: string | null
  given_name: string | null
  family_name: string | null
  url: string | null
  same_as: string[] | null
  musician_profile: MusicianProfile | null
  visual_profile: VisualProfile | null
  bio_written_by_785: boolean | null
}

type Event = {
  id: string
  slug: string | null
  title: string
  event_date: string | null
  event_start_time: string | null
  ticket_url: string | null
  image_url: string | null
  ticket_price: number | null
  venue: { name: string; neighborhood: string | null } | null
}

type PortfolioImage = {
  id: string
  image_url: string
  caption: string | null
  display_order: number
}

// ─── SEO ─────────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const artist = await getArtist(slug)
  if (!artist) return { title: 'Artist Not Found' }
  const description = artist.bio || artist.tagline || `${artist.name} — Kansas artist on The 785`
  const image = artist.image_url || artist.avatar_url
  return {
    title: `${artist.name} | The 785`,
    description,
    openGraph: { title: artist.name, description, images: image ? [{ url: image }] : [], type: 'profile' },
    twitter: { card: 'summary_large_image', title: artist.name, description, images: image ? [image] : [] },
  }
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getArtist(slug: string): Promise<Artist | null> {
  const { data, error } = await supabase
    .from('artists')
    .select(`
      id, name, slug, bio, tagline, bio_written_by_785, image_url, avatar_url,
      artist_type, verified, location_city, location_state,
      birth_place, awards, artist_website, social_facebook,
      artist_email, given_name, family_name, url, same_as,
      artist_musician_profiles (
        musical_genres, audio_file_url, audio_title,
        video_url, video_title, artistvideoabout,
        artist_spotify, artist_youtube, purchase_link
      ),
      artist_visual_profiles (visual_mediums, works)
    `)
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (error || !data) return null
  return {
    ...data,
    musician_profile: Array.isArray(data.artist_musician_profiles)
      ? data.artist_musician_profiles[0] || null
      : (data.artist_musician_profiles as any) || null,
    visual_profile: Array.isArray(data.artist_visual_profiles)
      ? data.artist_visual_profiles[0] || null
      : (data.artist_visual_profiles as any) || null,
  } as Artist
}

async function getArtistEvents(artistId: string): Promise<Event[]> {
  const { data: links } = await supabase
    .from('event_artists')
    .select('event_id')
    .eq('artist_id', artistId)

  if (!links || links.length === 0) return []

  const eventIds = links.map((l: any) => l.event_id)

  const { data } = await supabase
    .from('events')
    .select(`
      id, slug, title, event_date, event_start_time, ticket_url, image_url, ticket_price,
      venue:venues (name, neighborhood)
    `)
    .in('id', eventIds)
    .order('event_date', { ascending: true })
    .limit(10)

  return (data || []).map((e: any) => ({
    ...e,
    venue: Array.isArray(e.venue) ? (e.venue[0] ?? null) : e.venue,
  })) as Event[]
}

async function getPortfolioImages(artistId: string): Promise<PortfolioImage[]> {
  const { data } = await supabase
    .from('artist_portfolio_images')
    .select('id, image_url, caption, display_order')
    .eq('artist_id', artistId)
    .order('display_order', { ascending: true })
  return (data || []) as PortfolioImage[]
}

function getJsonLd(artist: Artist) {
  const genres = [...(artist.musician_profile?.musical_genres || []), ...(artist.visual_profile?.visual_mediums || [])]
  return {
    '@context': 'https://schema.org',
    '@type': artist.artist_type === 'Musician' ? 'MusicGroup' : 'Person',
    name: artist.name,
    description: artist.bio || artist.tagline,
    image: artist.image_url || artist.avatar_url,
    url: artist.url || artist.artist_website,
    sameAs: artist.same_as || [],
    ...(genres.length > 0 && { genre: genres }),
    ...(artist.location_city && { homeLocation: { '@type': 'Place', addressLocality: artist.location_city, addressRegion: artist.location_state } }),
    ...(artist.awards && { award: artist.awards }),
  }
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})/)
  return match ? match[1] : null
}

function getSocialLinks(artist: Artist) {
  const links: { label: string; url: string; icon: string; color: string }[] = []
  const mp = artist.musician_profile
  if (artist.artist_website) links.push({ label: 'Website', url: artist.artist_website, icon: '🌐', color: '#1a1814' })
  if (mp?.artist_spotify) links.push({ label: 'Spotify', url: mp.artist_spotify, icon: '♫', color: '#1DB954' })
  if (mp?.artist_youtube) links.push({ label: 'YouTube', url: mp.artist_youtube, icon: '▶', color: '#FF0000' })
  if (artist.social_facebook) links.push({ label: 'Facebook', url: artist.social_facebook, icon: 'f', color: '#1877F2' })
  if (mp?.purchase_link) links.push({ label: 'Buy / Book', url: mp.purchase_link, icon: '🎟', color: '#C80650' })
  if (artist.artist_email) links.push({ label: 'Email', url: `mailto:${artist.artist_email}`, icon: '✉', color: '#6b6560' })
  artist.same_as?.forEach(url => {
    if (url.includes('soundcloud')) links.push({ label: 'SoundCloud', url, icon: '☁', color: '#FF5500' })
    if (url.includes('instagram')) links.push({ label: 'Instagram', url, icon: '◎', color: '#E1306C' })
    if (url.includes('apple')) links.push({ label: 'Apple Music', url, icon: '♪', color: '#FA243C' })
    if (url.includes('tiktok')) links.push({ label: 'TikTok', url, icon: '♩', color: '#010101' })
  })
  return links
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const artist = await getArtist(slug)
  if (!artist) notFound()

  const [events, portfolioImages] = await Promise.all([
    getArtistEvents(artist.id),
    getPortfolioImages(artist.id),
  ])

  const mp = artist.musician_profile
  const vp = artist.visual_profile
  const genres = [...(mp?.musical_genres || []), ...(vp?.visual_mediums || [])]
  const heroImage = artist.image_url || artist.avatar_url
  const socialLinks = getSocialLinks(artist)
  const videoId = mp?.video_url ? getYouTubeId(mp.video_url) : null
  const jsonLd = getJsonLd(artist)
  const hasMusic = !!(mp?.audio_file_url || mp?.video_url)
  const hasWork = !!(vp?.works) || portfolioImages.length > 0

  const TYPE_LABEL: Record<string, string> = {
    Musician: 'Musician', Visual: 'Visual Artist', Performance: 'Performer', Literary: 'Literary Artist',
  }

  const navItems = [
    { id: 'about', label: 'About', icon: '◉', show: true },
    { id: 'music', label: 'Music', icon: '♫', show: hasMusic },
    { id: 'work', label: 'Work', icon: '◈', show: hasWork },
    { id: 'events', label: 'Events', icon: '◷', show: true },
    { id: 'links', label: 'Links', icon: '↗', show: socialLinks.length > 0 },
  ].filter(n => n.show)

  return (
    <ArtistPageClient
      artist={artist}
      events={events}
      portfolioImages={portfolioImages}
      socialLinks={socialLinks}
      navItems={navItems}
      genres={genres}
      videoId={videoId}
      hasMusic={hasMusic}
      hasWork={hasWork}
      jsonLd={jsonLd}
    />
  )
}

