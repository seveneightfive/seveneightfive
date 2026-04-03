// lib/auth.ts
export async function checkEmail(email: string): Promise<{
  found: boolean
  hasPhone: boolean
}> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-email`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }
  )
  if (!res.ok) throw new Error('Email check failed')
  return res.json()
}