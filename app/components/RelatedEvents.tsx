// components/RelatedEvents.tsx
import Link from 'next/link'
import Image from 'next/image'

type Event = {
  id: string
  title: string
  slug: string
  start_date: string
  cover_image?: string
  category: string
  venue: { name: string }
}

export default function RelatedEvents({ events }: { events: Event[] }) {
  return (
    <section className="mt-16 border-t pt-10">
      <h2 className="text-xl font-semibold mb-6">Other events you might like</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/event/${event.slug}`}
            className="group rounded-xl border overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Cover image */}
            <div className="relative h-40 w-full bg-gray-100">
              {event.cover_image ? (
                <Image
                  src={event.cover_image}
                  alt={event.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  No image
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {event.category}
              </p>
              <h3 className="font-semibold text-gray-900 group-hover:text-red-600 transition-colors line-clamp-2">
                {event.title}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(event.start_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              <p className="text-sm text-gray-400">{event.venue?.name}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}