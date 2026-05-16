import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabaseServerAuth'
import TicketsClient from './TicketsClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Tickets — seveneightfive',
  description: "Tickets you've purchased through 785 Magazine.",
}

export const dynamic = 'force-dynamic'

type Ticket = {
  id: string
  event_title: string
  event_date: string
  event_start_time: string | null
  venue_name: string | null
  venue_address: string | null
  tier_name: string | null
  qr_token: string
  status: string
}

export default async function DashboardTicketsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/tickets')

  const { data: tickets } = await supabase
    .from('my_tickets')
    .select('*')
    .order('event_date', { ascending: true })

  const now = new Date()
  const upcoming = (tickets || []).filter(
    (t) => new Date(t.event_date + 'T23:59:59') >= now
  )
  const past = (tickets || []).filter(
    (t) => new Date(t.event_date + 'T23:59:59') < now
  )

  return (
    <TicketsClient
      upcomingTickets={upcoming as Ticket[]}
      pastTickets={past as Ticket[]}
    />
  )
}
