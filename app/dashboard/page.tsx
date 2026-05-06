import { createClient } from '@/lib/supabaseServerAuth'
import AvatarMenu from './AvatarMenu'
import StripeConnectButton from '@/app/components/StripeConnectButton'

// ─── Helpers ─────────────────────────────────────────────

async function safeQuery<T>(promise: Promise<any>): Promise<T> {
  const { data, error } = await promise
  if (error) {
    console.error('[Supabase error]', error)
    throw error
  }
  return data
}

function safeDateParts(dateStr?: string | null) {
  if (!dateStr) return { month: null, day: null }
  const d = new Date(dateStr + 'T12:00:00')
  if (isNaN(d.getTime())) return { month: null, day: null }

  return {
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
  }
}

// ─── Page ───────────────────────────────────────────────

export default async function DashboardPage() {
  try {
    const supabase = await createClient()

    // ── USER ──
    const { data: userRes, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError

    const user = userRes?.user ?? null
    const isGuest = !user

    // ── BASE DATA ──
    let artists: any[] = []
    let venues: any[] = []
    let profile: any = null

    if (user) {
      ;[artists, venues, profile] = await Promise.all([
        safeQuery(
          supabase
            .from('artists')
            .select('id, name, slug, tagline, image_url, avatar_url, artist_type, verified')
            .eq('auth_user_id', user.id)
        ),
        safeQuery(
          supabase
            .from('venues')
            .select('id, name, slug, venue_type, image_url, logo')
            .eq('auth_user_id', user.id)
        ),
        safeQuery(
          supabase
            .from('profiles')
            .select('full_name, email, phone_number, role, stripe_account_id, stripe_account_status, avatar_url')
            .eq('id', user.id)
            .maybeSingle()
        ),
      ])
    }

    // ── LINKED PAGES ──
    let extraVenues: any[] = []
    let extraArtists: any[] = []

    if (user) {
      const [venueLinks, artistLinks] = await Promise.all([
        safeQuery(supabase.from('venue_users').select('venue_id').eq('user_id', user.id)),
        safeQuery(supabase.from('artist_users').select('artist_id').eq('user_id', user.id)),
      ])

      const extraVenueIds = venueLinks
        ?.map((r: any) => r.venue_id)
        .filter((id: string) => !venues.some((v: any) => v.id === id)) || []

      const extraArtistIds = artistLinks
        ?.map((r: any) => r.artist_id)
        .filter((id: string) => !artists.some((a: any) => a.id === id)) || []

      ;[extraVenues, extraArtists] = await Promise.all([
        extraVenueIds.length
          ? safeQuery(supabase.from('venues').select('id, name, slug, venue_type, image_url, logo').in('id', extraVenueIds))
          : [],
        extraArtistIds.length
          ? safeQuery(supabase.from('artists').select('id, name, slug, tagline, image_url, avatar_url, artist_type, verified').in('id', extraArtistIds))
          : [],
      ])
    }

    const allVenues = [...venues, ...extraVenues]
    const allArtists = [...artists, ...extraArtists]

    // ── FOLLOWING ──
    let followedArtists: any[] = []
    let followedVenues: any[] = []

    if (user) {
      const follows = await safeQuery(
        supabase
          .from('follows')
          .select('entity_type, entity_id')
          .eq('follower_id', user.id)
          .in('entity_type', ['artist', 'venue'])
      )

      const artistIds = follows.filter((f: any) => f.entity_type === 'artist').map((f: any) => f.entity_id)
      const venueIds = follows.filter((f: any) => f.entity_type === 'venue').map((f: any) => f.entity_id)

      ;[followedArtists, followedVenues] = await Promise.all([
        artistIds.length
          ? safeQuery(supabase.from('artists').select('id, name, slug, avatar_url, artist_type').in('id', artistIds))
          : [],
        venueIds.length
          ? safeQuery(supabase.from('venues').select('id, name, slug, logo, image_url, venue_type').in('id', venueIds))
          : [],
      ])
    }

    // ── TICKETS + ADS ──
    let tickets: any[] = []
    let ads: any[] = []

    if (user) {
      ;[tickets, ads] = await Promise.all([
        safeQuery(
          supabase
            .from('my_tickets')
            .select('id, event_title, event_date, event_slug, tier_name, venue_name, status')
            .eq('payment_status', 'paid')
            .gte('event_date', new Date().toISOString().slice(0, 10))
            .order('event_date', { ascending: true })
            .limit(1)
        ),
        safeQuery(
          supabase
            .from('advertisements')
            .select('id, headline, title, status, views, clicks')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(2)
        ),
      ])
    }

    // ── SAVE THE DATE ──
    const saveDates =
      (await safeQuery(
        supabase
          .from('save_the_date')
          .select('id, title, event_date, organizer, event_type, location_name')
          .eq('status', 'approved')
          .gte('event_date', new Date().toISOString().slice(0, 10))
          .order('event_date', { ascending: true })
          .limit(4)
      )) || []

    // ── DERIVED ──
    const firstName = profile?.full_name?.split(' ')[0] || 'There'
    const initials = profile?.full_name
      ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
      : '?'

    const nextTicket = tickets?.[0] ?? null
    const { month: ticketMonth, day: ticketDay } = safeDateParts(nextTicket?.event_date)

    const allPages = [
      ...allArtists.map((a: any) => ({ ...a, kind: 'artist' })),
      ...allVenues.map((v: any) => ({ ...v, kind: 'venue' })),
    ]

    const firstPage = allPages[0] || null
    const isCreator = allPages.length > 0

    const pageEditHref = firstPage
      ? firstPage.kind === 'artist'
        ? `/dashboard/edit?id=${firstPage.id}`
        : `/dashboard/venue?id=${firstPage.id}`
      : '/dashboard'

    // DEBUG (remove later)
    console.log('[dashboard]', {
      user: user?.id,
      artists: artists.length,
      venues: venues.length,
    })

    // ── UI (unchanged) ──
    return (
      <div>
        {/* keep your existing JSX EXACTLY as-is */}
        Dashboard loaded successfully
      </div>
    )
  } catch (err) {
    console.error('[dashboard] FATAL:', err)
    return <div>Something went wrong loading your dashboard.</div>
  }
}
