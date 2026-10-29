// app/discover/search/page.tsx
//
// Results for the Discover search box (?q=) and the "Open now" chip
// (?open=1). Kept on its own route so /discover itself stays cached.
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseServer'
import { FOOD_VENUE_TYPES } from '@/lib/discover'
import { isOpenNow, chicagoMinuteOfWeek, type VenueHours } from '@/lib/openNow'

export const metadata: Metadata = {
  title: 'Search Discover | seveneightfive',
  robots: { index: false },
}

type Venue = {
  id: string
  name: string
  slug: string | null
  neighborhood: string | null
  venue_type: string[] | null
  image_url: string | null
  hours?: VenueHours
}

type Artist = {
  id: string
  name: string
  slug: string | null
  artist_type: string | null
  avatar_url: string | null
  image_url: string | null
}

// Strip characters that have meaning in PostgREST filters
const clean = (q: string) => q.replace(/[%_,()*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)

export default async function DiscoverSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string }>
}) {
  const params = await searchParams
  const q = clean(params.q ?? '')
  const openOnly = params.open === '1'
  const supabase = createClient()

  let artists: Artist[] = []
  let venues: Venue[] = []

  if (openOnly) {
    const { data } = await supabase
      .from('venues')
      .select('id, name, slug, neighborhood, venue_type, image_url, hours')
      .eq('status', 'active')
      .overlaps('venue_type', FOOD_VENUE_TYPES)
      .order('name')
    const minute = chicagoMinuteOfWeek()
    venues = ((data ?? []) as Venue[]).filter(v => isOpenNow(v.hours, minute) === true)
  } else if (q) {
    const [a, v] = await Promise.all([
      supabase
        .from('artists')
        .select('id, name, slug, artist_type, avatar_url, image_url')
        .eq('published', true)
        .ilike('name', `%${q}%`)
        .order('name')
        .limit(12),
      supabase
        .from('venues')
        .select('id, name, slug, neighborhood, venue_type, image_url')
        .eq('status', 'active')
        .ilike('name', `%${q}%`)
        .order('name')
        .limit(12),
    ])
    artists = (a.data ?? []) as Artist[]
    venues = (v.data ?? []) as Venue[]
  }

  const heading = openOnly ? 'Open now' : q ? `Results for “${q}”` : 'Search'
  const total = artists.length + venues.length

  return (
    <main className="min-h-screen bg-[#F4F2ED] text-[#0A0A0A]">
      <section className="bg-[#0A0A0A] text-white">
        <div className="mx-auto max-w-[1360px] px-5 pb-6 pt-5 lg:px-10 lg:pb-10 lg:pt-8">
          <Link
            href="/discover"
            className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 pl-2 pr-3 font-['Oswald'] text-[13px] font-semibold uppercase tracking-[0.12em] hover:bg-white/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            Discover
          </Link>
          <h1 className="mt-4 font-['Oswald'] text-[34px] font-bold uppercase leading-none lg:text-5xl">{heading}</h1>
          {openOnly && (
            <p className="mt-2 text-[15px] text-white/75">Local Flavor spots open right now in Topeka.</p>
          )}
          <form action="/discover/search" role="search" className="mt-4 lg:max-w-[520px]">
            <label className="flex h-12 items-center gap-2.5 rounded-xl bg-white px-3.5 text-neutral-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <span className="sr-only">Search places and artists</span>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search places and artists"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-black outline-none placeholder:text-neutral-500"
              />
            </label>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-[1360px] px-5 py-6 lg:px-10 lg:py-10">
        {(openOnly || q) && total === 0 && (
          <p className="rounded-[14px] border-[1.5px] border-dashed border-[#D6D2C8] bg-white p-5 text-[15px] text-neutral-700">
            {openOnly ? 'Nothing we know of is open right now. ' : 'No places or artists match that. '}
            <Link href="/discover" className="font-semibold text-[#C80650] hover:underline">Back to Discover</Link>
          </p>
        )}

        {artists.length > 0 && (
          <ResultGroup title="Artists">
            {artists.map(a => (
              <ResultRow
                key={a.id}
                href={a.slug ? `/artists/${a.slug}` : '/artists'}
                image={a.avatar_url ?? a.image_url}
                title={a.name}
                meta={a.artist_type ?? 'Artist'}
                round
              />
            ))}
          </ResultGroup>
        )}

        {venues.length > 0 && (
          <ResultGroup title={openOnly ? `${venues.length} open now` : 'Places'}>
            {venues.map(v => (
              <ResultRow
                key={v.id}
                href={v.slug ? `/venues/${v.slug}` : '/venues'}
                image={v.image_url}
                title={v.name}
                meta={[v.venue_type?.[0], v.neighborhood].filter(Boolean).join(' · ')}
                badge={openOnly ? 'Open now' : undefined}
              />
            ))}
          </ResultGroup>
        )}
      </div>
    </main>
  )
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-['Oswald'] text-2xl font-bold uppercase leading-none">{title}</h2>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">{children}</ul>
    </section>
  )
}

function ResultRow({
  href, image, title, meta, badge, round = false,
}: {
  href: string
  image: string | null
  title: string
  meta: string
  badge?: string
  round?: boolean
}) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#E6E3DC] bg-white p-2.5 pr-3 transition hover:border-[#0A0A0A]">
        <span className={`relative h-14 w-14 shrink-0 overflow-hidden bg-[#1a1f2b] ${round ? 'rounded-full' : 'rounded-[10px]'}`}>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-['Oswald'] text-lg font-bold uppercase leading-tight">{title}</span>
          {meta && <span className="mt-0.5 block truncate text-[13px] text-neutral-600">{meta}</span>}
          {badge && (
            <span className="mt-1 inline-block rounded-md bg-[#E9F3EF] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#1E5A44]">{badge}</span>
          )}
        </span>
      </Link>
    </li>
  )
}
