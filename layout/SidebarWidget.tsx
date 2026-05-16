import Link from 'next/link'
import React from 'react'

/**
 * Sidebar footer CTA. Shown only when the sidebar is expanded.
 *
 * Was TailAdmin's "Upgrade to Pro" widget — repurposed to push the public
 * Save-the-Date claim flow, which is a free entry point that works for both
 * guests and members. Swap the link/text whenever you want a different
 * dashboard-side promo (e.g. featured ad slot, paid plan, etc.).
 */
export default function SidebarWidget() {
  return (
    <div className="mx-auto mb-10 w-full max-w-60 rounded-2xl bg-gray-50 px-4 py-5 text-center dark:bg-white/[0.03]">
      <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
        Got a date locked in?
      </h3>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Claim it on the community calendar before the details are finalized — no
        account required.
      </p>
      <Link
        href="/save-the-date/new"
        className="flex items-center justify-center p-3 text-sm font-semibold rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900"
      >
        Claim a Date
      </Link>
    </div>
  )
}
