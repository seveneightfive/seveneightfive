'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './nav.module.css'
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
  '/network',
]

// Routes with their own BrowseHeader (logo/back + title + Search & Filter),
// so SiteNav's desktop topnav would be redundant here.
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

  if (isImmersive(pathname)) return null

  const hideDesktopTopnav = HIDE_DESKTOP_TOPNAV_PATHS.includes(pathname)
  const isActive = (prefix: string) => pathname.startsWith(prefix)

  return (
    <>
      {!hideDesktopTopnav && (
        <header className={styles.topnav}>
          <Link href="/" className={styles.logoLink} aria-label="seveneightfive home">
            <img
              src="https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/785logo_web_Proxy.png"
              alt="seveneightfive"
              className={styles.logoImg}
            />
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

      {/* Mobile header (logo + date bar) intentionally removed — it read as
          a web-page banner rather than app chrome. Getting back to '/' on
          mobile now happens via the Home tab in MobileBottomNav instead. */}

      <MobileBottomNav />
    </>
  )
}
