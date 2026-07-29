'use client'
import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'
import { useTheme } from '@/context/ThemeContext'
import { createClient } from '@/lib/supabaseBrowser'
import { X, Phone, LogOut, Moon, Sun } from 'lucide-react'
import ContactModal from '@/components/common/ContactModal'
import type { HeaderUser } from '@/app/dashboard/DashboardShell'

/**
 * Sidebar — rebuilt to match the mockup's visual language while keeping
 * this codebase's actual logo, routes, and Supabase-driven auth/user data.
 *
 * What changed vs. the previous version:
 *  - Flat single-level nav (no "Creator Hub" / "Account" section headers,
 *    no collapsible submenus) — matches the mockup's 5-item list.
 *  - Active item is a solid yellow pill with black text, plus a thin
 *    magenta accent bar on the left edge (mockup detail) — replaces the
 *    old translucent-brand-ring active state.
 *  - Dark Mode row now uses a moon/sun icon + a real pill toggle switch
 *    instead of a plain button, matching the mockup's switch control.
 *  - "My Tickets" / "Following" / "Contact 785" (previously a separate
 *    "Account" group) are folded into the same flat list, since the
 *    mockup doesn't have a second grouped section. Payouts and Settings
 *    stay as-is.
 *  - Logo is untouched — still your existing image, still links to "/".
 *    No yellow badge added (kept as your actual logo per your last note).
 *  - User row: avatar + name + sign-out icon only, no phone/email line
 *    (unchanged from the previous pass).
 */

const LOGO_WHITE =
  'https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/785-Splash-512-White.png'

type NavItem = {
  name: string
  path?: string
  onClick?: () => void
}

const AppSidebar: React.FC<{ headerUser: HeaderUser | null }> = ({ headerUser }) => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar()
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [contactOpen, setContactOpen] = useState(false)
  const isGuest = !headerUser

  // Flat nav — matches the mockup's single list, no grouping headers.
  const navItems: NavItem[] = [
    { name: 'My Pages', path: '/dashboard/pages' },
    { name: 'Save the Date', path: '/dashboard/save-the-date' },
    { name: 'Event Manager', path: '/dashboard/events' },
    { name: 'Advertising', path: '/dashboard/advertise' },
    { name: 'My Tickets', path: '/dashboard/tickets' },
    { name: 'Following', path: '/dashboard/following' },
    { name: 'Payouts', path: '/dashboard/payouts' },
    { name: 'Settings', path: '/dashboard/settings' },
    { name: 'Contact 785', onClick: () => setContactOpen(true) },
  ]

  const isActive = useCallback(
    (path: string) => {
      if (path === '/dashboard') return pathname === '/dashboard'
      return pathname === path || pathname.startsWith(path + '/')
    },
    [pathname]
  )

  const closeMobileMenu = () => {
    if (isMobileOpen) toggleMobileSidebar()
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => toggleMobileSidebar()}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-white/10 bg-gray-950 transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'w-screen max-w-none translate-x-0' : 'w-[290px] -translate-x-full'}
          lg:w-[290px] lg:translate-x-0
        `}
      >
        {/* Logo — unchanged image, links to public site */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <Link href="/" className="flex items-center" onClick={closeMobileMenu}>
            <Image
              src={LOGO_WHITE}
              alt="785 Magazine — back to seveneightfive.com"
              width={140}
              height={56}
              priority
              unoptimized
              className="h-11 w-auto"
            />
          </Link>
          <button
            onClick={() => toggleMobileSidebar()}
            className="text-gray-400 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Nav — flat list, mockup active-state treatment */}
        <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-4 py-6">
          <ul className="flex flex-col gap-1">
            {navItems.map((nav) => {
              const active = nav.path ? isActive(nav.path) : false
              const baseCls =
                'relative flex w-full items-center rounded-md px-3 py-2.5 text-left font-display text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors'
              const activeCls = active
                ? 'bg-accent-500 text-gray-950'
                : 'text-white/70 hover:bg-white/5 hover:text-white'

              const content = (
                <>
                  {/* Magenta accent bar on the active item's left edge */}
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-600 transition-opacity ${
                      active ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  {nav.name}
                </>
              )

              if (nav.onClick) {
                return (
                  <li key={nav.name}>
                    <button
                      type="button"
                      onClick={() => {
                        closeMobileMenu()
                        nav.onClick?.()
                      }}
                      className={`${baseCls} ${activeCls}`}
                    >
                      {content}
                    </button>
                  </li>
                )
              }

              return (
                <li key={nav.name}>
                  <Link
                    href={nav.path!}
                    onClick={closeMobileMenu}
                    className={`${baseCls} ${activeCls}`}
                  >
                    {content}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Dark Mode row — moon/sun icon + pill switch, mockup style */}
        <div className="border-t border-white/10 px-4 py-4">
          <button
            onClick={toggleTheme}
            className="mb-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/5"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="flex-1 text-left">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            <span
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                theme === 'dark' ? 'bg-accent-500' : 'bg-white/15'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  theme === 'dark' ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>

          {isGuest ? (
            <div className="flex gap-2">
              <Link
                href="/login"
                className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-center text-sm font-semibold text-gray-200 transition hover:bg-white/5"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Sign Up
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3 border-t border-white/10 pt-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ${
                  headerUser?.avatarUrl ? '' : 'bg-brand-600'
                }`}
              >
                {headerUser?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={headerUser.avatarUrl}
                    alt={headerUser.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-display text-xs font-bold uppercase text-white">
                    {headerUser?.initials}
                  </span>
                )}
              </div>
              {/* Name only — no phone/email line */}
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-bold uppercase tracking-wide text-white">
                  {headerUser?.fullName}
                </div>
              </div>
              <button
                onClick={handleLogout}
                aria-label="Sign out"
                className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  )
}

export default AppSidebar
