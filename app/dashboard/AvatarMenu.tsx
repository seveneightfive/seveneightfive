'use client'

import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { LogOut } from 'lucide-react'

type Props = {
  initials: string
  fullName: string
  phoneOrEmail: string
  avatarUrl?: string | null
}

/**
 * Top-right avatar menu inside AppHeader.
 *
 * Behaviour preserved from the previous implementation:
 *  - Click avatar → toggle menu
 *  - Click outside → close menu
 *  - Supabase auth signOut + router push on sign out
 *  - Avatar shows uploaded image if avatarUrl present, otherwise initials on
 *    a brand-magenta circle
 *
 * Change in this version:
 *  - Removed the "Settings" link. Settings now lives in the sidebar's
 *    Account group, so the dropdown link was redundant. The dropdown still
 *    shows the user identity block + Sign Out, which is the minimum
 *    "who am I / get out" affordance people expect from an avatar.
 *  - Removed the menuItems array and the Link import (both now unused).
 *  - Removed the Settings icon import.
 */
export default function AvatarMenu({
  initials,
  fullName,
  phoneOrEmail,
  avatarUrl,
}: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Avatar button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 transition ${
          open
            ? 'border-brand-600/50 dark:border-brand-400/50'
            : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
        } ${avatarUrl ? 'bg-transparent' : 'bg-brand-600'}`}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={fullName}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-display text-xs font-bold uppercase text-white">
            {initials}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+10px)] z-[300] w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
          role="menu"
        >
          {/* User identity block */}
          <div className="px-4 pb-3 pt-3.5">
            <div className="font-display text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">
              {fullName}
            </div>
            <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {phoneOrEmail}
            </div>
          </div>

          {/* Sign out */}
          <div className="border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
              role="menuitem"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="font-semibold">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
