'use client'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'

export default function LogoutButton({ asDropdownItem }: { asDropdownItem?: boolean }) {
  const router = useRouter()
  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (asDropdownItem) {
    return (
      <button onClick={handleLogout} style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', width: '100%', background: 'none',
        border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{fontSize: '0.9rem', width: '18px', textAlign: 'center'}}>→</span>
        <span style={{fontSize: '0.82rem', color: '#C80650'}}>Sign Out</span>
      </button>
    )
  }

  return <button onClick={handleLogout}>Sign Out</button>
}