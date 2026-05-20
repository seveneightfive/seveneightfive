'use client'

import { useEffect } from 'react'
import { Mail, Phone, X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * Contact 785 modal.
 *
 * Triggered from the sidebar's "Contact 785" nav entry. Renders a small modal
 * with email + phone as tappable rows (mailto: / tel: links).
 *
 * Implementation notes:
 *   - Closes on Escape and on backdrop click.
 *   - Locks body scroll while open.
 *   - z-index sits above the sidebar (which uses z-50) and the header
 *     (which uses z-99999). We use z-[100000] to outrank the header.
 *   - Brand colours come from your Tailwind config (`brand-50`, `brand-600`,
 *     etc.). Adjust if your palette uses different tokens.
 */
export default function ContactModal({ open, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
        style={{ animation: 'contactModalIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="border-b border-gray-200 px-7 pb-4 pt-6 dark:border-gray-800">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">
            Get in Touch
          </div>
          <h2
            id="contact-modal-title"
            className="font-display text-2xl font-semibold uppercase tracking-wide text-gray-900 dark:text-white"
          >
            Contact 785 Magazine
          </h2>
        </div>

        {/* Contact rows */}
        <div className="px-5 py-5">
          <a
            href="mailto:kerrice@seveneightfive.com"
            className="flex items-center gap-4 rounded-xl px-4 py-3 transition hover:bg-gray-50 dark:hover:bg-white/[0.04]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Mail className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                Email
              </span>
              <span className="block truncate text-[15px] font-medium text-gray-900 dark:text-white">
                kerrice@seveneightfive.com
              </span>
            </span>
          </a>

          <a
            href="tel:7852493126"
            className="mt-1 flex items-center gap-4 rounded-xl px-4 py-3 transition hover:bg-gray-50 dark:hover:bg-white/[0.04]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Phone className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                Phone
              </span>
              <span className="block text-[15px] font-medium text-gray-900 dark:text-white">
                785-249-3126
              </span>
            </span>
          </a>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-7 py-3 text-center text-xs text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
          We typically respond within one business day.
        </div>
      </div>

      {/* Scoped keyframe — kept inline so this component drops in without
          requiring tailwind.config or global-css edits */}
      <style jsx>{`
        @keyframes contactModalIn {
          from {
            transform: scale(0.96) translateY(8px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
