// app/opportunities/submit/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import OpportunitySubmitForm from '@/app/components/OpportunitySubmitForm'

export const metadata = {
  title: 'Post an Opportunity | 785 Artist Directory',
  description: 'Share gigs, grants, residencies, open calls, commissions, and collaborations with Topeka's creative community.',
}

export default async function SubmitOpportunityPage() {
  const supabase = createServerComponentClient({ cookies })

  // Get logged-in user's artist profile ID (if they have one)
  const { data: { user } } = await supabase.auth.getUser()

  let userArtistId: string | undefined

  if (user) {
    const { data } = await supabase
      .from('artist_users')
      .select('artist_id')
      .eq('user_id', user.id)
      .in('role', ['creator', 'admin', 'editor'])
      .limit(1)
      .single()

    userArtistId = data?.artist_id ?? undefined
  }

  return <OpportunitySubmitForm userArtistId={userArtistId} />
}
