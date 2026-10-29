// app/components/HomeHero.tsx
//
// Compact home hero: headline + Browse/Submit on the left, Featured Events
// carousel on the right (desktop) or directly below (mobile). Kept short on
// mobile so the first featured card is already peeking above the fold.
import Link from 'next/link'
import FeaturedCarousel from './FeaturedCarousel'
import type { FeaturedSlot } from '@/lib/featuredSlots'

export default function HomeHero({ slots }: { slots: FeaturedSlot[] }) {
  return (
    <section className="bg-[#0B0F1A] text-white">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-5 pb-7 pt-7 lg:flex-row lg:items-center lg:gap-14 lg:px-10 lg:pb-12 lg:pt-12">
        <div className="lg:w-[38%] lg:shrink-0">
          <div className="mb-3.5 h-1 w-10 bg-[#FFCE03] lg:mb-[18px] lg:w-12" />

          <h1 className="font-['Oswald'] text-[44px] font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-[68px]">
            Topeka
            <br />
            Arts, Music +
            <br />
            Culture
          </h1>

          <p className="mt-3.5 max-w-md text-[15px] leading-relaxed text-white/75 lg:mt-5 lg:text-[17px]">
            Find events, artists, venues, opportunities, and local creative happenings.
          </p>

          <div className="mt-5 flex gap-2.5 lg:mt-7 lg:gap-3">
            <Link
              href="/events"
              className="flex h-12 flex-1 items-center justify-center bg-[#FFCE03] px-6 font-['Oswald'] text-sm font-bold uppercase tracking-[0.14em] text-black transition hover:bg-[#ffd93a] lg:flex-none"
            >
              Browse Events
            </Link>
            <Link
              href="https://seveneightfive.fillout.com/add-event"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 flex-1 items-center justify-center bg-[#C80650] px-6 font-['Oswald'] text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#a8053f] lg:flex-none"
            >
              Submit Event
            </Link>
          </div>
        </div>

        {slots.length > 0 && (
          <div className="min-w-0 flex-1">
            <FeaturedCarousel slots={slots} />
          </div>
        )}
      </div>
    </section>
  )
}
