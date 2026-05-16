'use client'

import { useSidebar } from '@/context/SidebarContext'
import AppHeader from '@/layout/AppHeader'
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
 * This is the only client-side piece between the server layout and the page —
 * it owns the responsive margin math that pushes the main content right when
 * the sidebar is expanded.
 */
export default function DashboardShell({
  children,
  headerUser,
}: {
  children: React.ReactNode
  headerUser: HeaderUser | null
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar()

  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isExpanded || isHovered
    ? 'lg:ml-[290px]'
    : 'lg:ml-[90px]'

  return (
    <div className="min-h-screen xl:flex bg-surface-light dark:bg-surface-dark">
      <AppSidebar />
      <Backdrop />
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        <AppHeader headerUser={headerUser} />
        <div className="p-4 mx-auto max-w-screen-2xl md:p-6">
  {children}
</div>
      </div>
    </div>
  )
}
