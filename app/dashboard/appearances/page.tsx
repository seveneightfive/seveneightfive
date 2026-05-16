'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import Link from 'next/link'
import { Loader2, Plus, Trash2, ExternalLink } from 'lucide-react'

type AppearanceEvent = {
  id: string
  title: string
  event_date: string
  slug: string | null
  venue_name: string | null
}

type SearchEvent = {
  id: string
  title: string
  event_date: string
  slug: string | null
  venue_name: string | null
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function AppearancesPage() {
  const router = useRouter()
  const [artistId, setArtistId] = useState<string | null>(null)
  const [appearances, setAppearances] = useState<AppearanceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  // Search to add
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<SearchEvent[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

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

      const today = new Date().toLocaleDateString('en-CA')
      const { data: links } = await supabase
        .from('event_artists')
        .select('event_id, events(id, title, event_date, slug, venues(name))')
        .eq('artist_id', artist.id)
        .gte('events.event_date', today)

      const mapped = (links || [])
        .map((l: any) => {
          const e = Array.isArray(l.events) ? l.events[0] : l.events
          if (!e) return null
          const v = Array.isArray(e.venues) ? e.venues[0] : e.venues
          return {
            id: e.id,
            title: e.title,
            event_date: e.event_date,
            slug: e.slug,
            venue_name: v?.name || null,
          }
        })
        .filter(Boolean) as AppearanceEvent[]

      mapped.sort((a, b) => a.event_date.localeCompare(b.event_date))
      setAppearances(mapped)
      setAddedIds(new Set(mapped.map((a) => a.id)))
      setLoading(false)
    }
    load()
  }, [router])

  // Search upcoming events
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([])
      return
    }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setSearching(true)
      const supabase = createClient()
      const today = new Date().toLocaleDateString('en-CA')

      const { data } = await supabase
        .from('events')
        .select('id, title, event_date, slug, venues(name)')
        .gte('event_date', today)
        .ilike('title', `%${search}%`)
        .order('event_date', { ascending: true })
        .limit(10)

      const mapped = (data || []).map((e: any) => {
        const v = Array.isArray(e.venues) ? e.venues[0] : e.venues
        return {
          id: e.id,
          title: e.title,
          event_date: e.event_date,
          slug: e.slug,
          venue_name: v?.name || null,
        }
      })

      setSearchResults(mapped)
      setSearching(false)
    }, 300)
  }, [search])

  const handleAdd = async (event: SearchEvent) => {
    if (!artistId) return
    setAdding(event.id)
    const res = await fetch('/api/event/artist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event.id, artistId }),
    })
    if (res.ok) {
      setAppearances((prev) =>
        [...prev, event].sort((a, b) => a.event_date.localeCompare(b.event_date))
      )
      setAddedIds((prev) => new Set([...prev, event.id]))
    }
    setAdding(null)
  }

  const handleRemove = async (eventId: string, title: string) => {
    if (!artistId) return
    if (!confirm(`Remove yourself from "${title}"?`)) return
    setRemoving(eventId)
    const res = await fetch('/api/event/artist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, artistId }),
    })
    if (res.ok) {
      setAppearances((prev) => prev.filter((a) => a.id !== eventId))
      setAddedIds((prev) => {
        const s = new Set(prev)
        s.delete(eventId)
        return s
      })
    }
    setRemoving(null)
  }

  if (loading) {
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
          Creator
        </p>
        <h1 className="mb-2 font-display text-3xl font-bold leading-none text-gray-900 dark:text-white">
          Your Appearances
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Upcoming events you&apos;re featured in. Search below to add yourself
          to any event.
        </p>
      </div>

      {/* Upcoming appearances */}
      <div>
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
          Upcoming Events You&apos;re Featured In
        </h2>

        {appearances.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center dark:border-gray-700 dark:bg-white/[0.02]">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You&apos;re not connected to any upcoming events yet. Search below
              to add yourself.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {appearances.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
                    {formatDate(event.event_date)}
                  </div>
                  <div className="mt-0.5 font-display text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                    {event.title}
                  </div>
                  {event.venue_name && (
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {event.venue_name}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {event.slug && (
                    <a
                      href={`/events/${event.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.1] dark:hover:text-gray-300"
                      title="View event"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleRemove(event.id, event.title)}
                    disabled={removing === event.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
                    title="Remove"
                  >
                    {removing === event.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search to add */}
      <div className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
          Find &amp; Add Yourself to an Event
        </h2>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search upcoming events by title…"
          className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />

        {searching && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        )}

        {!searching && search && searchResults.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No upcoming events found for "{search}"
          </p>
        )}

        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
                    {formatDate(event.event_date)}
                  </div>
                  <div className="mt-0.5 font-display text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                    {event.title}
                  </div>
                  {event.venue_name && (
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {event.venue_name}
                    </div>
                  )}
                </div>
                {addedIds.has(event.id) ? (
                  <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-gray-400 dark:text-gray-500">
                    Added ✓
                  </span>
                ) : (
                  <button
                    onClick={() => handleAdd(event)}
                    disabled={adding === event.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/15"
                  >
                    {adding === event.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    Add me
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
