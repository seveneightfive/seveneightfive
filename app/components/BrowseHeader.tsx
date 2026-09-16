'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import styles from './browse-header.module.css'
import SearchFilterButton from './SearchFilterButton'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/artists', label: 'Artist Directory' },
  { href: '/venues', label: 'Venues' },
  { href: '/magazine', label: 'Archive' },
  { href: '/dashboard', label: 'Dashboard' },
]

export type BrowseLinkGroup = {
  group: string
  links: { href: string; label: string }[]
}

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
  // Optional. When provided, the header swaps its plain title for a
  // "Browse Events" dropdown trigger below 900px (the same breakpoint
  // where app/events/page.tsx's own desktop sidebar takes over) — so
  // browsing by date/category and Search & Filter live in one sticky
  // row instead of a separate <details> block further down the page.
  // At ≥900px the plain title returns, since the sidebar already covers
  // the same links there.
  browseLinks?: BrowseLinkGroup[]
  browseLabel?: string
}

export default function BrowseHeader({
  title,
  activeFilterCount,
  onOpenFilters,
  browseLinks,
  browseLabel = 'Browse Events',
}: BrowseHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const showBack = useShowBackButton()
  const [menuOpen, setMenuOpen] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <div className={styles.browseHeader}>
      <div className={styles.row}>
        <div className={styles.left}>
          {/* Desktop-only home mark (hidden below 640px via CSS) — this
              bar deliberately replaces the full SiteNav topnav on
              /events, /artists, /venues (see SiteNav's
              HIDE_DESKTOP_TOPNAV_PATHS), which means its logo needs to
              come along too, or there's no way back to "/" on desktop
              except browser back. Mobile gets a Home tab in the bottom
              nav instead. */}
          <Link href="/" className={styles.logo} aria-label="seveneightfive home">785</Link>
          <span className={styles.logoDivider} aria-hidden="true" />
          {showBack && (
            <button className={styles.backBtn} onClick={() => router.back()} aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}

          {browseLinks ? (
            <>
              {/* ≥900px only — the sidebar in app/events/page.tsx already
                  covers browsing at this width, so this is just a label. */}
              <span className={`${styles.title} ${styles.titleDesktopOnly}`}>{title}</span>

              {/* <900px only — merges what used to be the separate
                  "Browse Events" <details> accordion into this sticky row. */}
              <div className={styles.browseWrap}>
                <button
                  type="button"
                  className={styles.browseTrigger}
                  onClick={() => setBrowseOpen(o => !o)}
                  aria-expanded={browseOpen}
                  aria-haspopup="true"
                >
                  {browseLabel}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {browseOpen && (
                  <>
                    <div className={styles.menuScrim} onClick={() => setBrowseOpen(false)} />
                    <div className={styles.browseDropdown} role="menu">
                      {browseLinks.map((section) => (
                        <div key={section.group} className={styles.browseGroup}>
                          <div className={styles.browseGroupLabel}>{section.group}</div>
                          <div className={styles.browseGroupLinks}>
                            {section.links.map((link) => (
                              <a
                                key={link.href}
                                href={link.href}
                                className={styles.browsePill}
                                onClick={() => setBrowseOpen(false)}
                              >
                                {link.label}
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <span className={styles.title}>{title}</span>
          )}
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
