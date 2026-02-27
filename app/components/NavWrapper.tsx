'use client'

import { usePathname } from 'next/navigation'
import SiteNav from './SiteNav'

export default function NavWrapper() {
  const pathname = usePathname()
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/login')) return null
  return <SiteNav />
}
