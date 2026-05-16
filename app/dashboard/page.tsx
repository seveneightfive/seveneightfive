import { createClient } from '@/lib/supabaseServerAuth'
import type { Metadata } from 'next'
import StripeConnectButton from '@/app/components/StripeConnectButton'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveTheDate = {
  id: string
  title: string
  event_date: string
  organizer: string | null
  event_type: string | null
  location_name: string | null
}

export const metadata: Metadata = {
  title: '785 Magazine — Dashboard',
  description: 'Your 785 — tickets, pages, ads, and what to do tonight.',
}

export const dynamic = 'force-dynamic'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isGuest = !user

    // ── User data (logged-in only) ───────────────────────────────────────
    const [{ data: artists }, { data: venues }, { data: profile }] = user
      ? await Promise.all([
          supabase
            .from('artists')
            .select(
              'id, name, slug, tagline, image_url, avatar_url, artist_type, verified'
            )
            .eq('auth_user_id', user.id),
          supabase
            .from('venues')
            .select('id, name, slug, venue_type, image_url, logo')
            .eq('auth_user_id', user.id),
          supabase
            .from('profiles')
            .select(
              'full_name, email, phone_number, role, stripe_account_id, stripe_account_status, avatar_url'
            )
            .eq('id', user.id)
            .maybeSingle(),
        ])
      : [{ data: [] }, { data: [] }, { data: null }]

    const [{ data: venueUserLinks }, { data: artistUserLinks }] = user
      ? await Promise.all([
          supabase.from('venue_users').select('venue_id').eq('user_id', user.id),
          supabase.from('artist_users').select('artist_id').eq('user_id', user.id),
        ])
      : [{ data: [] }, { data: [] }]

    const extraVenueIds = (venueUserLinks || [])
      .map((r: any) => r.venue_id)
      .filter((id: string) => !(venues || []).some((v: any) => v.id === id))
    const extraArtistIds = (artistUserLinks || [])
      .map((r: any) => r.artist_id)
      .filter((id: string) => !(artists || []).some((a: any) => a.id === id))

    const [{ data: extraVenues }, { data: extraArtists }] = await Promise.all([
      extraVenueIds.length
        ? supabase
            .from('venues')
            .select('id, name, slug, venue_type, image_url, logo')
            .in('id', extraVenueIds)
        : Promise.resolve({ data: [] as any[] }),
      extraArtistIds.length
        ? supabase
            .from('artists')
            .select(
              'id, name, slug, tagline, image_url, avatar_url, artist_type, verified'
            )
            .in('id', extraArtistIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const allVenues = [...(venues || []), ...(extraVenues || [])]
    const allArtists = [...(artists || []), ...(extraArtists || [])]

    // ── Follows ──────────────────────────────────────────────────────────
    const { data: follows } = user
      ? await supabase
          .from('follows')
          .select('entity_type, entity_id')
          .eq('follower_id', user.id)
          .in('entity_type', ['artist', 'venue'])
      : { data: [] }

    const followedArtistIds = (follows || [])
      .filter((f: any) => f.entity_type === 'artist')
      .map((f: any) => f.entity_id)
    const followedVenueIds = (follows || [])
      .filter((f: any) => f.entity_type === 'venue')
      .map((f: any) => f.entity_id)

    const [
      { data: followedArtists },
      { data: followedVenues },
      { data: tickets },
      { data: ads },
    ] = await Promise.all([
      followedArtistIds.length
        ? supabase
            .from('artists')
            .select('id, name, slug, avatar_url, artist_type')
            .in('id', followedArtistIds)
        : Promise.resolve({ data: [] as any[] }),
      followedVenueIds.length
        ? supabase
            .from('venues')
            .select('id, name, slug, logo, image_url, venue_type')
            .in('id', followedVenueIds)
        : Promise.resolve({ data: [] as any[] }),
      user
        ? supabase
            .from('my_tickets')
            .select(
              'id, event_title, event_date, event_slug, tier_name, venue_name, status'
            )
            .eq('payment_status', 'paid')
            .gte('event_date', new Date().toISOString().slice(0, 10))
            .order('event_date', { ascending: true })
            .limit(1)
        : Promise.resolve({ data: [] as any[] }),
      user
        ? supabase
            .from('advertisements')
            .select('id, headline, title, status, views, clicks')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(2)
        : Promise.resolve({ data: [] as any[] }),
    ])

    // ── Save the Date — always public ────────────────────────────────────
    const { data: saveDates } = await supabase
      .from('save_the_date')
      .select('id, title, event_date, organizer, event_type, location_name')
      .eq('status', 'approved')
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .order('event_date', { ascending: true })
      .limit(4)

    // ── Derived ───────────────────────────────────────────────────────────
    const firstName = profile?.full_name?.split(' ')[0] || 'There'

    const allFollowed = [
      ...(followedArtists || []).map((a: any) => ({ ...a, kind: 'artist' })),
      ...(followedVenues || []).map((v: any) => ({ ...v, kind: 'venue' })),
    ]
    const allPages = [
      ...allArtists.map((a: any) => ({ ...a, kind: 'artist' })),
      ...allVenues.map((v: any) => ({ ...v, kind: 'venue' })),
    ]
    const firstPage = allPages[0] || null
    const nextTicket = (tickets || [])[0] || null
    const isCreator = allPages.length > 0

    const ticketMonth = nextTicket
      ? new Date(nextTicket.event_date + 'T12:00:00')
          .toLocaleString('en-US', { month: 'short' })
          .toUpperCase()
      : null
    const ticketDay = nextTicket
      ? new Date(nextTicket.event_date + 'T12:00:00').getDate()
      : null

    const TYPE_LABEL: Record<string, string> = {
      Musician: 'Musician',
      Visual: 'Visual Artist',
      Performance: 'Performer',
      Literary: 'Literary Artist',
    }

    const pageEditHref = firstPage
      ? firstPage.kind === 'artist'
        ? `/dashboard/edit?id=${firstPage.id}`
        : `/dashboard/venue?id=${firstPage.id}`
      : '/dashboard'

    // ─────────────────────────────────────────────────────────────────────
    // RENDER
    //
    // Shell (sidebar + header) is provided by app/dashboard/layout.tsx.
    // This page is just the content grid.
    // ─────────────────────────────────────────────────────────────────────

    return (
      <div className="space-y-6">
        {/* GREETING */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400 mb-1">
            Your 785
          </p>
          <h1 className="font-display text-3xl font-bold leading-none text-gray-900 dark:text-white mb-2">
            {isGuest ? 'Hey, Topeka' : `Hey, ${firstName}`}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isGuest
              ? 'Discover local artists, events, and venues — or add your own.'
              : 'What would you like to do today?'}
          </p>
        </div>

        {/* TICKET CTA — logged-in only */}
        {!isGuest && (
          <Link
            href="/dashboard/events/edit"
            className="flex items-center justify-between gap-5 rounded-2xl border border-gray-200 border-l-[3px] border-l-brand-600 bg-white p-5 transition hover:shadow-theme-md dark:border-gray-800 dark:border-l-brand-500 dark:bg-white/[0.03]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400 mb-1">
                Sellers
              </p>
              <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
                Create and sell tickets to an event
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Set up your event, add ticket tiers, and start taking payments —
                all in one place.
              </p>
            </div>
            <span className="shrink-0 rounded-md border border-brand-600/25 bg-brand-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
              Create →
            </span>
          </Link>
        )}

        {/* GRID */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* MY TICKETS — 4 cols */}
          <Link
            href={isGuest ? '/login' : '/dashboard/tickets'}
            className="col-span-12 sm:col-span-6 xl:col-span-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <CardLabel>Attending</CardLabel>
            <CardTitle>MY TICKETS</CardTitle>

            {isGuest ? (
              <GuestSlot>Sign in to purchase, sell, and view your tickets</GuestSlot>
            ) : (
              <>
                <CardDesc>Events you&apos;re going to</CardDesc>
                <Divider />
                {nextTicket ? (
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[28px] shrink-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                        {ticketMonth}
                      </div>
                      <div className="font-display text-2xl font-bold leading-none text-gray-900 dark:text-white">
                        {ticketDay}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {nextTicket.event_title}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {nextTicket.venue_name || 'Venue TBA'}
                      </div>
                    </div>
                    <Badge tone="success">Confirmed</Badge>
                  </div>
                ) : (
                  <EmptySlot>
  No upcoming tickets —{' '}
  <span className="text-brand-600 dark:text-brand-400">
    browse events
  </span>
</EmptySlot>
                )}
              </>
            )}
          </Link>

          {/* FOLLOWING — 8 cols */}
          <Link
            href={isGuest ? '/login' : '/dashboard/following'}
            className="col-span-12 xl:col-span-8 rounded-2xl border border-gray-200 bg-white p-5 transition hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <CardLabel>Artists &amp; Venues</CardLabel>
            <CardTitle>FOLLOWING</CardTitle>

            {isGuest ? (
              <GuestSlot>Sign in to follow artists and get updates</GuestSlot>
            ) : (
              <>
                <CardDesc>{allFollowed.length} followed</CardDesc>
                <Divider />
                {allFollowed.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {allFollowed.slice(0, 3).map((f: any) => (
                      <div key={f.id} className="flex items-center gap-3">
                        <Avatar kind={f.kind} name={f.name} src={f.avatar_url || f.logo || f.image_url} />
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {f.name}
                          </div>
                          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                            {f.artist_type ||
                              (Array.isArray(f.venue_type)
                                ? f.venue_type[0]
                                : f.venue_type) ||
                              (f.kind === 'venue' ? 'Venue' : 'Artist')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySlot>
  Not following anyone yet —{' '}
  <span className="text-brand-600 dark:text-brand-400">
    discover artists
  </span>
</EmptySlot>
            )}
          </>
            )}
          </Link>

          {/* MY PAGES — 4 cols */}
          <Link
            href={isGuest ? '/login' : pageEditHref}
            className="col-span-12 sm:col-span-6 xl:col-span-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <CardLabel>Creator</CardLabel>
            <CardTitle>MY PAGES</CardTitle>

            {isGuest ? (
              <GuestSlot>Sign in to manage your artist and venue pages</GuestSlot>
            ) : (
              <>
                <CardDesc>Edit, events, announcements &amp; ticket sales</CardDesc>
                <Divider />
                {firstPage ? (
                  <div className="flex items-center gap-3">
                    <Avatar kind={firstPage.kind} name={firstPage.name} src={firstPage.avatar_url || firstPage.logo || firstPage.image_url} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {firstPage.name}
                      </div>
                      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                        {TYPE_LABEL[firstPage.artist_type] ||
                          (Array.isArray(firstPage.venue_type)
                            ? firstPage.venue_type[0]
                            : firstPage.venue_type) ||
                          (firstPage.kind === 'venue' ? 'Venue' : 'Artist')}
                      </div>
                    </div>
                    {!firstPage.tagline && <Badge tone="brand">No tagline</Badge>}
                  </div>
                ) : (
                  <EmptySlot>No pages yet — create one below</EmptySlot>
                )}
              </>
            )}
          </Link>

          {/* ADVERTISE — 4 cols */}
          <Link
            href={isGuest ? '/login' : '/dashboard/advertise'}
            className="col-span-12 sm:col-span-6 xl:col-span-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <CardLabel>Publisher &amp; Buyer</CardLabel>
            <CardTitle>ADVERTISE</CardTitle>

            {isGuest ? (
              <GuestSlot>Sign in to place and manage ads on seveneightfive.com</GuestSlot>
            ) : (
              <>
                <CardDesc>Manage your ad campaigns and view stats</CardDesc>
                <Divider />
                {(ads || []).length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {(ads || []).map((ad: any, i: number) => (
                      <div
                        key={ad.id}
                        className={i > 0 ? 'pt-2 border-t border-gray-100 dark:border-gray-800' : ''}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {ad.headline || ad.title || 'Untitled Ad'}
                          </div>
                          <Badge tone={ad.status === 'active' ? 'success' : 'gold'}>
                            {ad.status === 'active' ? 'Active' : 'Ended'}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {ad.views || 0} views · {ad.clicks || 0} clicks
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySlot>No ads yet</EmptySlot>
                )}
              </>
            )}
          </Link>

          {/* SETTINGS + NOTIFICATIONS — 4 cols */}
          <div className="col-span-12 sm:col-span-6 xl:col-span-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <CardLabel>Account</CardLabel>
            <CardTitle>SETTINGS + NOTIFICATIONS</CardTitle>

            {isGuest ? (
              <GuestSlot>Sign in to manage your account and notifications</GuestSlot>
            ) : (
              <>
                <Divider />
                {isCreator && (
                  <div className="mb-3">
                    <StripeConnectButton
                      accountStatus={profile?.stripe_account_status ?? null}
                      returnPath="/dashboard"
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                  <Link
                    href="/dashboard/settings"
                    className="hover:text-gray-900 dark:hover:text-white"
                  >
                    Edit Profile
                  </Link>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <Link
                    href="/dashboard/settings#notifications"
                    className="hover:text-gray-900 dark:hover:text-white"
                  >
                    Notifications
                  </Link>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <Link
                    href="/api/auth/signout"
                    className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    Sign Out
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* SAVE THE DATE — full width */}
          <Link
            href="/save-the-date"
            className="col-span-12 rounded-2xl border border-gray-200 bg-white p-5 transition hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <CardLabel>Community Calendar</CardLabel>
                <CardTitle>SAVE THE DATE</CardTitle>
                <CardDesc>
                  Claim your date before the details are finalized — no account
                  needed
                </CardDesc>
              </div>
              <span className="shrink-0 inline-flex items-center self-start rounded-lg bg-brand-600 px-4 py-2 font-display text-sm font-semibold tracking-wide text-white hover:bg-brand-700">
                + Claim a Date
              </span>
            </div>

            {(saveDates || []).length > 0 && (
              <>
                <Divider />
                <div className="flex flex-col gap-3">
                  {(saveDates as SaveTheDate[]).map((sd) => {
                    const d = new Date(sd.event_date + 'T12:00:00')
                    const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
                    const day = d.getDate()
                    return (
                      <div key={sd.id} className="flex items-center gap-3">
                        <div className="text-center min-w-[28px] shrink-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                            {mon}
                          </div>
                          <div className="font-display text-2xl font-bold leading-none text-gray-900 dark:text-white">
                            {day}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {sd.title}
                          </div>
                          {sd.location_name && (
                            <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                              {sd.location_name}
                            </div>
                          )}
                        </div>
                        {sd.event_type && (
                          <Badge tone="gray">{sd.event_type}</Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Link>

          {/* CREATE CTA — full width */}
          <div className="col-span-12 rounded-2xl bg-brand-600 p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
              <div className="lg:pr-6 lg:border-r lg:border-white/20 lg:shrink-0">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
                  Publish
                </p>
                <h2 className="font-display text-2xl font-semibold tracking-wide text-white leading-none">
                  CREATE
                </h2>
                <p className="mt-2 max-w-[200px] text-xs text-white/70 leading-relaxed">
                  {isGuest
                    ? 'Add your event, artist page or venue — free, no account required to start'
                    : 'Add something new to 785 Magazine'}
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
                <CreateBtn href="/dashboard/events/edit">Event</CreateBtn>
                <CreateBtn
                  href={
                    isGuest
                      ? '/login?next=/dashboard/announcements/new'
                      : '/dashboard/announcements/new'
                  }
                >
                  Announcement
                </CreateBtn>
                <CreateBtn
                  href="https://seveneightfive.fillout.com/new-artist"
                  external
                >
                  Artist Page
                </CreateBtn>
                <CreateBtn
                  href="https://seveneightfive.fillout.com/add-venue"
                  external
                >
                  Venue Page
                </CreateBtn>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  } catch (err) {
    console.error('[dashboard] server error:', err)
    throw err
  }
}

// ─── Local card-shape helpers ────────────────────────────────────────────────
// Kept in this file because they're only used here and consistent labeling
// across the 6 cards is easier when the patterns live together. Promote to
// app/dashboard/_components/ later if you start reusing them on sub-pages.

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-1">
      {children}
    </p>
  )
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-xl font-semibold tracking-wider text-gray-900 dark:text-white leading-none">
      {children}
    </h3>
  )
}

function CardDesc({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{children}</p>
  )
}

function Divider() {
  return <hr className="my-3 border-gray-100 dark:border-gray-800" />
}

function EmptySlot({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs italic text-gray-400 dark:text-gray-500">{children}</p>
  )
}

function GuestSlot({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 space-y-1">
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {children}
      </p>
      <span className="inline-block text-xs font-bold text-brand-600 dark:text-brand-400">
        Sign in →
      </span>
    </div>
  )
}

function Avatar({
  kind,
  name,
  src,
}: {
  kind: 'artist' | 'venue'
  name: string
  src?: string | null
}) {
  const shape = kind === 'venue' ? 'rounded-lg' : 'rounded-full'
  return (
    <div
      className={`flex items-center justify-center w-8 h-8 ${shape} bg-brand-50 text-brand-700 text-xs font-bold shrink-0 overflow-hidden dark:bg-brand-500/15 dark:text-brand-300`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        name?.[0] ?? '?'
      )}
    </div>
  )
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'success' | 'brand' | 'gold' | 'gray'
}) {
  const tones: Record<typeof tone, string> = {
    success:
      'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400',
    brand:
      'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400',
    gold:
      'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
    gray:
      'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function CreateBtn({
  href,
  children,
  external,
}: {
  href: string
  children: React.ReactNode
  external?: boolean
}) {
  const cls =
    'block rounded-lg bg-accent-500 hover:bg-accent-600 px-3 py-3 text-center font-display text-sm font-semibold uppercase tracking-wide text-gray-900 transition'
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  )
}
