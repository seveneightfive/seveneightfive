'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './nav.module.css'
import MobileBottomNav from './MobileBottomNav'
import { DISCOVER_SECTIONS, isDiscoverPath } from '@/lib/discover'

// Routes where ALL nav chrome (header + bottom nav) is hidden — detail
// pages render their own DetailHeader and have no bottom tab bar, for a
// full-screen, focused feel.
const IMMERSIVE_PREFIXES = [
  '/artists/',
  '/venues/',
  '/events/',
  '/stories/',
  '/sellers/',
  '/network',
]

// Routes with their own BrowseHeader (logo/back + title + Search & Filter),
// so SiteNav's desktop topnav would be redundant here. /events is NOT in
// this list: it keeps the site nav (sticky, same as home) and puts its own
// events bar directly underneath it.
const HIDE_DESKTOP_TOPNAV_PATHS = [
  '/venues',
]

// Routes that show the site nav only at ≥900px. Below that they keep their
// own BrowseHeader (which has its own logo + menu), so showing both would
// stack two headers.
const WIDE_ONLY_TOPNAV_PATHS = [
  '/artists',
]

function isImmersive(pathname: string) {
  return IMMERSIVE_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export default function SiteNav() {
  const pathname = usePathname()

  if (isImmersive(pathname)) return null

  const hideDesktopTopnav = HIDE_DESKTOP_TOPNAV_PATHS.includes(pathname)
  const wideOnlyTopnav = WIDE_ONLY_TOPNAV_PATHS.includes(pathname)
  const isActive = (prefix: string) => pathname.startsWith(prefix)

  return (
    <>
      {!hideDesktopTopnav && (
        <header className={`${styles.topnav}${wideOnlyTopnav ? ` ${styles.topnavWideOnly}` : ''}`}>
          <Link href="/" className={styles.logoLink} aria-label="seveneightfive home">
            <img
              src="https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/785logo_web_Proxy.png"
              alt="seveneightfive"
              className={styles.logoImg}
            />
          </Link>
          <nav aria-label="Main">
            <Link href="/events"    className={`${styles.navLink} ${isActive('/events')    ? styles.activeNav : ''}`} aria-current={isActive('/events') ? 'page' : undefined}>Events</Link>
            <DiscoverNavItem pathname={pathname} />
            <Link href="/magazine"  className={`${styles.navLink} ${isActive('/magazine')  ? styles.activeNav : ''}`} aria-current={isActive('/magazine') ? 'page' : undefined}>Magazine</Link>
            <Link href="/dashboard" className={`${styles.navLink} ${isActive('/dashboard') ? styles.activeNav : ''}`} aria-current={isActive('/dashboard') ? 'page' : undefined}>My 785</Link>
          </nav>
        </header>
      )}

      {/* Mobile header (logo + date bar) intentionally removed — it read as
          a web-page banner rather than app chrome. Getting back to '/' on
          mobile now happens via the Home tab in MobileBottomNav instead. */}

      <MobileBottomNav />
    </>
  )
}

// "Discover" link + arrow button that opens a menu of every Discover
// section. The word goes to /discover; the arrow toggles the menu. Closes
// on Escape (focus returns to the arrow), an outside click, or navigation.
function DiscoverNavItem({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const active = isDiscoverPath(pathname)

  // Close the menu after navigating (adjusting state during render, not in an effect)
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={{ display: 'contents' }}>
      <div className={`${styles.navGroup}${active ? ` ${styles.navGroupActive}` : ''}`}>
        <Link href="/discover" className={styles.navLink} aria-current={pathname === '/discover' ? 'page' : undefined}>
          Discover
        </Link>
        <button
          ref={btnRef}
          type="button"
          className={styles.ddBtn}
          aria-expanded={open}
          aria-controls="discover-menu"
          aria-label="Discover sections"
          onClick={() => setOpen(o => !o)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <div id="discover-menu" className={styles.menu}>
          <div className={styles.menuInner}>
            <div className={styles.menuCol}>
              <div className={styles.menuHeading}>Browse the city</div>
              <div className={styles.menuGrid}>
                {DISCOVER_SECTIONS.map(s => (
                  <Link key={s.key} href={s.href} className={styles.menuItem}>
                    <span className={styles.menuSwatch} style={{ background: s.accent }} aria-hidden="true" />
                    <span style={{ minWidth: 0 }}>
                      <span className={styles.menuName}>{s.name}</span>
                      <span className={styles.menuMeta}>{s.menuMeta}</span>
                    </span>
                  </Link>
                ))}
              </div>
              <Link href="/discover" className={styles.menuAll}>All of Discover →</Link>
            </div>
            <Link href="/artists" className={styles.menuFeature}>
              <span className={styles.menuFeatureBadge}>Featured</span>
              <span className={styles.menuFeatureTitle}>Artist Directory</span>
              <span className={styles.menuFeatureCopy}>Musicians, painters, makers and performers from the 785.</span>
              <span className={styles.menuFeatureCta}>Meet the artists →</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
