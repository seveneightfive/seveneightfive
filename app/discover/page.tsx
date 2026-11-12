// app/discover/page.tsx
//
// Discover — the front door to everything you browse by place or person:
// Artist Directory (featured), the current sponsored ad, Browse the city
// cards with live counts, Opportunities & Announcements (each opens a
// popup), Local Flavor (open-now band + Menu Proclamations), and
// neighborhood shortcuts.
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseServer'
import AdvertisementBanner from '../components/AdvertisementBanner'
import OpportunityBoard, { type BoardItem } from './OpportunityBoard'
import { DISCOVER_SECTIONS, FOOD_VENUE_TYPES, type DiscoverSectionKey } from '@/lib/discover'
import { isOpenNow, chicagoMinuteOfWeek, type VenueHours } from '@/lib/openNow'
import { getMenuProclamations } from '@/lib/menuProclamations'

// Counts and "open now" refresh every 15 minutes
export const revalidate = 900

export const metadata: Metadata = {
  title: 'Discover Topeka | Artists, Local Flavor, Galleries & Venues | seveneightfive',
  description:
    'Explore seveneightfive — Topeka artists, locally owned restaurants and bars, art galleries, First Friday ArtWalk, live music, venues and neighborhoods.',
  alternates: { canonical: 'https://www.seveneightfive.com/discover' },
}

type VenueRow = {
  id: string
  neighborhood: string | null
  venue_type: string[] | null
  hours: VenueHours
}

const has = (v: VenueRow, types: string[]) => !!v.venue_type?.some(t => types.includes(t))

function chicagoToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function addDays(ymd: string, n: number) {
  const d = new Date(ymd + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function nextFirstFriday(today: string) {
  const first = (y: number, m: number) => {
    const d = new Date(Date.UTC(y, m - 1, 1))
    const offset = (5 - d.getUTCDay() + 7) % 7
    return new Date(Date.UTC(y, m - 1, 1 + offset)).toISOString().slice(0, 10)
  }
  const [y, m] = today.split('-').map(Number)
  const thisMonth = first(y, m)
  return thisMonth >= today ? thisMonth : m === 12 ? first(y + 1, 1) : first(y, m + 1)
}

const fmtDate = (ymd: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  new Date(ymd.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', opts)

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

// Same deterministic daily pick used on the home page archive rail
function seededIndex(seed: number, max: number) {
  const x = Math.sin(seed) * 10000
  return Math.floor((x - Math.floor(x)) * max)
}

const OPP_COLORS: Record<string, { tint: string; ink: string }> = {
  job: { tint: '#E6F4F1', ink: '#0F5E57' },
  volunteer: { tint: '#F1ECFB', ink: '#5B21B6' },
  'casting-call': { tint: '#FBEAF0', ink: '#A8053F' },
  grant: { tint: '#FFF4C2', ink: '#6B5300' },
  collaboration: { tint: '#E8EEF8', ink: '#1D4ED8' },
}

export default async function DiscoverPage() {
  const supabase = createClient()
  const today = chicagoToday()

  const [
    { count: artistCount },
    { data: artistPool },
    { data: venuesRaw },
    { count: liveMusicCount },
    { data: oppsRaw },
    { data: announcementsRaw },
    { data: hoodsRaw },
    proclamations,
  ] = await Promise.all([
    supabase.from('artists').select('id', { count: 'exact', head: true }).eq('published', true),
    supabase
      .from('artists')
      .select('id, name, slug, image_url, avatar_url, artist_type')
      .eq('published', true)
      .eq('verified', true)
      .not('image_url', 'is', null)
      .order('name')
      .limit(60),
    supabase.from('venues').select('id, neighborhood, venue_type, hours').eq('status', 'active'),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .contains('event_types', ['Live Music'])
      .gte('event_date', today)
      .lte('event_date', addDays(today, 6)),
    supabase
      .from('opportunities_listing')
      .select('id, slug, title, excerpt, type_slug, type_label, compensation_label, compensation_details, location_display, application_url, application_email, deadline_date, deadline_status, organization_name, is_featured, og_image')
      .or('deadline_status.is.null,deadline_status.neq.closed')
      .order('is_featured', { ascending: false })
      .order('deadline_date', { ascending: true, nullsFirst: false })
      .limit(4),
    supabase
      .from('announcements')
      .select('id, title, content, learnmore_link, expires_at, created_at, priority')
      .eq('active', true)
      .or(`expires_at.is.null,expires_at.gt."${new Date().toISOString()}"`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3),
    supabase.from('neighborhoods').select('slug, name').order('name'),
    getMenuProclamations(6),
  ])

  // ── Venue-based counts (one query, counted here) ────────────────────────
  const venues = (venuesRaw ?? []) as VenueRow[]
  const notoIds = venues.filter(v => v.neighborhood === 'NOTO').map(v => v.id)
  const food = venues.filter(v => has(v, FOOD_VENUE_TYPES))
  const minuteOfWeek = chicagoMinuteOfWeek()
  const openNowCount = food.filter(v => isOpenNow(v.hours, minuteOfWeek) === true).length
  const galleryCount = venues.filter(v => has(v, ['Gallery / Museum'])).length
  const pubCount = venues.filter(v => has(v, ['Bar/Tavern'])).length
  const ffStops = venues.filter(v => has(v, ['First Friday ArtWalk'])).length

  const { count: notoEventCount } = notoIds.length
    ? await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .in('venue_id', notoIds)
        .gte('event_date', today)
    : { count: 0 }

  // Opportunity descriptions live on the base table, not the listing view
  const oppIds = (oppsRaw ?? []).map(o => o.id)
  const { data: oppBodies } = oppIds.length
    ? await supabase.from('opportunities').select('id, description').in('id', oppIds)
    : { data: [] as { id: string; description: string | null }[] }
  const bodyById = new Map((oppBodies ?? []).map(o => [o.id, o.description]))

  // ── Featured artist (changes daily) ─────────────────────────────────────
  const pool = artistPool ?? []
  const day = Math.floor(Date.parse(today + 'T00:00:00Z') / 86_400_000)
  const featuredArtist = pool.length ? pool[seededIndex(day, pool.length)] : null
  const featuredImage = featuredArtist?.image_url ?? featuredArtist?.avatar_url ?? null

  // ── Browse the city ─────────────────────────────────────────────────────
  const ff = nextFirstFriday(today)
  const ffWhen = ff === today ? 'Tonight' : `Next: ${fmtDate(ff, { weekday: 'short', month: 'short', day: 'numeric' })}`
  const countFor: Partial<Record<DiscoverSectionKey, string>> = {
    'local-flavor': plural(food.length, 'spot'),
    galleries: plural(galleryCount, 'gallery', 'galleries'),
    pubs: plural(pubCount, 'bar'),
    'first-friday': ffStops ? `${ffWhen} · ${plural(ffStops, 'stop')}` : ffWhen,
    venues: plural(venues.length, 'venue'),
    'live-music': plural(liveMusicCount ?? 0, 'show') + ' this week',
  }
  const cityKeys: DiscoverSectionKey[] = ['local-flavor', 'galleries', 'pubs', 'first-friday', 'venues', 'live-music']
  const citySections = cityKeys.map(k => DISCOVER_SECTIONS.find(s => s.key === k)!).filter(Boolean)

  // ── Opportunities & Announcements ───────────────────────────────────────
  const announcementItems: BoardItem[] = (announcementsRaw ?? []).map(a => {
    const link = a.learnmore_link as string | null
    const external = !!link && /^https?:\/\//.test(link) && !/seveneightfive\.com/.test(link)
    return {
      id: `a-${a.id}`,
      kind: 'announcement',
      typeLabel: 'Announcement',
      tint: '#FFCE03',
      ink: '#0A0A0A',
      title: a.title,
      org: null,
      meta: `Posted ${fmtDate(a.created_at)}`,
      body: a.content,
      details: a.expires_at ? [{ label: 'Through', value: fmtDate(a.expires_at, { weekday: 'short', month: 'short', day: 'numeric' }) }] : [],
      image: null,
      cta: link ? { label: 'Learn more', href: link, external } : null,
    }
  })

  const opportunityItems: BoardItem[] = (oppsRaw ?? []).map(o => {
    const colors = OPP_COLORS[o.type_slug ?? ''] ?? { tint: '#F1EEE8', ink: '#3F3F46' }
    const deadline = o.deadline_status === 'rolling' || !o.deadline_date ? 'Rolling' : fmtDate(o.deadline_date, { weekday: 'short', month: 'short', day: 'numeric' })
    const compensation = [o.compensation_label, o.compensation_details].filter(Boolean).join(' — ')
    const cta = o.application_url
      ? { label: 'More info & apply', href: o.application_url as string, external: true }
      : o.application_email
        ? { label: 'Email to apply', href: `mailto:${o.application_email}`, external: false }
        : null
    return {
      id: `o-${o.id}`,
      kind: 'opportunity',
      typeLabel: o.type_label ?? 'Opportunity',
      tint: colors.tint,
      ink: colors.ink,
      title: o.title,
      org: o.organization_name,
      meta: [o.organization_name, deadline === 'Rolling' ? 'Rolling deadline' : `Deadline ${deadline}`].filter(Boolean).join(' · '),
      body: bodyById.get(o.id) || o.excerpt,
      details: [
        { label: 'Deadline', value: deadline },
        ...(o.location_display ? [{ label: 'Location', value: o.location_display as string }] : []),
        ...(compensation ? [{ label: 'Compensation', value: compensation }] : []),
      ],
      image: o.og_image,
      cta,
    }
  })

  const boardItems = [...announcementItems, ...opportunityItems].slice(0, 6)

  // NOTO and Downtown first, then the rest alphabetically
  const hoods = [...(hoodsRaw ?? [])].sort((a, b) => {
    const rank = (s: string) => (s === 'noto' ? 0 : s === 'downtown' ? 1 : 2)
    return rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name)
  })

  return (
    <main className="min-h-screen bg-[#F4F2ED] text-[#0A0A0A]">
      {/* ── Hero ── */}
      <section className="bg-[#0A0A0A] text-white">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-5 px-5 pb-6 pt-7 lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:px-10 lg:pb-14 lg:pt-14">
          <div>
            <div className="font-['Oswald'] text-[13px] font-semibold uppercase tracking-[0.16em] text-[#FFCE03] lg:text-sm">Discover</div>
            <h1 className="mt-1.5 font-['Oswald'] text-[40px] font-bold uppercase leading-[0.95] lg:mt-2 lg:text-[68px]">
              Explore
              <br />
              seveneightfive
            </h1>
            <p className="mt-2.5 max-w-[460px] text-[15px] leading-relaxed text-white/75 lg:mt-4 lg:text-[17px]">
              Places to eat, people who make things and the rooms where it all happens.
            </p>
          </div>

          <div className="lg:w-[440px]">
            <form action="/discover/search" role="search">
              <label className="flex h-12 items-center gap-2.5 rounded-xl bg-white px-3.5 text-neutral-500 lg:h-[54px] lg:px-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
                </svg>
                <span className="sr-only">Search places and artists</span>
                <input
                  type="search"
                  name="q"
                  placeholder="Search places and artists"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-black outline-none placeholder:text-neutral-500 lg:text-base"
                />
              </label>
            </form>
            <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                { label: 'Open now', href: '/discover/search?open=1' },
                { label: 'Artists', href: '/artists' },
                { label: 'First Friday ArtWalk', href: '/events/first-friday-artwalk' },
                { label: 'Galleries', href: '/topeka-art-galleries' },
              ].map(c => (
                <Link
                  key={c.label}
                  href={c.href}
                  className="shrink-0 whitespace-nowrap rounded-full border border-white/30 px-3 py-2 text-[13px] font-semibold text-white transition hover:border-white hover:bg-white/10"
                >
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1360px] flex-col gap-7 px-5 pb-10 pt-5 lg:gap-12 lg:px-10 lg:pb-16 lg:pt-10">
        {/* ── Artist Directory (lead) ── */}
        <Link
          href="/artists"
          className="group flex flex-col overflow-hidden rounded-[18px] bg-[#FFCE03] text-[#0A0A0A] lg:flex-row"
        >
          <div className="relative h-[150px] shrink-0 bg-[#2B3A55] lg:h-auto lg:min-h-[280px] lg:w-[46%]">
            {featuredImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featuredImage} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
            )}
            <span className="absolute left-3.5 top-3.5 bg-[#C80650] px-2.5 py-1.5 font-['Oswald'] text-xs font-bold uppercase tracking-[0.12em] text-white shadow-[4px_4px_0_#FFCE03]">
              Featured
            </span>
            {featuredArtist && (
              <span className="absolute bottom-2.5 right-3.5 rounded bg-black/55 px-2 py-0.5 text-[11px] text-white">
                {featuredArtist.name}
              </span>
            )}
          </div>
          <div className="flex flex-col justify-center p-[18px] lg:p-10">
            <div className="font-['Oswald'] text-[34px] font-bold uppercase leading-none lg:text-5xl">Artist Directory</div>
            <p className="mt-2 text-[15px] leading-snug lg:mt-3 lg:max-w-md lg:text-lg">
              Musicians, painters, makers and performers from the 785
              {artistCount ? ` — ${artistCount} artists and counting.` : '.'}
            </p>
            <span className="mt-3.5 inline-flex h-[42px] items-center gap-2.5 self-start rounded-[10px] border-2 border-[#0A0A0A] px-4 font-['Oswald'] text-sm font-bold uppercase tracking-[0.12em] transition group-hover:bg-[#0A0A0A] group-hover:text-[#FFCE03]">
              Meet the artists
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
          </div>
        </Link>

        {/* ── Sponsored (renders nothing when no ad is active) ── */}
        <AdvertisementBanner />

        {/* ── Browse the city ── */}
        <section aria-labelledby="city-heading">
          <h2 id="city-heading" className="mb-3 font-['Oswald'] text-2xl font-bold uppercase leading-none lg:mb-4 lg:text-[28px]">
            Browse the city
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Link
              href="/venues?neighborhood=NOTO"
              className="group col-span-2 flex h-[150px] flex-col justify-end bg-[linear-gradient(135deg,#7A1A3A_0%,#4E0E26_55%,#1A1014_100%)] px-5 py-[18px] text-white"
            >
              <span className="font-['Oswald'] text-[11px] font-medium uppercase tracking-[2px] text-[#FFCE03]">Most active</span>
              <span className="font-['Oswald'] text-[32px] font-bold uppercase leading-none group-hover:underline">NOTO Arts District</span>
              <span className="mt-1 text-[13px] font-light text-white/75">
                {plural(notoIds.length, 'venue')}
                {notoEventCount ? ` · ${plural(notoEventCount, 'upcoming event')}` : ''}
              </span>
            </Link>
            {citySections.map(s => (
              <Link
                key={s.key}
                href={s.href}
                style={{ background: s.bg }}
                className="group flex h-[130px] flex-col justify-end px-4 py-3.5 text-white lg:h-[150px]"
              >
                <span className="font-['Oswald'] text-[11px] font-medium uppercase tracking-[2px] text-[#FFCE03]">{s.label}</span>
                <span className="font-['Oswald'] text-[22px] font-bold uppercase leading-none group-hover:underline">{s.name}</span>
                <span className="mt-1 text-[13px] font-light text-white/80">{countFor[s.key]}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Opportunities & Announcements (each opens a popup) ── */}
        <OpportunityBoard items={boardItems} />

        {/* ── Local Flavor ── */}
        <section aria-labelledby="lf-heading">
          <div className="mb-3 flex items-end justify-between lg:mb-4">
            <h2 id="lf-heading" className="font-['Oswald'] text-2xl font-bold uppercase leading-none lg:text-[28px]">Local Flavor</h2>
            <Link href="/local-flavor" className="font-['Oswald'] text-[13px] font-semibold uppercase tracking-[0.1em] text-[#C80650] hover:underline">
              All →
            </Link>
          </div>

          <Link
            href="/local-flavor"
            className="group mb-3.5 flex items-center justify-between gap-3.5 rounded-[14px] bg-[linear-gradient(135deg,#0F4C3A_0%,#1E6B52_100%)] p-[18px] text-white lg:px-7 lg:py-6"
          >
            <span className="min-w-0">
              <span className="block font-['Oswald'] text-[11px] font-medium uppercase tracking-[2px] text-[#FFCE03]">Eat &amp; Drink</span>
              <span className="mt-0.5 block font-['Oswald'] text-[22px] font-bold uppercase leading-[1.05] lg:text-[30px]">What&rsquo;s for dinner?</span>
              <span className="mt-1.5 flex items-center gap-1.5 text-[13px] text-white/85 lg:text-sm">
                {openNowCount > 0 && <span className="h-2 w-2 rounded-full bg-[#FFCE03]" aria-hidden="true" />}
                {openNowCount > 0 ? `${openNowCount} open now · ${plural(food.length, 'spot')}` : plural(food.length, 'spot')}
              </span>
            </span>
            <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] bg-[#FFCE03] px-3.5 font-['Oswald'] text-[13px] font-bold uppercase tracking-[0.1em] text-[#0A0A0A] transition group-hover:bg-white">
              Where to eat
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
          </Link>

          {proclamations.length > 0 && (
            <div className="-mr-5 flex snap-x gap-3 overflow-x-auto pb-1 pr-5 [scrollbar-width:none] lg:mr-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pr-0 [&::-webkit-scrollbar]:hidden">
              {proclamations.map(p => (
                <Link
                  key={p._id}
                  href={p.slug ? `/${p.slug}` : '/local-flavor'}
                  className="group w-[240px] shrink-0 snap-start overflow-hidden rounded-[14px] border border-[#E6E3DC] bg-white lg:w-auto"
                >
                  <span className="relative block h-[120px] bg-[#1F2E4A] lg:h-[180px]">
                    {p.mainImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.mainImageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="block px-3.5 pb-3.5 pt-3">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#C80650]">Menu Proclamation</span>
                    <span className="mt-1 block font-['Oswald'] text-lg font-bold uppercase leading-tight group-hover:underline">{p.title}</span>
                    {p.excerpt && <span className="mt-1 line-clamp-2 block text-[13px] text-neutral-600">{p.excerpt}</span>}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── By neighborhood ── */}
        {hoods.length > 0 && (
          <section aria-labelledby="hood-heading">
            <h2 id="hood-heading" className="mb-3 font-['Oswald'] text-2xl font-bold uppercase leading-none lg:text-[28px]">By neighborhood</h2>
            <div className="flex flex-wrap gap-2">
              {hoods.map((h, i) => (
                <Link
                  key={h.slug}
                  href={`/neighborhoods/${h.slug}`}
                  className={`rounded-full px-3.5 py-2.5 text-sm font-semibold transition ${
                    i === 0
                      ? 'bg-[#0A0A0A] text-white hover:bg-[#C80650]'
                      : 'border border-[#E6E3DC] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]'
                  }`}
                >
                  {h.name === 'NOTO' ? 'NOTO Arts District' : h.name}
                </Link>
              ))}
              <Link href="/neighborhoods" className="rounded-full border border-[#E6E3DC] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0A0A0A] hover:border-[#0A0A0A]">
                All neighborhoods →
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
