// components/EventListRow.tsx
import Link from 'next/link'

export type EventListRowEvent = {
  id: string
  title: string
  slug: string | null
  event_date: string
  image_url: string | null
  venue: { name: string; neighborhood: string | null } | null
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function EventListRow({ event }: { event: EventListRowEvent }) {
  const href = event.slug ? `/events/${event.slug}` : '/events'

  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-t border-neutral-200 px-1 py-3 first:border-t-0"
    >
      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-md bg-black">
        {event.image_url ? (
          <img src={event.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/15">
            785
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-neutral-900">{event.title}</div>
        <div className="truncate text-xs text-neutral-500">
          {formatDateShort(event.event_date)}
          {event.venue?.name ? ` · ${event.venue.name}` : ''}
        </div>
      </div>

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-neutral-400">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  )
}
