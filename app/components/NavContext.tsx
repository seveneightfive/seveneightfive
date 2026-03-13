'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

type NavContextType = {
  logoSuffix: string
  rightText: string
  setLogoSuffix: (v: string) => void
  setRightText: (v: string) => void
}

const NavContext = createContext<NavContextType>({
  logoSuffix: 'MAGAZINE',
  rightText: '',
  setLogoSuffix: () => {},
  setRightText: () => {},
})

export function NavProvider({ children }: { children: ReactNode }) {
  const [logoSuffix, setLogoSuffix] = useState('MAGAZINE')
  const [rightText, setRightText] = useState('')
  return (
    <NavContext.Provider value={{ logoSuffix, rightText, setLogoSuffix, setRightText }}>
      {children}
    </NavContext.Provider>
  )
}

export function useNavState() {
  return useContext(NavContext)
}
