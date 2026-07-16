'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Issue } from './page'

export default function MagazineArchiveClient({ issues }: { issues: Issue[] }) {
  const [open, setOpen] = useState<Issue | null>(null)

  // Lock body scroll while the fullscreen viewer is open, and let Esc close it.
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      {/* Gallery grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {issues.map((issue) => (
          <button
            key={issue.id}
            type="button"
            onClick={() => setOpen(issue)}
            className="group text-left"
          >
            <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-lg dark:border-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={issue.cover_image_url}
                alt={issue.title}
                className="aspect-[0.77/1] w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="mt-2">
              {issue.issue_number && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                  Issue {issue.issue_number}
                </p>
              )}
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {issue.title}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Fullscreen flipbook viewer */}
      {open && (
        <div className="fixed inset-0 z-[100] bg-black">
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <iframe
            src={open.flipbook_url}
            title={open.title}
            allowFullScreen
            allow="clipboard-write"
            className="h-full w-full border-0"
          />
        </div>
      )}
    </>
  )
}
