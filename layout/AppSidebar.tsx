'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'
import {
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
  UserCircleIcon,
} from '@/icons/index'
import { DollarSign, X, Phone } from 'lucide-react'
import SidebarWidget from './SidebarWidget'
import ContactModal from '@/components/common/ContactModal'

/**
 * Sidebar with action-oriented IA:
 *
 *   CREATE + MANAGE: Dashboard, My Pages, Events, Save the Date, Advertise, Payouts
 *   ACCOUNT:         My Tickets, Following, Settings, Contact 785, Sign Out
 *
 * Logo: links to the public seveneightfive.com homepage (was /dashboard,
 * which was redundant — clicking the logo while *on* the dashboard did
 * nothing useful). Now it lets people pop back to the public magazine.
 *
 * Logo source: served from Supabase storage at the URL below. This was
 * confirmed working; the previous `/images/logo/*.png` paths weren't
 * resolving in production.
 */

cconst LOGO_BLACK =
  'https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/785%20BG%20MAGAZINE.png'

const LOGO_WHITE =
  'https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/785-Splash-512-White.png'

type NavItem = {
  name: string
  icon: React.ReactNode
  path?: string
  subItems?: SubItem[]
  onClick?: () => void
}

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleMobileSidebar } = useSidebar()
  const pathname = usePathname()
  const [contactOpen, setContactOpen] = useState(false)

  const createManageItems: NavItem[] = [
    { icon: <GridIcon />, name: 'Dashboard', path: '/dashboard' },
    {
      icon: <PageIcon />,
      name: 'My Pages',
      subItems: [
        { name: 'Artist Page', path: '/dashboard/edit' },
        { name: 'Venue Page', path: '/dashboard/venue' },
        { name: 'Appearances', path: '/dashboard/appearances' },
      ],
    },
    { icon: <CalenderIcon />, name: 'Events', path: '/dashboard/events' },
    { icon: <CalenderIcon />, name: 'Save the Date', path: '/save-the-date' },
    { icon: <PieChartIcon />, name: 'Advertise', path: '/dashboard/advertise' },
    {
      icon: <DollarSign className="w-5 h-5" />,
      name: 'Payouts',
      path: '/dashboard/payouts',
    },
  ]

  const accountItems: NavItem[] = [
    { icon: <TableIcon />, name: 'My Tickets', path: '/dashboard/tickets' },
    { icon: <UserCircleIcon />, name: 'Following', path: '/dashboard/following' },
    { icon: <ListIcon />, name: 'Settings', path: '/dashboard/settings' },
    {
      icon: <Phone className="w-5 h-5" />,
      name: 'Contact 785',
      onClick: () => setContactOpen(true),
    },
    { icon: <PlugInIcon />, name: 'Sign Out', path: '/api/auth/signout' },
  ]

  type MenuType = 'create' | 'account'

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: MenuType
    index: number
  } | null>(null)
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
      prev && prev.type === menuType && prev.index === index
        ? null
        : { type: menuType, index }
    )
  }

  const closeMobileMenu = () => {
    if (isMobileOpen) toggleMobileSidebar()
  }

  const renderMenuItems = (items: NavItem[], menuType: MenuType) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group w-full ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? 'menu-item-active'
                  : 'menu-item-inactive'
              } cursor-pointer justify-start lg:justify-start`}
            >
              <span
                className={`${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? 'menu-item-icon-active'
                    : 'menu-item-icon-inactive'
                }`}
              >
                {nav.icon}
              </span>
              <span className="menu-item-text flex-1 text-left">{nav.name}</span>
              <ChevronDownIcon
                className={`w-5 h-5 transition-transform duration-200 ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? 'rotate-180 text-brand-500'
                    : ''
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
              className="menu-item group menu-item-inactive cursor-pointer justify-start lg:justify-start w-full"
            >
              <span className="menu-item-icon-inactive">{nav.icon}</span>
              <span className="menu-item-text">{nav.name}</span>
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                onClick={closeMobileMenu}
                className={`menu-item group ${
                  isActive(nav.path) ? 'menu-item-active' : 'menu-item-inactive'
                } justify-start lg:justify-start`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? 'menu-item-icon-active'
                      : 'menu-item-icon-inactive'
                  }`}
                >
                  {nav.icon}
                </span>
                <span className="menu-item-text">{nav.name}</span>
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
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      onClick={closeMobileMenu}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? 'menu-dropdown-item-active'
                          : 'menu-dropdown-item-inactive'
                      }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? 'menu-dropdown-badge-active'
                                : 'menu-dropdown-badge-inactive'
                            } menu-dropdown-badge`}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? 'menu-dropdown-badge-active'
                                : 'menu-dropdown-badge-inactive'
                            } menu-dropdown-badge`}
                          >
                            pro
                          </span>
                        )}
                      </span>
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
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => toggleMobileSidebar()}
        />
      )}

      <aside
        className={`fixed top-0 left-0 flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 dark:border-gray-800
          ${
            ${
  isMobileOpen
    ? 'w-screen max-w-none'
    : isExpanded
    ? 'w-[290px]'
    : isHovered
    ? 'w-[290px]'
    : 'w-[90px]'
}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          ${isExpanded ? 'lg:w-[290px]' : isHovered ? 'lg:w-[290px]' : 'lg:w-[90px]'}
          pt-0
          lg:mt-0
        `}
        onMouseEnter={() => !isExpanded && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Mobile close + logo */}
<div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
  <button
            onClick={() => toggleMobileSidebar()}
            className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>

          {/*
            Logo: opens the public seveneightfive.com homepage in the same tab.
            Using <a> (not <Link>) since this is leaving the Next.js app to
            the public site.
          */}
            <a
  href="/dashboard"
  className="flex items-center justify-center"
  aria-label="Creator Hub"
  onClick={closeMobileMenu}
>
  {isExpanded || isHovered || isMobileOpen ? (
    <>
      <Image
        src={LOGO_BLACK}
        alt="785 Magazine"
        width={140}
        height={56}
        priority
        unoptimized
        className="h-12 w-auto dark:hidden"
      />

      <Image
        src={LOGO_WHITE}
        alt="785 Magazine"
        width={140}
        height={56}
        priority
        unoptimized
        className="hidden h-12 w-auto dark:block"
      />
    </>
  ) : (
    <Image
      src={LOGO_BLACK}
      alt="785"
      width={42}
      height={42}
      priority
      unoptimized
      className="h-auto w-[36px]"
    />
  )}
</a>
        </div>

        <div className="flex flex-col overflow-y-auto duration-300 ease-linear flex-1 no-scrollbar px-5 py-6">
          <nav className="mb-6">
            <div className="flex flex-col gap-6">
              <div>
                <h2
                  className={`mb-4 font-body text-xs uppercase flex leading-[20px] text-gray-400 font-semibold tracking-wider ${
                    !isExpanded && !isHovered && !isMobileOpen
                      ? 'lg:justify-center'
                      : 'justify-start'
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? (
                    'Creator Hub'
                  ) : (
                    <HorizontaLDots />
                  )}
                </h2>
                {renderMenuItems(createManageItems, 'create')}
              </div>

              <div>
                <h2
                  className={`mb-4 font-body text-xs uppercase flex leading-[20px] text-gray-400 font-semibold tracking-wider ${
                    !isExpanded && !isHovered && !isMobileOpen
                      ? 'lg:justify-center'
                      : 'justify-start'
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? (
                    'Account'
                  ) : (
                    <HorizontaLDots />
                  )}
                </h2>
                {renderMenuItems(accountItems, 'account')}
              </div>
            </div>
          </nav>

          {(isExpanded || isHovered || isMobileOpen) && <SidebarWidget />}
        </div>
      </aside>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  )
}

export default AppSidebar
