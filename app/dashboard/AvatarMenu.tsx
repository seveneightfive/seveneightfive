'use client'

import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Settings,
  LogOut,
} from 'lucide-react'

type Props = {
  initials: string
  fullName: string
  phoneOrEmail: string
  avatarUrl?: string | null
}

/**
 * Top-right avatar menu inside AppHeader.
 *
 * Behaviour preserved from the original implementation:
 *  - Click avatar → toggle menu
 *  - Click outside → close menu
 *  - Supabase auth signOut + router push on sign out
 *  - Avatar shows uploaded image if avatarUrl present, otherwise initials on
 *    a brand-magenta circle
 *
 * Visual changes:
 *  - All styling moved from inline styles to Tailwind so the menu responds
 *    to the dashboard's dark/light theme toggle. Inline styles never read
 *    the .dark class on <html>; Tailwind dark: variants do.
 *  - Emoji icons replaced with lucide-react icons. Emojis render
 *    inconsistently across OSes / older browsers and clashed visually with
 *    the rest of the TailAdmin icon set.
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

  const menuItems = [
    { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
  ]

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
          {/* User block */}
          <div className="border-b border-gray-200 px-4 pb-3 pt-3.5 dark:border-gray-800">
            <div className="font-display text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">
              {fullName}
            </div>
            <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {phoneOrEmail}
            </div>
          </div>

          {/* Items */}
          <div className="py-1">
            {menuItems.map(({ icon: Icon, label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]"
                role="menuitem"
              >
                <Icon className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                <span>{label}</span>
              </Link>
            ))}
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
