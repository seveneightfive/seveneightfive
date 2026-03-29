import { createClient } from '../../../lib/supabaseServer'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

type Neighborhood = {
  id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  image_url: string | null
  published: boolean
}

type Venue = {
  id: string
  name: string
  slug: string | null
  description: string | null
  image_url: string | null
  logo: string | null
  venue_type: string | null
  address: string | null
}

type GalleryImage = {
  image_url: string
  caption: string | null
  display_order: number | null
}

const venueTypeBadge = (type: string) => {
  const map: Record<string, string> = {
    'Bar': 'bg-amber-100 text-amber-800',
    'Restaurant': 'bg-green-100 text-green-800',
    'Gallery': 'bg-purple-100 text-purple-800',
    'Music Venue': 'bg-rose-100 text-rose-800',
    'Theater': 'bg-blue-100 text-blue-800',
    'Brewery': 'bg-orange-100 text-orange-800',
    'Cafe': 'bg-teal-100 text-teal-800',
    'Shop': 'bg-zinc-100 text-zinc-700',
    'Museum': 'bg-indigo-100 text-indigo-700',
  }
  return map[type] || 'bg-zinc-100 text-zinc-700'
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createClient()
  const { data: hood } = await supabase
    .from('neighborhoods')
    .select('name, tagline, description, image_url')
    .eq('slug', slug)
    .single()

  if (!hood) return { title: 'Neighborhood | seveneightfive' }

  return {
    title: `${hood.name} | seveneightfive`,
    description: hood.tagline || hood.description || `Explore ${hood.name} in Topeka, KS.`,
    openGraph: {
      title: `${hood.name} | seveneightfive`,
      description: hood.tagline || '',
      images: hood.image_url ? [{ url: hood.image_url }] : [],
    },
  }
}

export default async function NeighborhoodDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = createClient()

  const { data: hood } = await supabase
    .from('neighborhoods')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (!hood) notFound()

  const neighborhood = hood as Neighborhood

  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, slug, description, image_url, logo, venue_type, address')
    .eq('neighborhood', neighborhood.name)
    .order('name', { ascending: true })

  const venueIds = (venues as Venue[] | null)?.map((v) => v.id) || []
  const today = new Date().toISOString().split('T')[0]

  const { data: upcomingEvents } = venueIds.length
    ? await supabase
        .from('events')
        .select('venue_id')
        .in('venue_id', venueIds)
        .gte('event_date', today)
    : { data: [] }

  const eventCountMap: Record<string, number> = {}
  ;(upcomingEvents as { venue_id: string }[] | null)?.forEach((e) => {
    if (e.venue_id) {
      eventCountMap[e.venue_id] = (eventCountMap[e.venue_id] || 0) + 1
    }
  })

  const { data: galleryImages } = await supabase
    .from('neighborhood_gallery_images')
    .select('image_url, caption, display_order')
    .eq('neighborhood_id', neighborhood.id)
    .order('display_order')

  const gallery = (galleryImages as GalleryImage[] | null) || []

  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative h-[70vh] min-h-[480px] max-h-[700px] bg-zinc-950 overflow-hidden">
        {neighborhood.image_url && (
          <Image
            src={neighborhood.image_url}
            alt={neighborhood.name}
            fill
            priority
            className="object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

        <div className="absolute top-6 left-6 z-10">
          <Link
            href="/neighborhoods"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            All Neighborhoods
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-14">
          <h1 className="text-5xl md:text-7xl font-black uppercase text-white leading-none tracking-tight drop-shadow-md">
            {neighborhood.name}
          </h1>
          {neighborhood.tagline && (
            <p className="mt-3 text-white/80 text-lg md:text-xl max-w-2xl leading-relaxed">
              {neighborhood.tagline}
            </p>
          )}
        </div>
      </section>

      {/* ── DESCRIPTION ──────────────────────────────────── */}
      {neighborhood.description && (
        <section className="max-w-3xl mx-auto px-6 py-14 md:py-20">
          <p className="text-zinc-600 text-lg md:text-xl leading-relaxed">
            {neighborhood.description}
          </p>
        </section>
      )}

      {/* ── GALLERY ──────────────────────────────────────── */}
      {gallery.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
            {gallery.map((img, i) => (
              <div key={i} className="break-inside-avoid relative overflow-hidden rounded-lg bg-zinc-100">
                <Image
                  src={img.image_url}
                  alt={img.caption || `${neighborhood.name} photo ${i + 1}`}
                  width={600}
                  height={400}
                  className="w-full h-auto object-cover"
                />
                {img.caption && (
                  <p className="text-xs text-zinc-500 px-2 py-1.5 leading-snug">{img.caption}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── VENUES / EXPERIENCE SECTION ──────────────────── */}
      <section className="bg-zinc-50 border-t border-zinc-100 pb-20">
        <div className="max-w-6xl mx-auto px-6">

          <div className="py-12 border-b border-zinc-200 mb-10">
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-zinc-950">
              Experience {neighborhood.name}
            </h2>
            {venues && venues.length > 0 && (
              <p className="mt-2 text-zinc-500 text-base">
                {venues.length} venue{venues.length !== 1 ? 's' : ''} in this neighborhood
              </p>
            )}
          </div>

          {venues && venues.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(venues as Venue[]).map((venue) => {
                const eventCount = eventCountMap[venue.id] || 0
                const imgSrc = venue.image_url || venue.logo || null

                return (
                  <Link
                    key={venue.id}
                    href={`/venues/${venue.slug}`}
                    className="group bg-white border border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-400 hover:shadow-lg transition-all duration-300 flex flex-col"
                  >
                    <div className="relative h-44 bg-zinc-100 overflow-hidden">
                      {imgSrc ? (
                        <Image
                          src={imgSrc}
                          alt={venue.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-200">
                          <svg className="w-8 h-8 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                        </div>
                      )}
                      {eventCount > 0 && (
                        <div className="absolute top-3 left-3 bg-[#FFCE03] text-black text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          {eventCount} upcoming {eventCount === 1 ? 'event' : 'events'}
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                      {venue.venue_type && (
                        <span className={`self-start text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2 ${venueTypeBadge(venue.venue_type)}`}>
                          {venue.venue_type}
                        </span>
                      )}
                      <h3 className="font-black text-base uppercase tracking-tight text-zinc-950 group-hover:text-[#FFCE03] transition-colors leading-tight mb-1">
                        {venue.name}
                      </h3>
                      {venue.address && (
                        <p className="text-xs text-zinc-400 flex items-center gap-1 mb-2">
                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                          {venue.address}
                        </p>
                      )}
                      {venue.description && (
                        <p className="text-sm text-zinc-500 leading-relaxed line-clamp-2 flex-1">
                          {venue.description}
                        </p>
                      )}
                      <div className="mt-4 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-zinc-400 group-hover:text-zinc-700 transition-colors">
                        View venue →
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-20 text-zinc-400">
              <svg className="w-10 h-10 mx-auto mb-4 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <p className="text-lg font-medium">No venues listed yet for {neighborhood.name}.</p>
              <p className="text-sm mt-1">Check back soon — this neighborhood is growing.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER CTA ───────────────────────────────────── */}
      <section className="bg-zinc-950 text-white py-16 px-6 text-center">
        <p className="text-[#FFCE03] text-xs font-bold tracking-[0.2em] uppercase mb-3">Explore More</p>
        <h3 className="text-3xl font-black uppercase tracking-tight mb-6">
          Discover All of Topeka
        </h3>
        <Link
          href="/neighborhoods"
          className="inline-flex items-center gap-2 bg-[#FFCE03] text-black font-bold text-sm uppercase tracking-widest px-6 py-3 rounded-full hover:bg-[#e6b800] transition-colors"
        >
          All Neighborhoods
        </Link>
      </section>

    </div>
  )
}
