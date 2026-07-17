'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'
import { useTheme } from '@/context/ThemeContext'
import { createClient } from '@/lib/supabaseBrowser'
import {
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  ListIcon,
  PageIcon,
  PieChartIcon,
  TableIcon,
  UserCircleIcon,
} from '@/icons/index'
import { DollarSign, X, Phone, LogOut, Moon, Sun, ArrowLeft } from 'lucide-react'
import ContactModal from '@/components/common/ContactModal'
import type { HeaderUser } from '@/app/dashboard/DashboardShell'

/**
 * Sidebar — always-dark, always-static shell.
 *
 * Change in this version: the logo now links to the public site ("/")
 * instead of "/dashboard". On mobile there was previously no way back to
 * the regular site once you were in the dashboard — no visible nav item
 * pointed there. Logo-as-home-link is a common pattern but easy to miss,
 * so there's also now an explicit small "Back to site" link right below
 * it for anyone who wouldn't think to tap the logo.
 */

const LOGO_WHITE =
  'https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/785-Splash-512-White.png'

type SubItem = { name: string; path: string; pro?: boolean; new?: boolean }

type NavItem = {
  name: string
  icon: React.ReactNode
  path?: string
  subItems?: SubItem[]
  onClick?: () => void
}

const AppSidebar: React.FC<{ headerUser: HeaderUser | null }> = ({ headerUser }) => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar()
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [contactOpen, setContactOpen] = useState(false)
  const isGuest = !headerUser

  const createManageItems: NavItem[] = [
    { icon: <GridIcon />, name: 'Dashboard', path: '/dashboard' },
    { icon: <PageIcon />, name: 'My Pages', path: '/dashboard/pages' },
    { icon: <CalenderIcon />, name: 'Events', path: '/dashboard/events' },
    { icon: <CalenderIcon />, name: 'Save the Date', path: '/dashboard/save-the-date' },
    { icon: <PieChartIcon />, name: 'Advertise', path: '/dashboard/advertise' },
  ]

  const accountItems: NavItem[] = [
    { icon: <TableIcon />, name: 'My Tickets', path: '/dashboard/tickets' },
    { icon: <UserCircleIcon />, name: 'Following', path: '/dashboard/following' },
    { icon: <DollarSign className="w-5 h-5" />, name: 'Payouts', path: '/dashboard/payouts' },
    { icon: <ListIcon />, name: 'Settings', path: '/dashboard/settings' },
    {
      icon: <Phone className="w-5 h-5" />,
      name: 'Contact 785',
      onClick: () => setContactOpen(true),
    },
  ]

  type MenuType = 'create' | 'account'

  const [openSubmenu, setOpenSubmenu] = useState<{ type: MenuType; index: number } | null>(null)
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({})
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const isActive = useCallback(
    (path: string) => {
      if (path === '/dashboard') return pathname === '/dashboard'
      return pathname === path || pathname.startsWith(path + '/')
    },
    [pathname]
  )

  useEffect(() => {
    let matched = false
    const groups: Array<[MenuType, NavItem[]]> = [
      ['create', createManageItems],
      ['account', accountItems],
    ]
    groups.forEach(([type, items]) => {
      items.forEach((nav, index) => {
        nav.subItems?.forEach((sub) => {
          if (isActive(sub.path)) {
            setOpenSubmenu({ type, index })
            matched = true
          }
        })
      })
    })
    if (!matched) setOpenSubmenu(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isActive])

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }))
      }
    }
  }, [openSubmenu])

  const handleSubmenuToggle = (index: number, menuType: MenuType) => {
    setOpenSubmenu((prev) =>
      prev && prev.type === menuType && prev.index === index ? null : { type: menuType, index }
    )
  }

  const closeMobileMenu = () => {
    if (isMobileOpen) toggleMobileSidebar()
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const renderMenuItems = (items: NavItem[], menuType: MenuType) => (
    <ul className="flex flex-col gap-1">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? 'bg-white/10 text-white'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="shrink-0">{nav.icon}</span>
              <span className="flex-1">{nav.name}</span>
              <ChevronDownIcon
                className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? 'rotate-180 text-brand-400'
                    : 'text-gray-500'
                }`}
              />
            </button>
          ) : nav.onClick ? (
            <button
              type="button"
              onClick={() => {
                closeMobileMenu()
                nav.onClick?.()
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span className="shrink-0">{nav.icon}</span>
              <span>{nav.name}</span>
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                onClick={closeMobileMenu}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(nav.path)
                    ? 'bg-brand-600/20 text-white ring-1 ring-inset ring-brand-500/30'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`shrink-0 ${isActive(nav.path) ? 'text-brand-400' : 'text-gray-400'}`}>
                  {nav.icon}
                </span>
                <span>{nav.name}</span>
              </Link>
            )
          )}

          {nav.subItems && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : '0px',
              }}
            >
              <ul className="mt-1 space-y-1 py-1 pl-11">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive(subItem.path)
                          ? 'text-white font-semibold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {subItem.name}
                      {subItem.new && (
                        <span className="rounded bg-brand-600/30 px-1.5 py-0.5 text-[10px] uppercase text-brand-300">
                          new
                        </span>
                      )}
                      {subItem.pro && (
                        <span className="rounded bg-brand-600/30 px-1.5 py-0.5 text-[10px] uppercase text-brand-300">
                          pro
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  )

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
        {/* Logo — now links to the public site, not /dashboard */}
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

        {/* Explicit "back to site" link — the logo alone is an easy-to-miss
            affordance, so this spells it out for anyone who wouldn't
            think to tap it. */}
        <div className="border-b border-white/10 px-4 py-2.5">
          <Link
            href="/"
            onClick={closeMobileMenu}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to seveneightfive.com
          </Link>
        </div>

        {/* Nav */}
        <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-4 py-6">
          <nav className="flex flex-col gap-6">
            <div>
              <h2 className="mb-2 px-3 font-body text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Creator Hub
              </h2>
              {renderMenuItems(createManageItems, 'create')}
            </div>
            <div>
              <h2 className="mb-2 px-3 font-body text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Account
              </h2>
              {renderMenuItems(accountItems, 'account')}
            </div>
          </nav>
        </div>

        {/* Bottom: theme toggle + identity/sign-in */}
        <div className="border-t border-white/10 px-4 py-4">
          <button
            onClick={toggleTheme}
            className="mb-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
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
                <div className="truncate text-xs text-gray-500">{headerUser?.phoneOrEmail}</div>
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
