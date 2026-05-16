import { redirect } from 'next/navigation'
import { createClient as createAuthClient } from '@/lib/supabaseServerAuth'
import { createClient } from '@/lib/supabaseServer'
import AdvertiseClient from './AdvertiseClient'

export const metadata = { title: 'Advertise — 785 Magazine' }

export default async function AdvertisePage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string
    cancelled?: string
    ad_id?: string
  }>
}) {
  // searchParams is a Promise in Next.js 15+. Await it before destructuring.
  const params = await searchParams

  const supabase = await createAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/dashboard/advertise')

  const admin = createClient()
  const { data: ads } = await admin
    .from('advertisements')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <AdvertiseClient
      userId={user.id}
      initialAds={ads ?? []}
      successParam={params.success === '1'}
      cancelledAdId={params.ad_id ?? null}
    />
  )
}