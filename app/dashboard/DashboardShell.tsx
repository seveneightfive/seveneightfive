'use client'
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
 * Simplified from the previous version: the sidebar is now a static
 * 290px column on desktop (no expand/collapse/hover states), so the
 * content margin is a fixed lg:ml-[290px] instead of a computed value.
 * headerUser now goes to AppSidebar (identity block + sign out live
 * there), not AppHeader.
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
        <AppHeader />
        <div className="mx-auto max-w-screen-2xl p-4 md:p-6">{children}</div>
      </div>
    </div>
  )
}
