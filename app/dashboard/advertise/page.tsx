import { redirect } from 'next/navigation'
import { createClient as createAuthClient } from '@/lib/supabaseServerAuth'
import { createClient } from '@/lib/supabaseServer'
import AdvertiseClient from './AdvertiseClient'

export const metadata = { title: 'Advertise — seveneightfive Dashboard' }

export default async function AdvertisePage({
  searchParams,
}: {
  searchParams: { success?: string; cancelled?: string; ad_id?: string }
}) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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
      successParam={searchParams.success === '1'}
      cancelledAdId={searchParams.ad_id ?? null}
    />
  )
}
