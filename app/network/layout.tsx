'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import EmailCapturePopup from './EmailCapturePopup'

// ── Tune these two to change when the popup appears ──────────────────────
const SCREENS_BEFORE_PROMPT = 10

// Day/hour the "Monday night" gate opens, in the visitor's local time.
// getDay(): 0=Sun, 1=Mon, 2=Tue... — MONDAY_HOUR is in 24h time (20 = 8pm).
const MONDAY_DAY = 1
const MONDAY_HOUR = 20
// ───────────────────────────────────────────────────────────────────────

function isPastMondayNightCutoff(): boolean {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  if (day > MONDAY_DAY) return true
  if (day === MONDAY_DAY && hour >= MONDAY_HOUR) return true
  return false
}

export default function NetworkLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    // Already submitted or dismissed on this device — never ask again.
    if (localStorage.getItem('network_lead_prompt_done')) return

    const raw = localStorage.getItem('network_screens_viewed')
    const count = (raw ? parseInt(raw, 10) : 0) + 1
    localStorage.setItem('network_screens_viewed', String(count))

    if (count >= SCREENS_BEFORE_PROMPT || isPastMondayNightCutoff()) {
      setShowPopup(true)
    }
  }, [pathname])

  return (
    <>
      {children}
      {showPopup && (
        <EmailCapturePopup sourcePage={pathname} onClose={() => setShowPopup(false)} />
      )}
    </>
  )
}
