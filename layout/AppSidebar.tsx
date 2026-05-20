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
 * Two nav groups instead of three:
 *
 *   CREATE + MANAGE — the active "doing stuff" surface
 *     Dashboard, My Pages, Events, Save the Date, Advertise, Payouts
 *
 *   ACCOUNT — lower-frequency personal/utility actions
 *     My Tickets, Following, Settings, Contact 785, Sign Out
 *
 * Changes from the previous structure:
 *   - "Scan Tickets" removed (now lives per-event under Events)
 *   - "Settings" moved out of MENU into ACCOUNT (avatar dropdown's Settings
 *     link is also being removed; this is now the single source of truth)
 *   - "Contact 785" added as a modal-trigger nav entry
 *   - "Sign Out" stays in nav (still appears in avatar dropdown too — both
 *     are valid escape hatches)
 */

type SubItem = { name: string; path: string; pro?: boolean; new?: boolean }

type NavItem = {
  name: string
  icon: React.ReactNode
  path?: string
  subItems?: SubItem[]
  /** If set, clicking the nav item invokes this instead of navigating. */
  onClick?: () => void
}

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleMobileSidebar } = useSidebar()
  const pathname = usePathname()
  const [contactOpen, setContactOpen] = useState(false)

  // -------------------- nav config --------------------

  const createManageItems: NavItem[] = [
    {
      icon: <GridIcon />,
      name: 'Dashboard',
      path: '/dashboard',
    },
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
      icon: <CalenderIcon />,
      name: 'Save the Date',
      path: '/save-the-date',
    },
    {
      icon: <PieChartIcon />,
      name: 'Advertise',
      path: '/dashboard/advertise',
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      name: 'Payouts',
      path: '/dashboard/payouts',
    },
  ]

  const accountItems: NavItem[] = [
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
    {
      icon: <Phone className="w-5 h-5" />,
      name: 'Contact 785',
      onClick: () => setContactOpen(true),
    },
    {
      icon: <PlugInIcon />,
      name: 'Sign Out',
      path: '/api/auth/signout',
    },
  ]

  // -------------------- submenu state (unchanged behaviour) --------------------

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
    if (isMobileOpen) {
      toggleMobileSidebar()
    }
  }

  // -------------------- rendering --------------------

  const renderMenuItems = (items: NavItem[], menuType: MenuType) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            // Submenu trigger
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
            // Action item (modal trigger, etc.) — same visual treatment as a Link
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
            // Regular nav link
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

          {/* Submenu items */}
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
        {/* Mobile close + logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 lg:py-8 lg:flex-col lg:gap-0">
          <button
            onClick={() => toggleMobileSidebar()}
            className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>

          <Link
            href="/dashboard"
            className="flex items-center justify-center"
            onClick={closeMobileMenu}
          >
            {isExpanded || isHovered || isMobileOpen ? (
              <>
                <Image
                  src="/images/logo/785MastHead_Black-Web.png"
                  alt="785 Magazine"
                  width={120}
                  height={17}
                  priority
                  className="dark:hidden"
                />
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
              {/* CREATE + MANAGE */}
              <div>
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 font-semibold tracking-wider ${
                    !isExpanded && !isHovered && !isMobileOpen
                      ? 'lg:justify-center'
                      : 'justify-start'
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? (
                    'Create + Manage'
                  ) : (
                    <HorizontaLDots />
                  )}
                </h2>
                {renderMenuItems(createManageItems, 'create')}
              </div>

              {/* ACCOUNT */}
              <div>
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 font-semibold tracking-wider ${
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

          {/* Widget (only when sidebar is showing labels) */}
          {(isExpanded || isHovered || isMobileOpen) && <SidebarWidget />}
        </div>
      </aside>

      {/* Contact modal — portaled from here so any "Contact 785" trigger
          in the sidebar can open it without coordinating state higher up */}
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  )
}

export default AppSidebar
