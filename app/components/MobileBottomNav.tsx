'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './nav.module.css'

// Intentionally left at 4 items (Events, Artists, Venues, MY 785) —
// adding a 5th icon here would crowd the primary, highest-frequency
// nav on the smallest screens. Discoverability for Archive on
// mobile instead comes from the homepage "Latest Issue" teaser and
// the desktop nav link. Easy to add a 5th tab here later if you
// want it more prominent than that.
export default function MobileBottomNav() {
  const pathname = usePathname()
  const isActive = (prefix: string) => pathname.startsWith(prefix)

  return (
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
  )
}
