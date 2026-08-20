'use client'
import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'
import { useTheme } from '@/context/ThemeContext'
import { createClient } from '@/lib/supabaseBrowser'
import { X, LogOut, Moon, Sun } from 'lucide-react'
import ContactModal from '@/components/common/ContactModal'
import type { HeaderUser } from '@/app/dashboard/DashboardShell'

/**
 * Sidebar — matches the mockup's full visual spec this pass:
 *
 *  - Brand block: 36×36 yellow rounded-square badge with "785" in black,
 *    plus "SEVENEIGHTFIVE" wordmark and a small magenta dot, replacing
 *    the plain logo image. Still links to "/". (Per explicit request
 *    this time — the earlier "keep the plain logo" instruction is
 *    superseded by this pass's reference screenshot.)
 *  - Nav items: stronger Oswald weight, more letter-spacing, more
 *    vertical breathing room between items — matches the mockup's
 *    denser-but-clearer type treatment.
 *  - Footer block added: a "Contact" link (opens the existing
 *    ContactModal, same one previously reachable from the nav list)
 *    plus a copyright line, pinned below the user row. Terms/Privacy/
 *    Help are left out — those pages don't exist on the site yet, so
 *    there's nothing real to link to. Add them here once they do.
 *  - Dark Mode row and user row (avatar + name + sign-out, no phone)
 *    unchanged from the previous pass.
 *  - No top AppHeader bar anymore (removed in DashboardShell) — the
 *    sidebar is now the only persistent chrome, matching the mockup.
 *
 * CHANGE (this pass): "My Pages" nav item removed and replaced with a
 * "Dashboard" item that links back to /dashboard (the top-level
 * dashboard overview page). Page management now happens from the
 * "Manage your listing" card on that overview page instead of its own
 * nav entry.
 */

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

  const navItems: NavItem[] = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Save the Date', path: '/dashboard/save-the-date' },
    { name: 'Event Manager', path: '/dashboard/events' },
    { name: 'Advertising', path: '/dashboard/advertise' },
    { name: 'My Tickets', path: '/dashboard/tickets' },
    { name: 'Following', path: '/dashboard/following' },
    { name: 'Payouts', path: '/dashboard/payouts' },
    { name: 'Settings', path: '/dashboard/settings' },
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
        className={`fixed top-0 left-0 z-50 flex h-screen flex-col bg-gray-950 transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'w-screen max-w-none translate-x-0' : 'w-[290px] -translate-x-full'}
          lg:w-[290px] lg:translate-x-0
        `}
      >
        {/* Brand block — yellow "785" badge + wordmark, mockup style */}
        <div className="flex items-center justify-between px-5 py-6">
          <Link href="/" className="flex items-center gap-3" onClick={closeMobileMenu}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500">
              <span className="font-display text-[15px] font-bold text-gray-950">785</span>
            </span>
            <span className="flex items-center gap-1.5 font-display text-[17px] font-bold tracking-[0.16em] text-white">
              SEVENEIGHTFIVE
              <span className="mb-2 h-[7px] w-[7px] rounded-full bg-brand-600" />
            </span>
          </Link>
          <button
            onClick={() => toggleMobileSidebar()}
            className="text-gray-400 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Nav — flat list, stronger Oswald weight + more spacing */}
        <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-4 py-2">
          <ul className="flex flex-col gap-2">
            {navItems.map((nav) => {
              const active = nav.path ? isActive(nav.path) : false
              const baseCls =
                'relative flex w-full items-center rounded-md px-3 py-3 text-left font-display text-[14px] font-bold uppercase tracking-[0.1em] transition-colors'
              const activeCls = active
                ? 'bg-accent-500 text-gray-950'
                : 'text-white/70 hover:bg-white/5 hover:text-white'

              const content = (
                <>
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

        {/* Dark Mode row */}
        <div className="border-t border-white/10 px-4 py-4">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/5"
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
        </div>

        {/* User row */}
        <div className="border-t border-white/10 px-4 py-4">
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
            <div className="flex items-center gap-3">
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

        {/* Footer — Contact opens the existing modal (reused from the nav
            list above). Terms/Privacy/Help omitted: those pages don't
            exist on the site yet, so there's nothing to link to until
            they're built. Add them here once real routes exist. */}
        <div className="border-t border-white/10 px-5 py-5">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="transition hover:text-gray-300"
            >
              Contact
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            © {new Date().getFullYear()} Seveneightfive.
          </p>
        </div>
      </aside>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  )
}

export default AppSidebar
