'use client'
import { useSidebar } from '@/context/SidebarContext'
import { Menu } from 'lucide-react'

export default function MobileMenuBar() {
  const { toggleMobileSidebar } = useSidebar()
  return (
    <div className="sticky top-0 z-30 flex items-center border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 lg:hidden">
      <button
        onClick={() => toggleMobileSidebar()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>
    </div>
  )
}
