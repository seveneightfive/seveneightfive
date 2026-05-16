'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'
import {
  BoxCubeIcon,
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
import { DollarSign, X } from 'lucide-react'
import SidebarWidget from './SidebarWidget'

type NavItem = {
  name: string
  icon: React.ReactNode
  path?: string
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[]
}

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: 'Dashboard',
    path: '/dashboard',
  },
  {
    icon: <TableIcon />,
    name: 'My Tickets',
    path: '/dashboard/tickets',
  },
  {
    icon: <UserCircleIcon />,
    name: 'Following',
    path: '/dashboard/following',
  },
  {
    icon: <ListIcon />,
    name: 'Settings',
    path: '/dashboard/settings',
  },
]

const creatorItems: NavItem[] = [
  {
    icon: <PageIcon />,
    name: 'My Pages',
    subItems: [
      { name: 'Artist Page', path: '/dashboard/edit' },
      { name: 'Venue Page', path: '/dashboard/venue' },
      { name: 'Appearances', path: '/dashboard/appearances' },
    ],
  },
  {
    icon: <CalenderIcon />,
    name: 'Events',
    path: '/dashboard/events',
  },
  {
    icon: <DollarSign className="w-5 h-5" />,
    name: 'Payouts',
    path: '/dashboard/payouts',
  },
  {
    icon: <PieChartIcon />,
    name: 'Advertise',
    path: '/dashboard/advertise',
  },
  {
    icon: <BoxCubeIcon />,
    name: 'Scan Tickets',
    path: '/dashboard/scan',
  },
]

const othersItems: NavItem[] = [
  {
    icon: <CalenderIcon />,
    name: 'Save the Date',
    path: '/save-the-date',
  },
  {
    icon: <PlugInIcon />,
    name: 'Sign Out',
    path: '/api/auth/signout',
  },
]

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleMobileSidebar } = useSidebar()
  const pathname = usePathname()

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: 'main' | 'creator' | 'others'
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
    const groups: Array<['main' | 'creator' | 'others', NavItem[]]> = [
      ['main', navItems],
      ['creator', creatorItems],
      ['others', othersItems],
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

  const handleSubmenuToggle = (
    index: number,
    menuType: 'main' | 'creator' | 'others'
  ) => {
    setOpenSubmenu((prev) =>
      prev && prev.type === menuType && prev.index === index
        ? null
        : { type: menuType, index }
    )
  }

  const closeMobileMenu = () => {
    if (isMobileOpen) {
      toggleMobileSidebar()
    }
  }

  const renderMenuItems = (
    items: NavItem[],
    menuType: 'main' | 'creator' | 'others'
  ) => (
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
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => toggleMobileSidebar()}
        />
      )}

      <aside
        className={`fixed top-0 left-0 flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 dark:border-gray-800
          ${
            isExpanded || isMobileOpen
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
        {/* Mobile close button + logo block */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 lg:py-8 lg:flex-col lg:gap-0">
          {/* Close button (mobile only) */}
          <button
            onClick={() => toggleMobileSidebar()}
            className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center justify-center"
            onClick={closeMobileMenu}
          >
            {isExpanded || isHovered || isMobileOpen ? (
              <>
                {/* Black logo for light mode */}
                <Image
                  src="/images/logo/785MastHead_Black-Web.png"
                  alt="785 Magazine"
                  width={120}
                  height={17}
                  priority
                  className="dark:hidden"
                />
                {/* Eggshell logo for dark mode */}
                <Image
                  src="/images/logo/785MastHead_EggShell-WEB.gif"
                  alt="785 Magazine"
                  width={120}
                  height={17}
                  priority
                  className="hidden dark:block"
                />
              </>
            ) : (
              <Image
                src="/images/logo/logo-icon.svg"
                alt="785"
                width={32}
                height={32}
              />
            )}
          </Link>
        </div>

        {/* Scrollable nav */}
        <div className="flex flex-col overflow-y-auto duration-300 ease-linear flex-1 no-scrollbar px-5 py-6">
          <nav className="mb-6">
            <div className="flex flex-col gap-6">
              {/* MENU */}
              <div>
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 font-semibold tracking-wider ${
                    !isExpanded && !isHovered && !isMobileOpen ? 'lg:justify-center' : 'justify-start'
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? 'Menu' : <HorizontaLDots />}
                </h2>
                {renderMenuItems(navItems, 'main')}
              </div>

              {/* CREATOR */}
              <div>
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 font-semibold tracking-wider ${
                    !isExpanded && !isHovered && !isMobileOpen ? 'lg:justify-center' : 'justify-start'
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? 'Creator' : <HorizontaLDots />}
                </h2>
                {renderMenuItems(creatorItems, 'creator')}
              </div>

              {/* OTHERS */}
              <div>
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 font-semibold tracking-wider ${
                    !isExpanded && !isHovered && !isMobileOpen ? 'lg:justify-center' : 'justify-start'
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? 'Others' : <HorizontaLDots />}
                </h2>
                {renderMenuItems(othersItems, 'others')}
              </div>
            </div>
          </nav>

          {/* Widget (desktop + mobile expanded only) */}
          {(isExpanded || isHovered || isMobileOpen) && <SidebarWidget />}
        </div>
      </aside>
    </>
  )
}

export default AppSidebar
