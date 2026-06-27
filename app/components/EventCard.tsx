// components/EventCard.tsx
import Link from 'next/link'

export type EventCardEvent = {
  id: string
  title: string
  slug: string | null
  event_date: string
  event_start_time: string | null
  image_url: string | null
  event_types?: string[] | null
  venues?: { name: string; neighborhood: string | null } | { name: string; neighborhood: string | null }[] | null
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
  }
}

function formatTime(t: string | null) {
  if (!t || t.trim() === ':') return ''
  const match = t.match(/(\d{1,2}):(\d{2})/)
  if (!match) return t

  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12

  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default function EventCard({ event }: { event: EventCardEvent }) {
  const venue = Array.isArray(event.venues) ? event.venues[0] : event.venues
  const date = formatDate(event.event_date)
  const href = event.slug ? `/events/${event.slug}` : '/events'

  return (
    <Link href={href} className="group block overflow-hidden rounded-lg border border-neutral-200 bg-white text-black shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-video overflow-hidden bg-black">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black text-5xl font-bold text-white/10">
            785
          </div>
        )}

        <div className="absolute left-3 top-3 bg-[#C80650] px-3 py-2 text-center font-['Oswald'] text-white shadow-lg">
          <div className="text-[10px] font-bold uppercase tracking-widest">{date.weekday}</div>
          <div className="text-2xl font-bold leading-none">{date.day}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest">{date.month}</div>
        </div>

        {event.event_types?.[0] && (
          <div className="absolute bottom-3 left-3 bg-[#FFCE03] px-3 py-1 font-['Oswald'] text-xs font-bold uppercase tracking-wider text-black">
            {event.event_types[0]}
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-['Oswald'] text-xl font-bold uppercase leading-tight tracking-tight">
          {event.title}
        </h3>

        <div className="mt-2 text-sm font-medium text-neutral-700">
          {venue?.name && <div>{venue.name}</div>}
          <div>
            {formatTime(event.event_start_time)}
            {venue?.neighborhood ? ` · ${venue.neighborhood}` : ''}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="font-['Oswald'] text-xs font-bold uppercase tracking-widest text-[#C80650]">
            View Event →
          </span>
          <span className="text-xl text-neutral-400">♡</span>
        </div>
      </div>
    </Link>
  )
}
