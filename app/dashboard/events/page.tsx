'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import Link from 'next/link'
import {
  Calendar,
  ExternalLink,
  Plus,
  Ticket,
  Music,
  Pencil,
} from 'lucide-react'

type EventRow = {
  id: string
  title: string
  event_date: string
  slug: string | null
  status: string
  ticketing_enabled: boolean | null
  source: 'created' | 'venue' | 'artist'
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function EventsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <EventsPageInner />
    </Suspense>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-pulse rounded-full bg-gray-300 dark:bg-gray-700"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function EventsPageInner() {
  const router = useRouter()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Fetch in parallel:
      //   1. Events the user CREATED (events.auth_user_id = user.id)
      //   2. Venues the user OWNS — so we can look up events at those venues
      //   3. Artist records the user OWNS — so we can look up events linked to them
      const [createdRes, venuesRes, artistsRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, title, event_date, slug, status, ticketing_enabled')
          .eq('auth_user_id', user.id),
        supabase.from('venues').select('id').eq('auth_user_id', user.id),
        supabase.from('artists').select('id').eq('auth_user_id', user.id),
      ])

      const created = createdRes.data || []
      const myVenueIds = (venuesRes.data || []).map((v) => v.id)
      const myArtistIds = (artistsRes.data || []).map((a) => a.id)

      const venueEventsRes = myVenueIds.length
        ? await supabase
            .from('events')
            .select('id, title, event_date, slug, status, ticketing_enabled')
            .in('venue_id', myVenueIds)
        : { data: [] as any[] }
      const venueEvents = venueEventsRes.data || []

      let artistEvents: any[] = []
      if (myArtistIds.length) {
        const linksRes = await supabase
          .from('event_artists')
          .select('event_id')
          .in('artist_id', myArtistIds)
        const linkedIds = (linksRes.data || []).map((l) => l.event_id)
        if (linkedIds.length) {
          const r = await supabase
            .from('events')
            .select('id, title, event_date, slug, status, ticketing_enabled')
            .in('id', linkedIds)
          artistEvents = r.data || []
        }
      }

      // Merge + dedupe. Prefer 'created' > 'venue' > 'artist' for the source
      // label so we show the strongest relationship.
      const byId = new Map<string, EventRow>()
      for (const e of artistEvents) byId.set(e.id, { ...e, source: 'artist' })
      for (const e of venueEvents) byId.set(e.id, { ...e, source: 'venue' })
      for (const e of created) byId.set(e.id, { ...e, source: 'created' })

      const today = new Date().toISOString().slice(0, 10)
      const all = Array.from(byId.values()).sort((a, b) => {
        const aUpcoming = a.event_date >= today
        const bUpcoming = b.event_date >= today
        if (aUpcoming && !bUpcoming) return -1
        if (!aUpcoming && bUpcoming) return 1
        return aUpcoming
          ? a.event_date.localeCompare(b.event_date)
          : b.event_date.localeCompare(a.event_date)
      })

      setEvents(all)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <LoadingState />

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter((e) => e.event_date >= today)
  const past = events.filter((e) => e.event_date < today)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
            Creator
          </p>
          <h1 className="mb-2 font-display text-3xl font-bold leading-none text-gray-900 dark:text-white">
            Events
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {events.length === 0
              ? "You haven't created any events yet."
              : `${upcoming.length} upcoming · ${past.length} past`}
          </p>
        </div>
        <Link
          href="/dashboard/events/edit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Event
        </Link>
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-white/[0.02]">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
            No events yet
          </p>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Create your first event to get started.
          </p>
          <Link
            href="/dashboard/events/edit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Create Event
          </Link>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Section label="Upcoming">
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </Section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <Section label="Past">
          {past.map((event) => (
            <EventCard key={event.id} event={event} dimmed />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  )
}

function EventCard({
  event,
  dimmed = false,
}: {
  event: EventRow
  dimmed?: boolean
}) {
  // Card click → manage view (tickets/sales). Most operator visits are
  // ops, not setup. Edit lives on the icon button below.
  return (
    <Link
      href={`/dashboard/events/${event.id}/tickets`}
      className={`group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-gray-700 ${
        dimmed ? 'opacity-60' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {event.title}
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {formatDate(event.event_date)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {event.status && event.status !== 'published' && (
            <Pill tone="gray">{event.status}</Pill>
          )}
          {event.ticketing_enabled && (
            <Pill tone="brand">
              <Ticket className="h-2.5 w-2.5" />
              785 Tickets
            </Pill>
          )}
          {event.source === 'venue' && <Pill tone="gray">At my venue</Pill>}
          {event.source === 'artist' && (
            <Pill tone="gray">
              <Music className="h-2.5 w-2.5" />
              I&apos;m performing
            </Pill>
          )}
        </div>
      </div>

      {/* Action icons. Each stops propagation so they don't fire the
          card-level link. */}
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          href={`/dashboard/events/edit?id=${event.id}`}
          label="Edit event"
        >
          <Pencil className="h-4 w-4" />
        </IconButton>
        {event.slug && (
          <IconButton
            href={`/events/${event.slug}`}
            label="View public event page"
            external
          >
            <ExternalLink className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    </Link>
  )
}

function IconButton({
  href,
  label,
  external = false,
  children,
}: {
  href: string
  label: string
  external?: boolean
  children: React.ReactNode
}) {
  // Important: nested anchor + stopPropagation. Without stopPropagation
  // the parent <Link> swallows the click and you'd never reach this href.
  return (
    <a
      href={href}
      {...(external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
    >
      {children}
    </a>
  )
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'brand' | 'gray'
}) {
  const cls =
    tone === 'brand'
      ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400'
      : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-white/[0.05] dark:text-gray-300'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${cls}`}
    >
      {children}
    </span>
  )
}
