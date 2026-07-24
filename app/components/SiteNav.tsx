'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './nav.module.css'
import { useNavState } from './NavContext'
import MobileBottomNav from './MobileBottomNav'

// Routes where ALL nav chrome (header + bottom nav) is hidden — detail
// pages render their own DetailHeader and have no bottom tab bar, for a
// full-screen, focused feel.
const IMMERSIVE_PREFIXES = [
  '/artists/',
  '/venues/',
  '/events/',
  '/stories/',
  '/sellers/',
]

// Routes with their own BrowseHeader (logo/back + title + Search & Filter),
// so SiteNav's mobile 785 header would be redundant here.
const HIDE_MOBILE_HEADER_PATHS = [
  '/',
  '/events',
  '/artists',
  '/venues',
]

// Of those, the browse (non-home) pages also replace the desktop topnav —
// BrowseHeader includes its own hamburger with the same nav links.
// Home keeps the desktop topnav for site-wide navigation.
const HIDE_DESKTOP_TOPNAV_PATHS = [
  '/events',
  '/artists',
  '/venues',
]

function isImmersive(pathname: string) {
  return IMMERSIVE_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export default function SiteNav() {
  const pathname = usePathname()
  const { logoSuffix, rightText } = useNavState()

  if (isImmersive(pathname)) return null

  const hideMobileHeader = HIDE_MOBILE_HEADER_PATHS.includes(pathname)
  const hideDesktopTopnav = HIDE_DESKTOP_TOPNAV_PATHS.includes(pathname)

  const date = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })
  const isActive = (prefix: string) => pathname.startsWith(prefix)

  return (
    <>
      {!hideDesktopTopnav && (
        <header className={styles.topnav}>
          <Link href="/" className={styles.logo}>
            785<span>{logoSuffix}</span>
          </Link>
          <nav>
            <Link href="/events"    className={`${styles.navLink} ${isActive('/events')    ? styles.activeNav : ''}`}>Events</Link>
            <Link href="/artists"   className={`${styles.navLink} ${isActive('/artists')   ? styles.activeNav : ''}`}>Artist Directory</Link>
            <Link href="/venues"    className={`${styles.navLink} ${isActive('/venues')    ? styles.activeNav : ''}`}>Venues</Link>
            <Link href="/magazine"  className={`${styles.navLink} ${isActive('/magazine')  ? styles.activeNav : ''}`}>Archive</Link>
            <Link href="/dashboard" className={`${styles.navLink} ${isActive('/dashboard') ? styles.activeNav : ''}`}>Dashboard</Link>
          </nav>
        </header>
      )}

      {!hideMobileHeader && (
        <header className={styles.mobileHeader}>
          <Link href="/" className={styles.logo}>
            785<span>{logoSuffix}</span>
          </Link>
          <span className={styles.date}>
            {rightText || date}
          </span>
        </header>
      )}

      <MobileBottomNav />
    </>
  )
}
