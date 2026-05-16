import { createClient } from '@/lib/supabaseServerAuth'
import { ThemeProvider } from '@/context/ThemeContext'
import { SidebarProvider } from '@/context/SidebarContext'
import DashboardShell from './DashboardShell'

export const dynamic = 'force-dynamic'

/**
 * Layout for everything under /dashboard/*.
 *
 * Responsibilities:
 *   1. Fetch the signed-in user + profile once per request so the header
 *      avatar gets server-rendered data without each page passing props up.
 *   2. Mount ThemeProvider + SidebarProvider so dark mode and sidebar collapse
 *      are scoped to the dashboard subtree.
 *   3. Hand off to <DashboardShell />, the client component that renders the
 *      actual sidebar / header chrome and contains `children`.
 *
 * Guest users (not signed in) still get the shell — that matches your
 * middleware policy of "allow guest access to /dashboard, protect sub-routes
 * only." The header renders Sign In / Sign Up buttons instead of the avatar
 * when headerUser is null.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('full_name, email, phone_number, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null }

  const headerUser = user
    ? {
        fullName: profile?.full_name ?? 'Your Account',
        phoneOrEmail:
          profile?.phone_number || profile?.email || user.email || '',
        avatarUrl: profile?.avatar_url ?? null,
        initials: profile?.full_name
          ? profile.full_name
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()
          : '?',
      }
    : null

  return (
    <ThemeProvider>
      <SidebarProvider>
        <DashboardShell headerUser={headerUser}>{children}</DashboardShell>
      </SidebarProvider>
    </ThemeProvider>
  )
}
