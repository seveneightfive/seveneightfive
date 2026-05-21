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

    // ── User pages (artists + venues, owned + linked via *_users) ────────
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
      { data: ticketedEvents },
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
            .limit(2)
        : Promise.resolve({ data: [] as any[] }),
      user
        ? supabase
            .from('advertisements')
            .select('id, headline, title, status, views, clicks')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(2)
        : Promise.resolve({ data: [] as any[] }),
      // Used to decide whether to show the 785Tickets promo card.
      // A user "has active ticketed events" if they own any event where
      // ticketing is enabled. Adjust the table/column names if yours differ.
      user
        ? supabase
            .from('events')
            .select('id')
            .eq('created_by', user.id)
            .eq('tickets_enabled', true)
            .limit(1)
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
    const isCreator = allPages.length > 0
    const hasTicketedEvents = (ticketedEvents || []).length > 0
    // Show the 785Tickets promo to anyone who hasn't yet sold a ticket —
    // includes both guests (so they see the pitch) and signed-in users who
    // haven't enabled ticketing on any of their events. Hide once they're
    // an active ticketing creator (then it's just noise).
    const showTicketsPromo = !hasTicketedEvents

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
    // Layout (12-col grid):
    //
    //   Greeting
    //   CREATE strip (moved up from the bottom — most action-oriented thing)
    //   MY TICKETS (6) | MY PAGES (6)
    //   FOLLOWING (4)  | ADVERTISE (4)  | PAYOUTS / Stripe (4)
    //   SAVE THE DATE (8)               | OPPORTUNITIES (4)
    //   785TICKETS PROMO (12, conditional)
    //   Footer link strip (Edit Profile · Notifications · Sign Out)
    //
    // Settings card removed — its three links live in the footer strip now
    // and the Stripe Connect entry point gets its own focused card.
    // ─────────────────────────────────────────────────────────────────────

    return (
      <div className="space-y-6">
        {/* GREETING — compact */}
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400 mb-1">
            Your 785
          </p>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-tight leading-none text-gray-900 dark:text-white">
            {isGuest ? 'Hey, Topeka' : `Hey, ${firstName}`}
          </h1>
          <p className="mt-2 font-body text-sm text-gray-500 dark:text-gray-400">
            {isGuest
              ? 'Discover local artists, events, and venues — or add your own.'
              : "Here's what's yours, and what's next."}
          </p>
        </div>

        {/* CREATE STRIP — moved UP from the bottom of the page */}
        <section className="rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-6 text-white shadow-theme-md">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="lg:pr-7 lg:border-r lg:border-white/25 lg:shrink-0 lg:min-w-[220px]">
              <p className="mb-1 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-white/65">
                Publish
              </p>
              <h2 className="font-display text-3xl font-semibold uppercase tracking-wide text-white leading-none">
                Create
              </h2>
              <p className="mt-2 font-body text-xs text-white/75 leading-relaxed max-w-[220px]">
                {isGuest
                  ? 'Add your event, artist page or venue — free, no account required to start.'
                  : 'Add something new to 785 Magazine.'}
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
        </section>

        {/* MAIN GRID */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* ROW 1: My Tickets (6) + My Pages (6) */}

          {/* MY TICKETS */}
          <Link
            href={isGuest ? '/login' : '/dashboard/tickets'}
            className="col-span-12 lg:col-span-6 group relative rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-gray-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700"
          >
            <CardHead label="Attending" title="My Tickets" />

            {isGuest ? (
              <GuestSlot>Sign in to purchase, sell, and view your tickets</GuestSlot>
            ) : (tickets || []).length > 0 ? (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800 -mb-2">
                {(tickets || []).map((t: any) => (
                  <li key={t.id} className="flex items-center gap-4 py-3 first:pt-0">
                    <DateChip date={t.event_date} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-display text-base font-medium tracking-wide text-gray-900 dark:text-white">
                        {t.event_title}
                      </div>
                      <div className="mt-0.5 truncate font-body text-xs text-gray-500 dark:text-gray-400">
                        {t.venue_name || 'Venue TBA'}
                        {t.tier_name ? ` · ${t.tier_name}` : ''}
                      </div>
                    </div>
                    <Badge tone="success">Confirmed</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint
                primary="No upcoming tickets"
                action="Browse events →"
              />
            )}
          </Link>

          {/* MY PAGES */}
          <Link
            href={isGuest ? '/login' : pageEditHref}
            className="col-span-12 lg:col-span-6 group relative rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-gray-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700"
          >
            <CardHead label="Creator" title="My Pages" />

            {isGuest ? (
              <GuestSlot>Sign in to manage your artist and venue pages</GuestSlot>
            ) : allPages.length > 0 ? (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800 -mb-2">
                {allPages.slice(0, 2).map((p: any) => (
                  <li key={`${p.kind}-${p.id}`} className="flex items-center gap-3 py-3 first:pt-0">
                    <Avatar
                      kind={p.kind}
                      name={p.name}
                      src={p.avatar_url || p.logo || p.image_url}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-display text-base font-medium tracking-wide text-gray-900 dark:text-white">
                        {p.name}
                      </div>
                      <div className="mt-0.5 font-body text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                        {TYPE_LABEL[p.artist_type] ||
                          (Array.isArray(p.venue_type)
                            ? p.venue_type[0]
                            : p.venue_type) ||
                          (p.kind === 'venue' ? 'Venue' : 'Artist')}
                      </div>
                    </div>
                    {!p.tagline && p.kind === 'artist' && (
                      <Badge tone="brand">No tagline</Badge>
                    )}
                  </li>
                ))}
                {allPages.length > 2 && (
                  <li className="pt-3 font-body text-xs text-gray-500 dark:text-gray-400">
                    + {allPages.length - 2} more
                  </li>
                )}
              </ul>
            ) : (
              <EmptyHint
                primary="No pages yet"
                action="Create one in the panel above →"
              />
            )}
          </Link>

          {/* ROW 2: Following (4) + Advertise (4) + Payouts/Stripe (4) */}

          {/* FOLLOWING */}
          <Link
            href={isGuest ? '/login' : '/dashboard/following'}
            className="col-span-12 sm:col-span-6 lg:col-span-4 group relative rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-gray-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700"
          >
            <CardHead
              label="Artists & Venues"
              title="Following"
              meta={!isGuest ? `${allFollowed.length}` : undefined}
            />

            {isGuest ? (
              <GuestSlot>Sign in to follow artists and get updates</GuestSlot>
            ) : allFollowed.length > 0 ? (
              <div className="flex flex-col gap-3 -mb-1">
                {allFollowed.slice(0, 3).map((f: any) => (
                  <div key={`${f.kind}-${f.id}`} className="flex items-center gap-3">
                    <Avatar
                      kind={f.kind}
                      name={f.name}
                      src={f.avatar_url || f.logo || f.image_url}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-medium tracking-wide text-gray-900 dark:text-white">
                        {f.name}
                      </div>
                      <div className="mt-0.5 truncate font-body text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
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
              <EmptyHint
                primary="Not following anyone yet"
                action="Discover artists →"
              />
            )}
          </Link>

          {/* ADVERTISE */}
          <Link
            href={isGuest ? '/login' : '/dashboard/advertise'}
            className="col-span-12 sm:col-span-6 lg:col-span-4 group relative rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-gray-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700"
          >
            <CardHead label="Publisher & Buyer" title="Advertise" />

            {isGuest ? (
              <GuestSlot>Sign in to place and manage ads on seveneightfive.com</GuestSlot>
            ) : (ads || []).length > 0 ? (
              <div className="flex flex-col gap-2 -mb-1">
                {(ads || []).map((ad: any, i: number) => (
                  <div
                    key={ad.id}
                    className={
                      i > 0
                        ? 'pt-2 border-t border-gray-100 dark:border-gray-800'
                        : ''
                    }
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="truncate font-display text-sm font-medium tracking-wide text-gray-900 dark:text-white">
                        {ad.headline || ad.title || 'Untitled Ad'}
                      </div>
                      <Badge tone={ad.status === 'active' ? 'success' : 'gold'}>
                        {ad.status === 'active' ? 'Active' : 'Ended'}
                      </Badge>
                    </div>
                    <div className="font-body text-xs text-gray-500 dark:text-gray-400">
                      {ad.views || 0} views · {ad.clicks || 0} clicks
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyHint
                primary="No ads yet"
                action="Place your first →"
              />
            )}
          </Link>

          {/* PAYOUTS / STRIPE CONNECT */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-4 group relative rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-gray-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700">
            <CardHead
              label="Payouts"
              title={
                profile?.stripe_account_status === 'active'
                  ? 'Stripe Connected'
                  : 'Get Paid'
              }
            />

            {isGuest ? (
              <GuestSlot>Sign in and connect Stripe to start receiving payouts</GuestSlot>
            ) : (
              <>
                <p className="mb-4 font-body text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {profile?.stripe_account_status === 'active'
                    ? 'Your account is connected. Payouts land in your bank within ~2 business days.'
                    : isCreator
                    ? 'Connect Stripe to start receiving ticket and donation payouts.'
                    : 'Set up an artist or venue page first, then connect Stripe to take payments.'}
                </p>
                {isCreator ? (
                  <StripeConnectButton
                    accountStatus={profile?.stripe_account_status ?? null}
                    returnPath="/dashboard"
                  />
                ) : (
                  <Link
                    href="/dashboard/edit"
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 font-body text-xs font-semibold uppercase tracking-wider text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.04]"
                  >
                    Create a Page First →
                  </Link>
                )}
              </>
            )}
          </div>

          {/* ROW 3: Save the Date (8) + Opportunities (4) */}

          {/* SAVE THE DATE */}
          <Link
            href="/save-the-date"
            className="col-span-12 lg:col-span-8 group relative rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-gray-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div>
                <CardHead
                  label="Community Calendar"
                  title="Save the Date"
                  noMargin
                />
                <p className="mt-2 font-body text-xs text-gray-500 dark:text-gray-400">
                  Claim your date before the details are finalized — no account needed.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center self-start rounded-lg bg-brand-600 px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-brand-700">
                + Claim a Date
              </span>
            </div>

            {(saveDates || []).length > 0 && (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800 -mb-2">
                {(saveDates as SaveTheDate[]).map((sd) => (
                  <li key={sd.id} className="flex items-center gap-3 py-3 first:pt-0">
                    <DateChip date={sd.event_date} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-display text-sm font-medium tracking-wide text-gray-900 dark:text-white">
                        {sd.title}
                      </div>
                      {sd.location_name && (
                        <div className="mt-0.5 truncate font-body text-xs text-gray-500 dark:text-gray-400">
                          {sd.location_name}
                        </div>
                      )}
                    </div>
                    {sd.event_type && <Badge tone="gray">{sd.event_type}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Link>

          {/* OPPORTUNITIES */}
          <Link
            href="/opportunities/submit"
            className="col-span-12 lg:col-span-4 group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-gray-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700"
          >
            <CardHead label="Creative Calls" title="Opportunities" />

            <p className="mb-4 font-body text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Post gigs, grants, residencies, open calls, commissions, or collaborations.
            </p>

            <div className="mt-auto flex flex-wrap gap-1.5">
              {['Job', 'Volunteer', 'Casting', 'Grant', 'Collab'].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:bg-white/[0.06] dark:text-gray-400"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-4 font-body text-xs font-bold text-brand-600 dark:text-brand-400">
              Post one →
            </div>
          </Link>

          {/* 785 TICKETS PROMO — conditional, only shown when user has no
              active ticketed events (or is signed out). Hides once they're
              actively selling tickets, where it'd be noise. */}
          {showTicketsPromo && (
            <Link
              href="/shop"
              className="col-span-12 group relative overflow-hidden rounded-2xl border border-gray-900 bg-gray-900 p-6 text-white transition hover:shadow-theme-lg dark:border-white/10 dark:bg-gray-950"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                <div className="flex-1">
                  <p className="mb-1 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-brand-400">
                    Sell with 785
                  </p>
                  <h3 className="font-display text-2xl font-semibold uppercase tracking-wide leading-tight">
                    Ticketing that keeps it local.
                  </h3>
                  <p className="mt-2 max-w-xl font-body text-sm text-gray-300 leading-relaxed">
                    70¢ per ticket. No percentage fees. Stripe payouts in 2 days. QR
                    scanning, custom questions, donations, and merch — all built in.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-body text-xs text-gray-400">
                    <span>✱ Online + at-the-door</span>
                    <span>✱ Multi-tier pricing</span>
                    <span>✱ Built-in QR check-in</span>
                    <span>✱ Live analytics</span>
                  </div>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center rounded-lg bg-white px-5 py-3 font-display text-sm font-semibold uppercase tracking-wide text-gray-900 transition group-hover:bg-brand-500 group-hover:text-white">
                    Learn More →
                  </span>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* FOOTER LINK STRIP — Settings card replaced by this */}
        {!isGuest && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-4 font-body text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
            <Link
              href="/dashboard/settings"
              className="transition hover:text-gray-900 dark:hover:text-white"
            >
              Edit Profile
            </Link>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <Link
              href="/dashboard/settings#notifications"
              className="transition hover:text-gray-900 dark:hover:text-white"
            >
              Notifications
            </Link>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <Link
              href="/api/auth/signout"
              className="font-semibold text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Sign Out
            </Link>
          </div>
        )}
      </div>
    )
  } catch (err) {
    console.error('[dashboard] server error:', err)
    throw err
  }
}

// ─── Local card-shape helpers ────────────────────────────────────────────────

function CardHead({
  label,
  title,
  meta,
  noMargin,
}: {
  label: string
  title: string
  meta?: string
  noMargin?: boolean
}) {
  return (
    <div className={noMargin ? '' : 'mb-4'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 mb-1">
            {label}
          </p>
          <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-gray-900 dark:text-white leading-none">
            {title}
            {meta !== undefined && (
              <span className="ml-2 font-body text-sm font-medium text-gray-400 dark:text-gray-500 normal-case tracking-normal">
                {meta}
              </span>
            )}
          </h3>
        </div>
        <ArrowIcon />
      </div>
    </div>
  )
}

function ArrowIcon() {
  return (
    <span
      aria-hidden
      className="shrink-0 mt-0.5 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600 dark:text-gray-700 dark:group-hover:text-brand-400"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="17" x2="17" y2="7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    </span>
  )
}

function DateChip({ date }: { date: string }) {
  const d = new Date(date + 'T12:00:00')
  const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  const day = d.getDate()
  return (
    <div className="text-center min-w-[36px] shrink-0 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1">
      <div className="font-body text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 leading-none">
        {mon}
      </div>
      <div className="mt-1 font-display text-lg font-semibold leading-none text-gray-900 dark:text-white">
        {day}
      </div>
    </div>
  )
}

function EmptyHint({
  primary,
  action,
}: {
  primary: string
  action: string
}) {
  return (
    <div className="font-body">
      <p className="text-sm text-gray-500 dark:text-gray-400">{primary}</p>
      <p className="mt-1 text-xs font-bold text-brand-600 dark:text-brand-400">
        {action}
      </p>
    </div>
  )
}

function GuestSlot({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-body space-y-1">
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
      className={`flex items-center justify-center w-9 h-9 ${shape} bg-brand-50 text-brand-700 font-display text-sm font-semibold shrink-0 overflow-hidden dark:bg-brand-500/15 dark:text-brand-300`}
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
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400',
    gold:
      'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
    gray: 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-[10px] font-bold whitespace-nowrap ${tones[tone]}`}
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
    'block rounded-lg bg-white/15 hover:bg-white px-3 py-3 text-center font-display text-sm font-semibold uppercase tracking-wide text-white hover:text-brand-700 transition backdrop-blur-sm border border-white/10 hover:border-white'
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
