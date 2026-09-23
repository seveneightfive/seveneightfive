// components/SpotlightCard.tsx
//
// Large, borderless, image-first card used only by the home page event
// rails (EventTabs). Kept separate from EventCard on purpose: EventCard is
// the compact boxed card used in grids across the site (and its ★ Featured
// badge is still used on the SEO event pages), so changing it here would
// ripple everywhere.
import Link from 'next/link'
import { formatTime, type EventCardEvent } from './EventCard'

export type SpotlightEvent = EventCardEvent & {
  end_date?: string | null
}

function shortDate(dateStr: string) {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function monthDay(dateStr: string) {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// "Sat, Oct 3" for one-day events, "Sep 23 – Nov 1" for runs.
function dateLabel(event: SpotlightEvent) {
  const start = event.event_date
  const end = event.end_date?.slice(0, 10)
  if (end && end > start) return `${monthDay(start)} – ${monthDay(end)}`
  return shortDate(start)
}

export default function SpotlightCard({ event }: { event: SpotlightEvent }) {
  const venue = event.venue ?? (Array.isArray(event.venues) ? event.venues[0] : event.venues)
  const href = event.slug ? `/events/${event.slug}` : '/events'
  const time = formatTime(event.event_start_time)

  return (
    <Link href={href} className="group block text-black">
      <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-black">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl font-bold text-white/10">
            785
          </div>
        )}

        {event.event_types?.[0] && (
          <div className="absolute bottom-3 left-3 bg-[#FFCE03] px-3 py-1 font-['Oswald'] text-xs font-bold uppercase tracking-wider text-black">
            {event.event_types[0]}
          </div>
        )}
      </div>

      <div className="pt-3">
        <div className="text-sm">
          <span className="font-semibold text-[#C80650]">{dateLabel(event)}</span>
          {time && <span className="text-neutral-500"> · {time}</span>}
        </div>

        <h3 className="mt-1 font-['Oswald'] text-2xl font-bold uppercase leading-tight tracking-tight group-hover:underline">
          {event.title}
        </h3>

        {venue?.name && (
          <div className="mt-1.5 flex items-center gap-1.5 text-neutral-600">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            <span>{venue.name}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
