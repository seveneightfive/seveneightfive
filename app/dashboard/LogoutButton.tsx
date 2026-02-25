'use client'

import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button onClick={handleLogout} style={{
      background: 'transparent',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '100px',
      color: 'rgba(255,255,255,0.45)',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fontSize: '0.72rem',
      fontWeight: 500,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      padding: '7px 14px',
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}>
      Log Out
    </button>
  )
}
