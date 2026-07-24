'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import styles from './browse-header.module.css'
import SearchFilterButton from './SearchFilterButton'

const NAV_LINKS = [
  { href: '/events', label: 'Events' },
  { href: '/artists', label: 'Artist Directory' },
  { href: '/venues', label: 'Venues' },
  { href: '/magazine', label: 'Archive' },
  { href: '/dashboard', label: 'Dashboard' },
]

// Only show a back arrow when there's actually somewhere to go back to —
// i.e. the user navigated here from elsewhere on the site during this
// session, rather than landing directly on /events, /artists, or /venues
// (bookmark, fresh tab, tapped a bottom-nav tab as a root destination).
function useShowBackButton() {
  const [showBack, setShowBack] = useState(false)
  useEffect(() => {
    try {
      const cameFromSite = document.referrer && new URL(document.referrer).origin === window.location.origin
      const hasSessionHistory = window.history.length > 1 && sessionStorage.getItem('785-navigated') === '1'
      setShowBack(Boolean(cameFromSite || hasSessionHistory))
    } catch {
      setShowBack(false)
    }
    sessionStorage.setItem('785-navigated', '1')
  }, [])
  return showBack
}

type BrowseHeaderProps = {
  title: string
  activeFilterCount: number
  onOpenFilters: () => void
}

export default function BrowseHeader({ title, activeFilterCount, onOpenFilters }: BrowseHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const showBack = useShowBackButton()
  const [menuOpen, setMenuOpen] = useState(false)
  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <div className={styles.browseHeader}>
      <div className={styles.row}>
        <div className={styles.left}>
          {showBack && (
            <button className={styles.backBtn} onClick={() => router.back()} aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <span className={styles.title}>{title}</span>
        </div>

        <div className={styles.right}>
          <SearchFilterButton count={activeFilterCount} onClick={onOpenFilters} />

          <div className={styles.hamburgerWrap}>
            <button
              className={styles.hamburgerBtn}
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className={styles.menuScrim} onClick={() => setMenuOpen(false)} />
                <div className={styles.menuDropdown} role="menu">
                  {NAV_LINKS.map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`${styles.menuLink} ${isActive(link.href) ? styles.menuLinkActive : ''}`}
                      onClick={() => setMenuOpen(false)}
                      role="menuitem"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
