'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AppearancesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/edit#appearances')
  }, [router])
  return null
}
