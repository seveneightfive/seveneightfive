'use client'

// app/discover/OpportunityBoard.tsx
//
// "Opportunities & Announcements" on the Discover page. Each row opens a
// popup with the full information and a button for more info (apply link,
// email, or the announcement's "learn more" link).
//
// Uses the native <dialog> element: focus moves into it, Escape closes it,
// and focus returns to the row that opened it. Bottom sheet on phones,
// centered card from sm up. Clicking the dimmed backdrop also closes it.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export type BoardItem = {
  id: string
  kind: 'opportunity' | 'announcement'
  typeLabel: string
  /** Pill colors */
  tint: string
  ink: string
  title: string
  org: string | null
  /** One line under the title in the list */
  meta: string
  /** Full text shown in the popup */
  body: string | null
  details: { label: string; value: string }[]
  image: string | null
  cta: { label: string; href: string; external: boolean } | null
}

export default function OpportunityBoard({ items }: { items: BoardItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const item = items.find(i => i.id === openId) ?? null

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (item && !d.open) d.showModal()
    if (!item && d.open) d.close()
  }, [item])

  const close = () => setOpenId(null)

  return (
    <section aria-labelledby="opps-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="opps-heading" className="font-['Oswald'] text-2xl font-bold uppercase leading-none lg:text-[28px]">
          Opportunities &amp; Announcements
        </h2>
        <Link href="/opportunities" className="whitespace-nowrap font-['Oswald'] text-[13px] font-semibold uppercase tracking-[0.1em] text-[#C80650] hover:underline">
          All →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-dashed border-[#D6D2C8] bg-white px-4 py-4">
          <p className="text-[15px] text-neutral-700">No open calls right now. Have an opportunity to share?</p>
          <Link
            href="/opportunities/submit"
            className="inline-flex h-11 items-center rounded-[10px] bg-[#0A0A0A] px-4 font-['Oswald'] text-[13px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#C80650]"
          >
            Post an opportunity
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
          {items.map(i => (
            <li key={i.id}>
              <button
                type="button"
                onClick={e => { openerRef.current = e.currentTarget; setOpenId(i.id) }}
                aria-haspopup="dialog"
                className="flex w-full items-center gap-3 rounded-[14px] border-[1.5px] border-[#E6E3DC] bg-white py-3.5 pl-3.5 pr-3 text-left text-[#0A0A0A] transition hover:border-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C80650]"
              >
                <span className="min-w-0 flex-1">
                  <span
                    className="inline-block rounded-md px-2 py-[3px] text-[11px] font-bold uppercase tracking-[0.08em]"
                    style={{ background: i.tint, color: i.ink }}
                  >
                    {i.typeLabel}
                  </span>
                  <span className="mt-1.5 block text-base font-bold leading-snug">{i.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-neutral-600">{i.meta}</span>
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-500" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="opp-dialog-title"
        onClose={() => { setOpenId(null); openerRef.current?.focus() }}
        onClick={e => { if (e.target === e.currentTarget) close() }}
        className="m-0 mt-auto max-h-[88vh] w-full max-w-none overflow-hidden rounded-t-[20px] bg-white p-0 text-[#0A0A0A] shadow-2xl backdrop:bg-black/60 sm:m-auto sm:max-w-[560px] sm:rounded-[20px]"
      >
        {item && (
          <div className="flex max-h-[88vh] flex-col">
            {item.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt="" className="h-44 w-full shrink-0 object-cover sm:h-52" />
            )}

            <div className="overflow-y-auto px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <span
                  className="inline-block rounded-md px-2 py-[3px] text-[11px] font-bold uppercase tracking-[0.08em]"
                  style={{ background: item.tint, color: item.ink }}
                >
                  {item.typeLabel}
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-black"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <h3 id="opp-dialog-title" className="mt-1 font-['Oswald'] text-[28px] font-bold uppercase leading-[1.05]">
                {item.title}
              </h3>
              {item.org && <p className="mt-1 text-sm font-semibold text-neutral-600">{item.org}</p>}

              {item.details.length > 0 && (
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 border-y border-[#E6E3DC] py-3.5 sm:grid-cols-2">
                  {item.details.map(d => (
                    <div key={d.label}>
                      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">{d.label}</dt>
                      <dd className="text-[15px] font-semibold">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {item.body && (
                <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-neutral-800">{item.body}</p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2.5 border-t border-[#E6E3DC] px-5 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-4 sm:px-7 sm:pb-5">
              {item.cta && (
                <a
                  href={item.cta.href}
                  target={item.cta.external ? '_blank' : undefined}
                  rel={item.cta.external ? 'noopener noreferrer' : undefined}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#C80650] px-5 font-['Oswald'] text-sm font-bold uppercase tracking-[0.12em] text-white hover:bg-[#A8053F] sm:flex-none"
                >
                  {item.cta.label}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {item.cta.external
                      ? <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                      : <path d="M5 12h14M13 6l6 6-6 6" />}
                  </svg>
                </a>
              )}
              <Link
                href="/opportunities"
                className="inline-flex h-12 items-center justify-center rounded-[10px] border-[1.5px] border-[#0A0A0A] px-5 font-['Oswald'] text-sm font-bold uppercase tracking-[0.12em] hover:bg-[#FFCE03]"
              >
                All opportunities
              </Link>
            </div>
          </div>
        )}
      </dialog>
    </section>
  )
}
