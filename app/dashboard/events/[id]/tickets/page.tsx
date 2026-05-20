'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import EventMarketingTab from '@/app/components/EventMarketingTab'
import TicketTiersEditor from '@/app/components/TicketTiersEditor'
import {
  Ticket,
  CheckCircle2,
  DollarSign,
  Wallet,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react'

/**
 * /dashboard/events/[id]/tickets
 *
 * Per-event ticket management surface. Now includes two tabs:
 * - Ticketing: Tier editor, tier performance, attendee list
 * - Marketing: Event URL, QR code, social shares, analytics
 */

export default function EventTicketsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [tiers, setTiers] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'ticketing' | 'marketing'>('ticketing')

  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push(`/login?next=/dashboard/events/${eventId}/tickets`)
          return
        }

        const { data: eventData } = await supabase
          .from('events')
          .select(`
            id, title, slug, event_date, ticketing_enabled,
            auth_user_id, venue_id,
            venues(id, name, auth_user_id)
          `)
          .eq('id', eventId)
          .maybeSingle()

        if (!eventData) {
          router.push('/dashboard/events')
          return
        }

        let hasAccess = eventData.auth_user_id === user.id
        if (!hasAccess && eventData.venue_id) {
          const venue = Array.isArray(eventData.venues) ? eventData.venues[0] : eventData.venues
          if (venue?.auth_user_id === user.id) hasAccess = true
        }
        if (!hasAccess) {
          const { data: myArtists } = await supabase
            .from('artists')
            .select('id')
            .eq('auth_user_id', user.id)
          const myArtistIds = (myArtists || []).map((a: any) => a.id)
          if (myArtistIds.length) {
            const { data: link } = await supabase
              .from('event_artists')
              .select('artist_id')
              .eq('event_id', eventId)
              .in('artist_id', myArtistIds)
              .limit(1)
              .maybeSingle()
            if (!link) {
              router.push('/dashboard/events')
              return
            }
          } else {
            router.push('/dashboard/events')
            return
          }
        }

        setEvent(eventData)

        const { data: profileData } = await supabase
          .from('profiles')
          .select('stripe_account_status')
          .eq('id', user.id)
          .single()
        setProfile(profileData)

        const [{ data: tiersData }, { data: ticketsData }] = await Promise.all([
          supabase
            .from('ticket_tiers')
            .select('id, name, price, quantity, quantity_sold, is_active')
            .eq('event_id', eventId)
            .order('sort_order'),
          supabase
            .from('tickets')
            .select(`
              id, buyer_name, buyer_email, amount_paid, status, payment_status,
              created_at, ticket_tier_id,
              ticket_tiers(name)
            `)
            .eq('event_id', eventId)
            .eq('payment_status', 'paid')
            .order('created_at', { ascending: false }),
        ])

        setTiers(tiersData || [])
        setTickets(ticketsData || [])
        setLoading(false)
      } catch (err) {
        console.error('Error loading event:', err)
        router.push('/dashboard/events')
      }
    }

    loadData()
  }, [eventId, supabase, router])

  if (loading || !event) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    )
  }

  const eventTickets = tickets
  const eventTiers = tiers
  const totalSold = eventTickets.length
  const totalRevenue = eventTickets.reduce(
    (sum, t) => sum + (parseFloat(t.amount_paid as any) || 0),
    0
  )
  const totalPayout = eventTickets.reduce((sum, t) => {
    const price = parseFloat(t.amount_paid as any) || 0
    return sum + (price - price * 0.029 - 1.0)
  }, 0)
  const checkedIn = eventTickets.filter((t) => t.status === 'used').length

  const stripeReady = profile?.stripe_account_status === 'enabled'

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const formatTime = (d: string) =>
    new Date(d).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
            Creator | Tickets
          </p>
          <h1 className="mb-2 font-display text-3xl font-bold leading-tight text-gray-900 dark:text-white">
            {event.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(event.event_date)}
            {' | '}
            {event.ticketing_enabled ? '785 Tickets enabled' : '785 Tickets disabled'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={`/dashboard/events/edit?id=${eventId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
          >
            Edit Event
          </a>
          {event.slug && (
            <a
              href={`/events/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
            >
              View
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Stripe not ready warning */}
      {!stripeReady && event.ticketing_enabled && (
        <div className="flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Your Stripe account is not connected yet. You can save tier settings,
            but no one can buy tickets until you finish Stripe Connect.
          </span>
        </div>
      )}

      {/* Tab switcher */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('ticketing')}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'ticketing'
                ? 'border-b-2 border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-b-2 border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Ticketing
          </button>
          <button
            onClick={() => setActiveTab('marketing')}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'marketing'
                ? 'border-b-2 border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-b-2 border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Marketing
          </button>
        </div>
      </div>

      {/* Ticketing Tab */}
      {activeTab === 'ticketing' && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={<Ticket className="h-4 w-4" />}
              label="Tickets Sold"
              value={String(totalSold)}
              tone="brand"
            />
            <StatCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Checked In"
              value={String(checkedIn)}
              tone="neutral"
            />
            <StatCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Gross Revenue"
              value={`$${totalRevenue.toFixed(2)}`}
              tone="success"
            />
            <StatCard
              icon={<Wallet className="h-4 w-4" />}
              label="Est. Payout"
              value={`$${Math.max(0, totalPayout).toFixed(2)}`}
              tone="neutral"
            />
          </div>

          {/* Tier editor */}
          <Card>
            <h2 className="mb-1 font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
              Ticket Tiers
            </h2>
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              Set up tier names, prices, and limits. Buyers see active tiers on the
              public event page.
            </p>
            <TicketTiersEditor
              eventId={eventId}
              stripeAccountStatus={profile?.stripe_account_status || null}
            />
          </Card>

          {/* Tier performance */}
          {eventTiers.length > 0 && (
            <Card>
              <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                Tier Performance
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <Th>Tier</Th>
                      <Th>Price</Th>
                      <Th>Sold</Th>
                      <Th>Remaining</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventTiers.map((tier) => {
                      const remaining =
                        tier.quantity != null ? tier.quantity - tier.quantity_sold : null
                      const pct = tier.quantity
                        ? (tier.quantity_sold / tier.quantity) * 100
                        : 0
                      return (
                        <tr
                          key={tier.id}
                          className="border-b border-gray-100 last:border-0 dark:border-gray-800/60"
                        >
                          <Td>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {tier.name}
                            </span>
                          </Td>
                          <Td>
                            {Number(tier.price) === 0
                              ? 'Free'
                              : `$${Number(tier.price).toFixed(2)}`}
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-700 dark:text-gray-300">
                                {tier.quantity_sold}
                              </span>
                              {tier.quantity != null && (
                                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                                  <div
                                    className="h-full rounded-full bg-brand-600"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </Td>
                          <Td>{remaining != null ? remaining : 'Unlimited'}</Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Attendees */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                Attendees
              </h2>
              {totalSold > 0 && (
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {totalSold} total
                </span>
              )}
            </div>

            {eventTickets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-400">
                No tickets sold yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {eventTickets.map((t) => {
                  const tierName = Array.isArray(t.ticket_tiers)
                    ? t.ticket_tiers[0]?.name
                    : (t.ticket_tiers as any)?.name
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {t.buyer_name || 'Guest'}
                          </span>
                          <StatusPill status={t.status} />
                        </div>
                        <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                          {t.buyer_email}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-display text-sm font-bold text-success-700 dark:text-success-400">
                          {t.amount_paid
                            ? `$${parseFloat(t.amount_paid as any).toFixed(2)}`
                            : 'Free'}
                        </div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          {tierName}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500">
                          {formatTime(t.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Marketing Tab */}
      {activeTab === 'marketing' && (
        <EventMarketingTab
          eventId={eventId}
          eventSlug={event.slug}
          eventTitle={event.title}
        />
      )}
    </div>
  )
}

// ─── UI Primitives ────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      {children}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'brand' | 'success' | 'neutral'
}) {
  const valueClass =
    tone === 'brand'
      ? 'text-brand-600 dark:text-brand-400'
      : tone === 'success'
        ? 'text-success-700 dark:text-success-400'
        : 'text-gray-900 dark:text-white'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-white/[0.05] dark:text-gray-400">
        {icon}
      </div>
      <div className={`font-display text-2xl font-bold leading-none ${valueClass}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
        {label}
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 pb-2 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400">{children}</td>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    valid: {
      label: 'Valid',
      cls: 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400',
    },
    used: {
      label: 'Checked in',
      cls: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400',
    },
    refunded: {
      label: 'Refunded',
      cls: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400',
    },
  }
  const m = map[status] ?? map.valid
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${m.cls}`}
    >
      {m.label}
    </span>
  )
}
