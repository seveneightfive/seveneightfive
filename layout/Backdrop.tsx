'use client'

import { useSidebar } from '@/context/SidebarContext'
import React from 'react'

/**
 * Mobile-only sidebar dimmer. Tapping the dimmed area closes the drawer.
 * Unchanged from TailAdmin's stock Backdrop.
 */
const Backdrop: React.FC = () => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar()

  if (!isMobileOpen) return null

  return (
    <div
      className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
      onClick={toggleMobileSidebar}
    />
  )
}

export default Backdrop
