import { Suspense } from 'react'
import TicketSuccessInner from './TicketSuccessInner'

export default function TicketSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#1a1814', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'sans-serif' }}>Loading…</div>
      </div>
    }>
      <TicketSuccessInner />
    </Suspense>
  )
}
