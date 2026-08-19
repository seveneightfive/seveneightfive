'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import EventMarketingTab from '@/app/components/EventMarketingTab'
import TicketTiersEditor from '@/app/components/TicketTiersEditor'
import EventQuestionsEditor from '@/app/components/EventQuestionsEditor'
import {
  Ticket,
  CheckCircle2,
  DollarSign,
  Wallet,
  Percent,
  AlertCircle,
  ArrowUpRight,
  Download,
} from 'lucide-react'

/**
 * /dashboard/events/[id]/tickets
 *
 * Per-event ticket management surface. Two tabs:
 * - Ticketing: Tier editor, buyer questions, tier performance, attendee list, door check-in
 * - Marketing: Event URL, QR code, social shares, traffic analytics
 */

const sectionHeadingCls =
  'mb-4 border-b border-gray-100 pb-3 font-display text-xl font-bold uppercase tracking-wide text-gray-900 dark:border-gray-800 dark:text-white'

export default function EventTicketsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [tiers, setTiers] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [responsesByTicket, setResponsesByTicket] = useState<Record<string, { label: string; value: string }[]>>({})
  const [activeTab, setActiveTab] = useState<'ticketing' | 'marketing'>('ticketing')
  const [checkInCopied, setCheckInCopied] = useState(false)
  const [checkInUrl, setCheckInUrl] = useState('')
  const [checkInUrlLoading, setCheckInUrlLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Inline edit of a ticket's attendee name/email
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Manually add a ticket (cash / offline sale)
  const [showAddTicket, setShowAddTicket] = useState(false)
  const [addTierId, setAddTierId] = useState('')
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addSendConfirmation, setAddSendConfirmation] = useState(true)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (!eventId) return
    setCheckInUrlLoading(true)
    fetch(`/api/events/${eventId}/scanner-link`)
      .then((r) => r.json())
      .then((json) => setCheckInUrl(json.url || ''))
      .catch(() => { /* card shows a retry-friendly empty state below */ })
      .finally(() => setCheckInUrlLoading(false))
  }, [eventId])

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
              id, buyer_name, buyer_email, attendee_email, amount_paid, status, payment_status,
              created_at, ticket_tier_id, source, notes,
              ticket_tiers(name)
            `)
            .eq('event_id', eventId)
            .eq('payment_status', 'paid')
            .order('created_at', { ascending: false }),
        ])

        setTiers(tiersData || [])
        setTickets(ticketsData || [])

        // Load custom question responses for these tickets, if any
        // questions exist for this event at all.
        const ticketIds = (ticketsData || []).map((t) => t.id)
        if (ticketIds.length > 0) {
          const { data: responses } = await supabase
            .from('event_registration_responses')
            .select('ticket_id, response, event_form_fields(label)')
            .in('ticket_id', ticketIds)

          const grouped: Record<string, { label: string; value: string }[]> = {}
          for (const r of responses || []) {
            const label = Array.isArray(r.event_form_fields)
              ? r.event_form_fields[0]?.label
              : (r.event_form_fields as any)?.label
            if (!label) continue
            grouped[r.ticket_id] = grouped[r.ticket_id] || []
            grouped[r.ticket_id].push({ label, value: r.response })
          }
          setResponsesByTicket(grouped)
        }

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
  const checkInRate = totalSold > 0 ? (checkedIn / totalSold) * 100 : 0

  const stripeReady = profile?.stripe_account_status === 'enabled'



  const copyCheckInUrl = () => {
    if (!checkInUrl) return
    navigator.clipboard.writeText(checkInUrl)
    setCheckInCopied(true)
    setTimeout(() => setCheckInCopied(false), 2000)
  }

  async function refreshTickets() {
    const [{ data: tiersData }, { data: ticketsData }] = await Promise.all([
      supabase
        .from('ticket_tiers')
        .select('id, name, price, quantity, quantity_sold, is_active')
        .eq('event_id', eventId)
        .order('sort_order'),
      supabase
        .from('tickets')
        .select(`
          id, buyer_name, buyer_email, attendee_email, amount_paid, status, payment_status,
          created_at, ticket_tier_id, source, notes,
          ticket_tiers(name)
        `)
        .eq('event_id', eventId)
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false }),
    ])
    setTiers(tiersData || [])
    setTickets(ticketsData || [])

    const ticketIds = (ticketsData || []).map((t) => t.id)
    if (ticketIds.length > 0) {
      const { data: responses } = await supabase
        .from('event_registration_responses')
        .select('ticket_id, response, event_form_fields(label)')
        .in('ticket_id', ticketIds)
      const grouped: Record<string, { label: string; value: string }[]> = {}
      for (const r of responses || []) {
        const label = Array.isArray(r.event_form_fields) ? r.event_form_fields[0]?.label : (r.event_form_fields as any)?.label
        if (!label) continue
        grouped[r.ticket_id] = grouped[r.ticket_id] || []
        grouped[r.ticket_id].push({ label, value: r.response })
      }
      setResponsesByTicket(grouped)
    }
  }

  function startEditingTicket(t: any) {
    setEditingTicketId(t.id)
    setEditName(t.buyer_name || '')
    setEditEmail(t.attendee_email || '')
    setEditError('')
  }

  function cancelEditingTicket() {
    setEditingTicketId(null)
    setEditError('')
  }

  async function saveTicketEdit(ticketId: string) {
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/tickets/manage/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer_name: editName.trim(), attendee_email: editEmail.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to update ticket')
      await refreshTickets()
      setEditingTicketId(null)
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update ticket')
    } finally {
      setEditSaving(false)
    }
  }

  function openAddTicket() {
    setShowAddTicket(true)
    setAddTierId(tiers.find((t) => t.is_active)?.id || tiers[0]?.id || '')
    setAddName('')
    setAddEmail('')
    setAddAmount('')
    setAddNotes('')
    setAddSendConfirmation(true)
    setAddError('')
  }

  async function submitAddTicket(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    setAddError('')
    try {
      const res = await fetch(`/api/events/${eventId}/tickets/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId: addTierId,
          attendeeName: addName.trim(),
          attendeeEmail: addEmail.trim() || null,
          amountPaid: addAmount.trim() === '' ? undefined : Number(addAmount),
          notes: addNotes.trim() || null,
          sendConfirmation: addSendConfirmation,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to add ticket')
      await refreshTickets()
      setShowAddTicket(false)
    } catch (err: any) {
      setAddError(err?.message || 'Failed to add ticket')
    } finally {
      setAddSaving(false)
    }
  }

  async function handleExportCsv() {
    setExporting(true)
    try {
      const res = await fetch(`/api/events/${eventId}/tickets/export`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${event.slug || 'event'}-attendees.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CSV export failed:', err)
    } finally {
      setExporting(false)
    }
  }

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
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
            Creator
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

      {/* Tab switcher — pill buttons instead of underlined text so the
          active tab reads clearly at a glance */}
      <div className="inline-flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.05]">
        <button
          onClick={() => setActiveTab('ticketing')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'ticketing'
              ? 'bg-white text-brand-700 shadow-sm dark:bg-gray-900 dark:text-brand-400'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Ticketing
        </button>
        <button
          onClick={() => setActiveTab('marketing')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'marketing'
              ? 'bg-white text-brand-700 shadow-sm dark:bg-gray-900 dark:text-brand-400'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Marketing
        </button>
      </div>

      {/* Ticketing Tab */}
      {activeTab === 'ticketing' && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
              icon={<Percent className="h-4 w-4" />}
              label="Check-In Rate"
              value={`${checkInRate.toFixed(1)}%`}
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
            <h2 className={sectionHeadingCls}>Ticket Tiers</h2>
            <p className="mb-4 -mt-2 text-xs text-gray-500 dark:text-gray-400">
              Set up tier names, prices, and limits. Buyers see active tiers on the
              public event page.
            </p>
            <TicketTiersEditor
              eventId={eventId}
              stripeAccountStatus={profile?.stripe_account_status || null}
            />
          </Card>

          {/* Buyer questions */}
          <Card>
            <h2 className={sectionHeadingCls}>Ticket Buyer Questions</h2>
            <EventQuestionsEditor
              eventId={eventId}
              tiers={eventTiers.map((t) => ({ id: t.id, name: t.name }))}
            />
          </Card>

          {/* Tier performance */}
          {eventTiers.length > 0 && (
            <Card>
              <h2 className={sectionHeadingCls}>Tier Performance</h2>
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

          {/* Door Check-In — moved here from Marketing since it's a
              ticketing/ops concern, not a promotion channel */}
          <Card>
            <h2 className={sectionHeadingCls}>Door Check-In</h2>
            <p className="mb-2 -mt-2 text-sm text-gray-600 dark:text-gray-400">
              Share this link with staff to check in attendees at the door — no account needed,
              the link itself is what grants access:
            </p>
            {checkInUrlLoading ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Setting up your check-in link…</div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={checkInUrl}
                  readOnly
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-300"
                />
                <button
                  onClick={copyCheckInUrl}
                  disabled={!checkInUrl}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {checkInCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </Card>

          {/* Attendees */}
          <Card>
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                Attendees
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={openAddTicket}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.08]"
                >
                  + Add Ticket
                </button>
                {totalSold > 0 && (
                  <button
                    onClick={handleExportCsv}
                    disabled={exporting}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.08]"
                  >
                    <Download className="h-3 w-3" />
                    {exporting ? 'Exporting…' : 'Export CSV'}
                  </button>
                )}
                {totalSold > 0 && (
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {totalSold} total
                  </span>
                )}
              </div>
            </div>

            {showAddTicket && (
              <form
                onSubmit={submitAddTicket}
                className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]"
              >
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Add a ticket sold outside 785 Tickets
                </div>
                <p className="-mt-1 text-xs text-gray-500 dark:text-gray-400">
                  For cash at the door, Venmo, comps, etc. — it'll show up here and in your CSV
                  export just like an online sale, and counts against the tier's inventory.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                      Tier
                    </label>
                    <select
                      value={addTierId}
                      onChange={(e) => setAddTierId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                    >
                      <option value="" disabled>Select a tier…</option>
                      {tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} — {Number(t.price) === 0 ? 'Free' : `$${Number(t.price).toFixed(2)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                      Amount actually paid
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      placeholder="Defaults to tier price"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                      Attendee name
                    </label>
                    <input
                      type="text"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      required
                      placeholder="First Last"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="attendee@example.com"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    placeholder="e.g. Cash at door"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={addSendConfirmation}
                    onChange={(e) => setAddSendConfirmation(e.target.checked)}
                    disabled={!addEmail.trim()}
                    className="rounded border-gray-300"
                  />
                  Email this attendee their QR code {!addEmail.trim() && '(add an email above to enable)'}
                </label>

                {addError && <p className="text-xs font-medium text-brand-600 dark:text-brand-400">{addError}</p>}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={addSaving || !addTierId || !addName.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addSaving ? 'Adding…' : 'Add ticket'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddTicket(false)}
                    disabled={addSaving}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

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
                  const responses = responsesByTicket[t.id]
                  const isEditing = editingTicketId === t.id

                  if (isEditing) {
                    return (
                      <div
                        key={t.id}
                        className="rounded-lg border border-brand-300 bg-brand-50/40 p-3 dark:border-brand-500/40 dark:bg-brand-500/5"
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                              Name
                            </label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                              Attendee email
                            </label>
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="—"
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                            />
                          </div>
                        </div>
                        {editError && (
                          <p className="mt-2 text-xs font-medium text-brand-600 dark:text-brand-400">{editError}</p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => saveTicketEdit(t.id)}
                            disabled={editSaving || !editName.trim()}
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditingTicket}
                            disabled={editSaving}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={t.id}
                      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                              {t.buyer_name || 'Guest'}
                            </span>
                            <StatusPill status={t.status} />
                            {t.source === 'manual' && (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                                Manual
                              </span>
                            )}
                            <button
                              onClick={() => startEditingTicket(t)}
                              className="text-[10px] font-semibold text-gray-400 underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                              Edit
                            </button>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                            {t.attendee_email || t.buyer_email || '—'}
                          </div>
                          {t.notes && (
                            <div className="mt-0.5 truncate text-xs italic text-gray-400 dark:text-gray-500">
                              {t.notes}
                            </div>
                          )}
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

                      {responses && responses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 border-t border-gray-100 pt-2 dark:border-gray-800/60">
                          {responses.map((r, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-white/[0.06] dark:text-gray-400"
                            >
                              <span className="font-semibold text-gray-800 dark:text-gray-300">
                                {r.label}:
                              </span>
                              <span className="ml-1">{r.value}</span>
                            </span>
                          ))}
                        </div>
                      )}
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
