'use client'

// app/components/FeaturedCarousel.tsx
//
// Home page "Featured Events" spotlight — five editorial slots (see
// lib/featuredSlots.ts), one card at a time.
//
// - Native horizontal scroll + scroll-snap, so swipe works everywhere and a
//   mostly-vertical gesture still scrolls the page (the browser decides).
// - Mobile: the next card peeks in from the right. Desktop (lg): compact
//   horizontal card, one per view, no peek.
// - Prev/next buttons, pagination dots, ← → keys, and an "01 / 05" counter.
// - No autoplay: the visitor controls every transition.
// - The whole card is one link (stretched over the card from the title);
//   Save is a separate button layered above it.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseBrowser'
import { formatTime } from './EventCard'
import type { FeaturedSlot, FeaturedSlotEvent, SlotKey } from '@/lib/featuredSlots'

const BADGE: Record<SlotKey, string> = {
  'editors-pick': 'bg-[#FFCE03] text-[#0B0F1A] shadow-[4px_4px_0_#C80650]',
  tonight: 'bg-[#C80650] text-white shadow-[4px_4px_0_#FFCE03]',
  weekend: 'bg-white text-[#0B0F1A] shadow-[4px_4px_0_#C80650]',
  'music-arts': 'bg-[#FFCE03] text-[#0B0F1A] shadow-[4px_4px_0_#C80650]',
  'free-family': 'bg-white text-[#0B0F1A] shadow-[4px_4px_0_#FFCE03]',
  'coming-up': 'bg-white text-[#0B0F1A] shadow-[4px_4px_0_#C80650]',
}

const pad = (n: number) => String(n).padStart(2, '0')

function dateParts(ymd: string) {
  const d = new Date(ymd.slice(0, 10) + 'T12:00:00')
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    long: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  }
}

function whenLabel(e: FeaturedSlotEvent, slotKey: SlotKey) {
  const start = formatTime(e.event_start_time)
  const end = formatTime(e.event_end_time)
  const time = start && end ? `${start} – ${end}` : start
  const endDate = e.end_date?.slice(0, 10)
  const day =
    slotKey === 'tonight'
      ? 'Tonight'
      : endDate && endDate > e.event_date.slice(0, 10)
        ? `${dateParts(e.event_date).long} – ${dateParts(endDate).long}`
        : dateParts(e.event_date).long
  const free = e.ticket_price === 0 ? ' · Free' : ''
  return [day, time].filter(Boolean).join(' · ') + free
}

function categoryLabel(e: FeaturedSlotEvent) {
  const labels = [...(e.event_types ?? []), ...(e.tags ?? [])]
  return Array.from(new Set(labels)).slice(0, 2).join(' · ')
}

// ── Save (user_favorites, same table as FollowFavoriteButtons) ─────────────
function useSavedEvents(ids: string[]) {
  const [userId, setUserId] = useState<string | null>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [pending, setPending] = useState<string | null>(null)
  const idKey = ids.join(',')

  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) return
      setUserId(user.id)
      const { data } = await supabase
        .from('user_favorites')
        .select('entity_id')
        .eq('user_id', user.id)
        .eq('entity_type', 'event')
        .in('entity_id', idKey.split(','))
      if (!mounted) return
      setSaved(Object.fromEntries((data ?? []).map((r: { entity_id: string }) => [r.entity_id, true])))
    })()
    return () => { mounted = false }
  }, [idKey])

  const toggle = async (eventId: string) => {
    if (!userId) { window.location.href = '/login'; return }
    if (pending) return
    setPending(eventId)
    const supabase = createClient()
    const isSaved = !!saved[eventId]
    setSaved(s => ({ ...s, [eventId]: !isSaved })) // optimistic
    const { error } = isSaved
      ? await supabase.from('user_favorites').delete()
          .eq('user_id', userId).eq('entity_type', 'event').eq('entity_id', eventId)
      : await supabase.from('user_favorites')
          .insert({ user_id: userId, entity_type: 'event', entity_id: eventId })
    if (error) setSaved(s => ({ ...s, [eventId]: isSaved })) // roll back
    setPending(null)
  }

  return { saved, toggle }
}

// ── Carousel ───────────────────────────────────────────────────────────────
export default function FeaturedCarousel({ slots }: { slots: FeaturedSlot[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const { saved, toggle } = useSavedEvents(slots.map(s => s.event.id))
  const count = slots.length

  const slideEls = () =>
    Array.from(trackRef.current?.querySelectorAll<HTMLElement>('[data-slide]') ?? [])

  const scrollPad = () => {
    const el = trackRef.current
    return el ? parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0 : 0
  }

  const goTo = useCallback((i: number) => {
    const el = trackRef.current
    const target = slideEls()[Math.max(0, Math.min(count - 1, i))]
    if (!el || !target) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: target.offsetLeft - scrollPad(), behavior: reduce ? 'auto' : 'smooth' })
  }, [count])

  // Keep the counter/dots in sync with wherever the scroll settles
  // (swipe, buttons, keyboard or trackpad all land here).
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const x = el.scrollLeft + scrollPad()
        let best = 0
        slideEls().forEach((s, i) => {
          if (Math.abs(s.offsetLeft - x) < Math.abs(slideEls()[best].offsetLeft - x)) best = i
        })
        setIndex(best)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1) }
  }

  if (!count) return null

  return (
    <section aria-roledescription="carousel" aria-label="Featured events" className="min-w-0" onKeyDown={onKeyDown}>
      {/* Header: label, position, arrows */}
      <div className="flex h-11 items-center justify-between">
        <h2 className="font-['Oswald'] text-[15px] font-semibold uppercase tracking-[0.16em] text-white/80">
          Featured Events
        </h2>
        <div className="flex items-center gap-1 lg:gap-2">
          <span aria-live="polite" className="mr-1 font-['Oswald'] text-[15px] font-semibold tracking-[0.1em] text-white lg:mr-2">
            {pad(index + 1)} / {pad(count)}
          </span>
          <ArrowButton dir="prev" disabled={index === 0} onClick={() => goTo(index - 1)} />
          <ArrowButton dir="next" disabled={index === count - 1} onClick={() => goTo(index + 1)} />
        </div>
      </div>

      {/* Track — bleeds to the screen edge on mobile so the next card peeks */}
      <div
        ref={trackRef}
        className="-mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 [scrollbar-width:none] lg:mx-0 lg:scroll-px-0 lg:gap-6 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {slots.map((slot, i) => (
          <div
            key={slot.event.id}
            data-slide
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            className="w-[calc(100%-32px)] shrink-0 snap-start lg:w-full"
          >
            <FeaturedCard
              slot={slot}
              active={i === index}
              saved={!!saved[slot.event.id]}
              onToggleSave={() => toggle(slot.event.id)}
            />
          </div>
        ))}
      </div>

      {/* Pagination dots */}
      <div className="mt-3 flex justify-center">
        {slots.map((slot, i) => (
          <button
            key={slot.event.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show event ${i + 1} of ${count}: ${slot.event.title}`}
            aria-current={i === index}
            className="flex h-7 min-w-[22px] items-center justify-center px-1"
          >
            <span
              className={`block rounded-full transition-all duration-300 ${
                i === index ? 'h-1.5 w-8 bg-[#FFCE03]' : 'h-[7px] w-[7px] bg-white/40'
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  )
}

function ArrowButton({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous event' : 'Next event'}
      className="grid h-11 w-11 place-items-center rounded-full text-white transition hover:bg-white/10 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent lg:border lg:border-white/30"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === 'prev' ? 'M19 12H5M11 6l-6 6 6 6' : 'M5 12h14M13 6l6 6-6 6'} />
      </svg>
    </button>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────
function FeaturedCard({
  slot,
  active,
  saved,
  onToggleSave,
}: {
  slot: FeaturedSlot
  active: boolean
  saved: boolean
  onToggleSave: () => void
}) {
  const e = slot.event
  const href = e.slug ? `/events/${e.slug}` : '/events'
  const date = dateParts(e.event_date)
  const category = categoryLabel(e)
  const tab = active ? 0 : -1 // only the visible card is in the tab order

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[18px] bg-white text-[#0B0F1A] focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-[3px] focus-within:outline-[#FFCE03] lg:min-h-[300px] lg:flex-row">
      {/* Photo */}
      <div className="relative h-44 shrink-0 bg-[#1a1f2b] lg:h-auto lg:w-[42%]">
        {e.image_url ? (
          <img
            src={e.image_url}
            alt=""
            loading={slot.key === 'editors-pick' ? 'eager' : 'lazy'}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-['Oswald'] text-7xl font-bold text-white/10">785</div>
        )}

        <span className={`absolute left-3.5 top-3.5 px-2.5 py-1.5 font-['Oswald'] text-[13px] font-bold uppercase tracking-[0.12em] lg:left-4 lg:top-4 ${BADGE[slot.key]}`}>
          {slot.label}
        </span>

        <button
          type="button"
          tabIndex={tab}
          onClick={onToggleSave}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${e.title} from saved events` : `Save ${e.title}`}
          className="absolute right-2.5 top-2.5 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/40 bg-[#0B0F1A]/60 text-white backdrop-blur-sm transition hover:bg-[#0B0F1A]/80 lg:right-3 lg:top-3"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? '#FFCE03' : 'none'} stroke={saved ? '#FFCE03' : 'currentColor'} strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3h12v18l-6-4-6 4z" />
          </svg>
        </button>
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col gap-3.5 p-[18px] lg:gap-4 lg:px-[26px] lg:py-6">
        <div className="flex items-start gap-3.5 lg:gap-4">
          <div className="w-[60px] shrink-0 bg-[#C80650] pb-[7px] pt-2 text-center font-['Oswald'] font-bold text-white lg:w-16">
            <div className="text-[11px] tracking-[0.14em]">{date.weekday}</div>
            <div className="text-[30px] leading-none lg:text-[32px]">{date.day}</div>
            <div className="text-[11px] tracking-[0.14em]">{date.month}</div>
          </div>
          <div className="min-w-0">
            {category && (
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C80650]">{category}</div>
            )}
            <h3 className="mt-1 font-['Oswald'] text-[28px] font-bold uppercase leading-none lg:mt-1.5 lg:text-[34px]">
              {/* Stretched link: its ::after covers the whole card */}
              <Link
                href={href}
                tabIndex={tab}
                className="line-clamp-3 after:absolute after:inset-0 after:z-[1] after:rounded-[18px] focus:outline-none"
              >
                {e.title}
              </Link>
            </h3>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-[#E6E3DC] pt-3">
          <InfoRow label="When" value={whenLabel(e, slot.key)} icon="calendar" />
          {e.venue?.name && <InfoRow label="Where" value={e.venue.name} icon="pin" />}
        </div>

        <span
          aria-hidden="true"
          className="mt-auto flex h-11 items-center justify-between rounded-[10px] bg-[#C80650] px-4 font-['Oswald'] text-sm font-bold uppercase tracking-[0.14em] text-white transition group-hover:bg-[#A8053F] lg:gap-3.5 lg:self-start lg:px-[18px]"
        >
          View event details
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </article>
  )
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: 'calendar' | 'pin' }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#FBEAF0] text-[#C80650]">
        {icon === 'calendar' ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
          </svg>
        )}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5B6170]">{label}</div>
        <div className="text-[15px] font-semibold leading-snug">{value}</div>
      </div>
    </div>
  )
}
