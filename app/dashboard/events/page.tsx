'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import Link from 'next/link'

type Event = {
  id: string
  title: string
  event_date: string
  slug: string | null
  status: string
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
  const [artistId, setArtistId] = useState<string | null>(null)
  const [events, setEvents] = useState<Event[]>([])
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

      const { data: artist } = await supabase
        .from('artists')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!artist) {
        router.push('/dashboard')
        return
      }

      setArtistId(artist.id)

      const { data: userEvents } = await supabase
        .from('events')
        .select('id, title, event_date, slug, status')
        .eq('artist_id', artist.id)
        .order('event_date', { ascending: false })

      setEvents((userEvents || []) as Event[])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <LoadingState />

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
          Creator
        </p>
        <h1 className="mb-2 font-display text-3xl font-bold leading-none text-gray-900 dark:text-white">
          Events
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Events you&apos;ve created and are managing.
        </p>
      </div>

      {/* Events list */}
      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-white/[0.02]">
          <p className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            No events yet
          </p>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Create an event to get started. You can manage it from here.
          </p>
          <Link
            href="/dashboard/events/edit"
            className="inline-flex rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700"
          >
            Create Event
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/dashboard/events/edit?id=${event.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-gray-700"
            >
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                  {event.title}
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(event.event_date)}
                </div>
                {event.status && (
                  <div className="mt-1.5 inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-600 dark:border-gray-700 dark:bg-white/[0.05] dark:text-gray-300">
                    {event.status}
                  </div>
                )}
              </div>
              {event.slug && (
                <a
                  href={`/events/${event.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
