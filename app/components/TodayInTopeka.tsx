// app/components/TodayInTopeka.tsx
//
// Practical "what's on today" list that follows the editorial carousel.
// 4 rows on mobile, 6 in a grid from md up.
import Link from 'next/link'
import { formatTime } from './EventCard'

export type TodayEvent = {
  id: string
  title: string
  slug: string | null
  event_start_time: string | null
  event_types: string[] | null
  venue: { name: string; neighborhood: string | null } | null
}

export default function TodayInTopeka({ events, total }: { events: TodayEvent[]; total: number }) {
  return (
    <section className="pb-2 pt-8 lg:pt-11">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="font-['Oswald'] text-[28px] font-bold uppercase leading-none lg:text-[34px]">
            Today in Topeka
          </h2>
          <span className="text-sm text-neutral-600 lg:text-[15px]">
            {total === 0
              ? 'Nothing listed for today yet'
              : `${total} ${total === 1 ? 'event' : 'events'} happening today`}
          </span>
        </div>
        <Link
          href="/events"
          className="whitespace-nowrap font-['Oswald'] text-sm font-semibold uppercase tracking-[0.08em] text-[#C80650] hover:underline"
        >
          {total === 0 ? 'See what’s coming up →' : 'View all →'}
        </Link>
      </div>

      {events.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-3">
          {events.map((event, i) => {
            const time = formatTime(event.event_start_time) || 'All day'
            const meta = [event.venue?.name, event.event_types?.[0]].filter(Boolean).join(' · ')
            return (
              <li key={event.id} className={i >= 4 ? 'hidden md:block' : undefined}>
                <Link
                  href={event.slug ? `/events/${event.slug}` : '/events'}
                  className="flex items-center gap-3.5 rounded-xl border border-[#E6E3DC] bg-[#FBFAF7] py-3.5 pl-3.5 pr-3 text-[#0B0F1A] transition hover:border-[#D6D2C8] hover:bg-white lg:gap-4 lg:py-4 lg:pl-[18px]"
                >
                  <span className="w-[62px] shrink-0 font-['Oswald'] text-[17px] font-bold text-[#C80650] lg:text-lg">
                    {time}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold leading-snug">{event.title}</span>
                    {meta && <span className="mt-0.5 block truncate text-[13px] text-neutral-600">{meta}</span>}
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-500" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
