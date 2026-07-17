'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import Link from 'next/link'
import {
  Calendar,
  Plus,
  Ticket,
  Music,
  Eye,
} from 'lucide-react'

type EventRow = {
  id: string
  title: string
  event_date: string
  slug: string | null
  status: string
  ticketing_enabled: boolean | null
  image_url: string | null
  source: 'created' | 'venue' | 'artist'
  views: number
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

      const SELECT = 'id, title, event_date, slug, status, ticketing_enabled, image_url'

      const [createdRes, venuesRes, artistsRes] = await Promise.all([
        supabase.from('events').select(SELECT).eq('auth_user_id', user.id),
        supabase.from('venues').select('id').eq('auth_user_id', user.id),
        supabase.from('artists').select('id').eq('auth_user_id', user.id),
      ])

      const created = createdRes.data || []
      const myVenueIds = (venuesRes.data || []).map((v) => v.id)
      const myArtistIds = (artistsRes.data || []).map((a) => a.id)

      const venueEventsRes = myVenueIds.length
        ? await supabase.from('events').select(SELECT).in('venue_id', myVenueIds)
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
          const r = await supabase.from('events').select(SELECT).in('id', linkedIds)
          artistEvents = r.data || []
        }
      }

      const byId = new Map<string, EventRow>()
      for (const e of artistEvents) byId.set(e.id, { ...e, source: 'artist', views: 0 })
      for (const e of venueEvents) byId.set(e.id, { ...e, source: 'venue', views: 0 })
      for (const e of created) byId.set(e.id, { ...e, source: 'created', views: 0 })

      const allIds = Array.from(byId.keys())
      if (allIds.length) {
        const { data: analyticsRows } = await supabase
          .from('event_analytics')
          .select('event_id, total_page_views')
          .in('event_id', allIds)
        for (const row of analyticsRows || []) {
          const existing = byId.get(row.event_id)
          if (existing) existing.views = row.total_page_views || 0
        }
      }

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
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {events.length === 0
            ? "You haven't created any events yet."
            : `${upcoming.length} upcoming · ${past.length} past`}
        </p>
        <Link
          href="/dashboard/events/edit"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Event
        </Link>
      </div>

      {events.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-white/[0.02]">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
            No events yet
          </p>
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
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

      {upcoming.length > 0 && (
        <Section label="Upcoming">
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </Section>
      )}

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
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600 dark:text-gray-300">
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
  return (
    <Link
      href={`/dashboard/events/${event.id}/tickets`}
      className={`group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-gray-700 ${
        dimmed ? 'opacity-60' : ''
      }`}
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/[0.05]">
        {event.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-600" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {event.title}
        </div>
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
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

      <div className="flex shrink-0 flex-col items-end gap-0.5 pl-2">
        <div className="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white">
          <Eye className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600" />
          {event.views.toLocaleString()}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">
          views
        </div>
      </div>
    </Link>
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
