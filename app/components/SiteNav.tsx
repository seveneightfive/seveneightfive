'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './nav.module.css'
import { useNavState } from './NavContext'

export default function SiteNav() {
  const pathname = usePathname()
  const { logoSuffix, rightText } = useNavState()
  const date = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })

  const isActive = (prefix: string) => pathname.startsWith(prefix)

  return (
    <>
      {/* ── Desktop Top Nav ── */}
      <header className={styles.topnav}>
        <Link href="/" className={styles.logo}>
          785<span>{logoSuffix}</span>
        </Link>
        <nav>
          <Link href="/events"    className={`${styles.navLink} ${isActive('/events')    ? styles.activeNav : ''}`}>Events</Link>
          <Link href="/artists"   className={`${styles.navLink} ${isActive('/artists')   ? styles.activeNav : ''}`}>Artist Directory</Link>
          <Link href="/venues"    className={`${styles.navLink} ${isActive('/venues')    ? styles.activeNav : ''}`}>Venues</Link>
          <Link href="/dashboard" className={`${styles.navLink} ${isActive('/dashboard') ? styles.activeNav : ''}`}>Dashboard</Link>
        </nav>
      </header>

      {/* ── Mobile Header ── */}
      <header className={styles.mobileHeader}>
        <Link href="/" className={styles.logo}>
          785<span>{logoSuffix}</span>
        </Link>
        <span className={styles.date}>
          {rightText || date}
        </span>
      </header>

      {/* ── Mobile Bottom Nav ── */}
      <nav className={styles.bottomnav}>
        <Link href="/events" className={`${styles.bnLink} ${isActive('/events') ? styles.active : ''}`}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Events
        </Link>
        <Link href="/artists" className={`${styles.bnLink} ${isActive('/artists') ? styles.active : ''}`}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          Artists
        </Link>
        <Link href="/venues" className={`${styles.bnLink} ${isActive('/venues') ? styles.active : ''}`}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Venues
        </Link>
        <Link href="/dashboard" className={`${styles.bnLink} ${isActive('/dashboard') ? styles.active : ''}`}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          MY 785
        </Link>
      </nav>
    </>
  )
}
