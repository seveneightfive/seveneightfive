// app/components/HomeHero.tsx
import Link from 'next/link'

export type HeroEvent = {
  id: string
  title: string
  slug: string | null
  event_date: string
  event_start_time: string | null
  image_url: string | null
  ticket_price?: number | null
  venue?: { name: string; neighborhood: string | null } | null
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
  if (!t) return ''
  const cleaned = t.trim().toLowerCase()
  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return t

  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12

  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default function HomeHero({ editorPick }: { editorPick: HeroEvent | null }) {
  const venue = editorPick
    ? editorPick.venue ?? (Array.isArray(editorPick.venues) ? editorPick.venues[0] : editorPick.venues)
    : null

  const date = editorPick ? formatDate(editorPick.event_date) : null
  const time = editorPick ? formatTime(editorPick.event_start_time) : ''
  const href = editorPick?.slug ? `/events/${editorPick.slug}` : '/events'

  return (
    <section className="bg-black text-white">
      <div className="mx-auto grid min-h-[520px] max-w-[1400px] grid-cols-1 items-center gap-10 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <div>
          <div className="mb-4 h-1 w-12 bg-[#FFCE03]" />

          <h1 className="font-['Oswald'] text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            Topeka’s
            <br />
            Arts, Music &
            <br />
            Culture Calendar
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/75">
            Find events, artists, venues, opportunities, and local creative happenings.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/events"
              className="bg-[#FFCE03] px-6 py-3 font-['Oswald'] text-sm font-bold uppercase tracking-widest text-black"
            >
              Browse Events
            </Link>

            <Link
              href="https://seveneightfive.fillout.com/add-event"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#C80650] px-6 py-3 font-['Oswald'] text-sm font-bold uppercase tracking-widest text-white"
            >
              Submit Event
            </Link>
          </div>
        </div>

        {editorPick && (
          <Link href={href} className="group relative block overflow-hidden rounded-xl bg-neutral-900 shadow-2xl">
            <div className="relative aspect-video">
              {editorPick.image_url ? (
                <img
                  src={editorPick.image_url}
                  alt={editorPick.title}
                  className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-65"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-neutral-900 font-['Oswald'] text-8xl font-bold text-white/10">
                  785
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

              <div className="absolute left-5 top-5 bg-[#FFCE03] px-4 py-2 font-['Oswald'] text-sm font-bold uppercase tracking-widest text-black">
                Editor’s Pick
              </div>

              {date && (
                <div className="absolute bottom-6 left-6 bg-[#C80650] px-4 py-3 text-center font-['Oswald'] text-white">
                  <div className="text-xs font-bold uppercase tracking-widest">{date.weekday}</div>
                  <div className="text-4xl font-bold leading-none">{date.day}</div>
                  <div className="text-xs font-bold uppercase tracking-widest">{date.month}</div>
                </div>
              )}

              <div className="absolute bottom-7 left-32 right-6">
                <h2 className="font-['Oswald'] text-3xl font-bold uppercase leading-tight tracking-tight lg:text-4xl">
                  {editorPick.title}
                </h2>

                {venue?.name && (
                  <div className="mt-2 font-['Oswald'] text-lg font-bold uppercase text-[#FFCE03]">
                    {venue.name}
                  </div>
                )}

                <div className="mt-1 text-sm font-medium text-white/85">
                  {time}
                  {editorPick.ticket_price ? ` · $${editorPick.ticket_price}` : ''}
                </div>
              </div>
            </div>
          </Link>
        )}
      </div>
    </section>
  )
}
