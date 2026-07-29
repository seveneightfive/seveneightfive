'use client'
import AppSidebar from '@/layout/AppSidebar'
import Backdrop from '@/layout/Backdrop'
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
 * Content area also widens: mockup uses more of the available desktop
 * real estate than the old max-w-screen-2xl + p-4/p-6 wrapper allowed.
 * Padding increases slightly at the top since there's no header bar
 * anymore to create natural breathing room before the content starts.
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
        <div className="mx-auto max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
          {children}
        </div>
      </div>
    </div>
  )
}
