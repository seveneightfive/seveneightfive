import { redirect } from 'next/navigation'
import { createClient as createAuthClient } from '@/lib/supabaseServerAuth'
import NotifyForm from './NotifyForm'

export const metadata = { title: 'Send Notification — 785 Magazine' }

/**
 * /dashboard/notify — internal tool for composing and sending a push
 * notification to every subscribed device.
 *
 * Requires a signed-in user (matches the pattern in
 * app/dashboard/advertise/page.tsx). The *real* gate is still the
 * PUSH_SECRET header check inside /api/push/send — this page just keeps
 * random logged-out visitors from even seeing the form. If you want this
 * restricted to specific accounts rather than "any signed-in user," add a
 * role/email check here before rendering <NotifyForm />.
 */
export default async function NotifyPage() {
  const supabase = await createAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/dashboard/notify')

  return <NotifyForm />
}
