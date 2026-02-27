'use client'

import { createClient } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

type Props = {
  initials: string
  fullName: string
  phoneOrEmail: string
}

export default function AvatarMenu({ initials, fullName, phoneOrEmail }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div ref={wrapRef} style={{position: 'relative'}}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: '#C80650', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Oswald', sans-serif", fontSize: '0.72rem', fontWeight: 700, color: '#fff',
          cursor: 'pointer', border: open ? '2px solid rgba(255,255,255,0.3)' : '2px solid transparent',
          transition: 'border-color 0.15s', userSelect: 'none',
        }}
      >
        {initials}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: '220px', background: '#242019', border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '14px', overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 300,
          animation: 'dropIn 0.15s ease',
        }}>
          {/* Header */}
          <div style={{padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)'}}>
            <div style={{fontFamily: "'Oswald', sans-serif", fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em'}}>
              {fullName}
            </div>
            <div style={{fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '2px'}}>
              {phoneOrEmail}
            </div>
          </div>

          {[
            { icon: '📱', label: 'Update Phone Number', href: '/dashboard/settings/phone' },
            { icon: '✉️', label: 'Update Email', href: '/dashboard/settings/email' },
            { icon: '🔔', label: 'Notification Settings', href: '/dashboard/settings/notifications' },
            { icon: '👤', label: 'Edit Profile', href: '/dashboard/settings/profile' },
          ].map(item => (
            <a key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', textDecoration: 'none',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{fontSize: '0.9rem', width: '18px', textAlign: 'center'}}>{item.icon}</span>
              <span style={{fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)'}}>{item.label}</span>
            </a>
          ))}

          <div style={{height: '1px', background: 'rgba(255,255,255,0.08)'}} />

          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', width: '100%', background: 'none',
              border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{fontSize: '0.9rem', width: '18px', textAlign: 'center'}}>→</span>
            <span style={{fontSize: '0.82rem', color: '#C80650'}}>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  )
}
