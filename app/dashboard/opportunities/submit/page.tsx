// app/dashboard/opportunities/submit/page.tsx
//
// Dashboard-embedded version of /opportunities/submit. Reuses the same
// OpportunitySubmitForm component and submission logic — the only
// difference is that this route lives under app/dashboard/*, so it
// automatically picks up DashboardShell / AppSidebar from
// app/dashboard/layout.tsx and renders with the left nav still visible,
// instead of as a standalone public page.
import { createClient } from '@/lib/supabaseServerAuth'
import OpportunitySubmitForm from '@/app/components/OpportunitySubmitForm'

export const metadata = {
  title: 'Post an Opportunity | 785 Dashboard',
  description: "Share gigs, grants, residencies, open calls, commissions, and collaborations with Topeka's creative community.",
}

export const dynamic = 'force-dynamic'

export default async function DashboardSubmitOpportunityPage() {
  const supabase = await createClient()

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
