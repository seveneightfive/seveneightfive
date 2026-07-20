'use client'

import { usePathname } from 'next/navigation'
import SiteNav from './SiteNav'

export default function NavWrapper() {
  const pathname = usePathname()
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/events/') || pathname.startsWith('/login') || pathname.startsWith('/survey/')) return null
  return <SiteNav />
}
