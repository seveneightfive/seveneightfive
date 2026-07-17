'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'
import { Menu } from 'lucide-react'

/**
 * Top bar for the dashboard shell.
 *
 * This used to hold the sidebar toggle, a static "Creator Hub" label, the
 * theme toggle, and the avatar menu. All of that has moved:
 *  - Sidebar toggle → mobile-only hamburger here, since desktop nav is now
 *    static and never needs toggling.
 *  - Theme toggle + avatar/sign-out → moved into AppSidebar.
 *
 * What's left is a real page header: a title + one-line description for
 * whatever section of the dashboard you're in (mirrors the "Account
 * Settings — manage your account, notifications, and preferences" pattern
 * from the reference screenshot), plus the persistent "+ Create New"
 * shortcut.
 */

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: "Here's what's happening across your events and pages.",
  },
  '/dashboard/events': {
    title: 'Events',
    subtitle: "Events you're hosting or selling tickets for.",
  },
  '/dashboard/tickets': {
    title: 'My Tickets',
    subtitle: 'Events and tickets you have purchased.',
  },
  '/dashboard/following': {
    title: 'Following',
    subtitle: 'Artists and venues you follow.',
  },
  '/dashboard/payouts': {
    title: 'Payouts',
    subtitle: 'Manage how and when you get paid.',
  },
  '/dashboard/settings': {
    title: 'Account Settings',
    subtitle: 'Manage your account, notifications, and preferences.',
  },
  '/dashboard/advertise': {
    title: 'Advertise',
    subtitle: 'Promote your event, page, or brand on 785.',
  },
  '/dashboard/edit': {
    title: 'Artist Page',
    subtitle: 'Manage your public artist profile.',
  },
  '/dashboard/venue': {
    title: 'Venue Page',
    subtitle: 'Manage your venue profile.',
  },
  '/dashboard/pages': {
    title: 'My Pages',
    subtitle: 'Pages you manage on 785.',
  },
  '/dashboard/appearances': {
    title: 'Appearances',
    subtitle: 'Upcoming shows linked to your artist page.',
  },
  '/dashboard/save-the-date': {
    title: 'Save the Date',
    subtitle: 'Post a placeholder event before all the details are locked in.',
  },
}

function getPageMeta(pathname: string) {
  const keys = Object.keys(PAGE_META).sort((a, b) => b.length - a.length)
  const match = keys.find((k) => pathname === k || pathname.startsWith(k + '/'))
  return match ? PAGE_META[match] : PAGE_META['/dashboard']
}

const AppHeader: React.FC = () => {
  const { toggleMobileSidebar } = useSidebar()
  const pathname = usePathname()
  const { title, subtitle } = getPageMeta(pathname)

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3 px-4 py-4 md:px-6">
        <button
          onClick={() => toggleMobileSidebar()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white sm:text-xl">
            {title}
          </h1>
          <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>

        <Link
          href="/dashboard/events/edit"
          className="hidden shrink-0 items-center rounded-lg bg-brand-600 px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-brand-700 sm:inline-flex"
        >
          + Create New
        </Link>
      </div>
    </header>
  )
}

export default AppHeader
