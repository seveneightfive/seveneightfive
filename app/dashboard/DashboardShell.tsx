'use client'
import AppSidebar from '@/layout/AppSidebar'
import Backdrop from '@/layout/Backdrop'
import MobileMenuBar from '@/layout/MobileMenuBar'
import React from 'react'

export type HeaderUser = {
  fullName: string
  phoneOrEmail: string
  avatarUrl: string | null
  initials: string
}

/**
 * Client shell for /dashboard/*.
 *
 * CHANGE (this pass): AppHeader (the separate top bar with its own
 * title/subtitle) is gone. Every dashboard page already renders its own
 * eyebrow + H1 + description at the top of its content (Save the Date,
 * Event Manager, Advertising, etc. all do this) — so the old AppHeader
 * was duplicating that same heading in a second bar above it, which is
 * exactly the double "SAVE THE DATE" you'd see stacked on that page.
 *
 * FIX: AppHeader was also the only place with the hamburger button that
 * opens AppSidebar on mobile. Removing it left mobile with no way to
 * reach the nav at all. MobileMenuBar restores just that trigger, with
 * no title/subtitle, so the duplicate-heading issue doesn't come back.
 *
 * Content area also widens: mockup uses more of the available desktop
 * real estate than the old max-w-screen-2xl + p-4/p-6 wrapper allowed.
 */
export default function DashboardShell({
  children,
  headerUser,
}: {
  children: React.ReactNode
  headerUser: HeaderUser | null
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 xl:flex">
      <AppSidebar headerUser={headerUser} />
      <Backdrop />
      <div className="flex-1 lg:ml-[290px]">
        <MobileMenuBar />
        <div className="mx-auto max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
          {children}
        </div>
      </div>
    </div>
  )
}
