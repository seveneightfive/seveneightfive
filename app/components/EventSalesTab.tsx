'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Search, AlertCircle, RefreshCw } from 'lucide-react'

/**
 * Sales tab on /dashboard/events/[id]/tickets (?tab=sales).
 *
 * One row per paid order: who bought, what they bought, and how the
 * charge breaks down. Expanding a row shows the ticket/add-on lines and
 * the seats that order produced (which is how the attendee list's
 * "part of Branden's VIP table" rows tie back to a single payment).
 *
 * Data comes from GET /api/events/[id]/sales, which also records any
 * older orders from Stripe on first load.
 */

type SalesOrder = {
  id: string
  paymentIntentId: string
  purchasedAt: string
  buyerName: string | null
  buyerEmail: string | null
  status: 'paid' | 'refunded' | 'partially_refunded'
  ticketsSubtotal: number
  addonsSubtotal: number
  serviceFee: number
  amountTotal: number
  platformFee: number
  net: number
  amountRefunded: number
  items: { name: string; quantity: number; isTable: boolean; seats: number }[]
  addons: { name: string; choice: string | null; quantity: number; amount: number }[]
  seats: { id: string; name: string | null; tier: string; status: string }[]
}

type SalesResponse = {
  orders: SalesOrder[]
  totals: {
    orders: number
    ticketsSubtotal: number
    addonsSubtotal: number
    serviceFee: number
    amountTotal: number
    platformFee: number
    net: number
  }
  stillMissing: number
  unpaidTicketCount: number
}

const sectionHeadingCls =
  'mb-4 border-b border-gray-100 pb-3 font-display text-xl font-bold uppercase tracking-wide text-gray-900 dark:border-gray-800 dark:text-white'

const money = (n: number) =>
  `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const shortDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function EventSalesTab({ eventId, eventSlug }: { eventId: string; eventSlug?: string }) {
  const [data, setData] = useState<SalesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/events/${eventId}/sales`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load sales')
      setData(json)
    } catch (err: any) {
      setError(err?.message || 'Failed to load sales')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const filtered = useMemo(() => {
    const orders = data?.orders || []
    const q = query.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) =>
      [o.buyerName, o.buyerEmail, ...o.seats.map((s) => s.name)]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    )
  }, [data, query])

  function exportCsv() {
    if (!data) return
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = [
      'Date', 'Buyer', 'Email', 'Purchased', 'Add-ons', 'Tickets', 'Add-ons total',
      'Service fee (buyer paid)', 'Total charged', 'Platform fee', 'You receive', 'Status', 'Stripe payment',
    ]
    const rows = data.orders.map((o) => [
      new Date(o.purchasedAt).toLocaleString('en-US'),
      o.buyerName,
      o.buyerEmail,
      o.items.map((i) => `${i.name} x${i.quantity}`).join('; '),
      o.addons.map((a) => `${a.name}${a.choice ? ` (${a.choice})` : ''} x${a.quantity}`).join('; '),
      o.ticketsSubtotal.toFixed(2),
      o.addonsSubtotal.toFixed(2),
      o.serviceFee.toFixed(2),
      o.amountTotal.toFixed(2),
      o.platformFee.toFixed(2),
      o.net.toFixed(2),
      o.status,
      o.paymentIntentId,
    ])
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${eventSlug || 'event'}-sales.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading && !data) {
    return (
      <Card>
        <h2 className={sectionHeadingCls}>Sales</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading orders…</p>
      </Card>
    )
  }

  if (error && !data) {
    return (
      <Card>
        <h2 className={sectionHeadingCls}>Sales</h2>
        <div className="flex items-center gap-2 text-sm text-error-600 dark:text-error-400">
          <AlertCircle className="h-4 w-4" /> {error}
          <button onClick={load} className="ml-2 font-semibold underline">Try again</button>
        </div>
      </Card>
    )
  }

  const t = data!.totals

  return (
    <>
      {/* Summary — how the money adds up across all orders */}
      <Card>
        <h2 className={sectionHeadingCls}>Sales Summary</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          <Figure label="Orders" value={String(t.orders)} />
          <Figure label="Ticket sales" value={money(t.ticketsSubtotal)} />
          <Figure label="Add-on sales" value={money(t.addonsSubtotal)} />
          <Figure label="Total charged" value={money(t.amountTotal)} hint={`incl. ${money(t.serviceFee)} buyer service fees`} />
          <Figure label="Platform fees" value={`−${money(t.platformFee)}`} />
          <Figure label="You receive" value={money(t.net)} strong />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          Buyers pay a service fee on top of your prices to cover card processing, so it doesn&apos;t come out of
          your sales. <span className="font-semibold">You receive</span> is what&apos;s paid out to your Stripe
          account: your ticket and add-on sales minus seveneightfive&apos;s platform fee.
        </p>
        {data!.stillMissing > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {data!.stillMissing} older order{data!.stillMissing === 1 ? ' is' : 's are'} still being pulled in from Stripe.
            <button onClick={load} className="ml-auto inline-flex items-center gap-1 font-semibold underline">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        )}
      </Card>

      {/* Order ledger */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-gray-900 dark:text-white">
            Orders
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search buyer or guest"
                className="h-9 w-56 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
              />
            </label>
            <button
              onClick={exportCsv}
              disabled={!data?.orders.length}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold uppercase tracking-wider text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {data!.orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No paid orders yet.</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No orders match “{query}”.</p>
        ) : (
          <>
          {/* Phones: stacked cards */}
          <MobileOrders orders={filtered} open={open} toggle={(id) => setOpen((s) => ({ ...s, [id]: !s[id] }))} />

          <div className="-mx-5 hidden overflow-x-auto px-5 md:block">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <Th>Buyer</Th>
                  <Th>Purchased</Th>
                  <Th right>Subtotal</Th>
                  <Th right>Service fee</Th>
                  <Th right>Total charged</Th>
                  <Th right>Platform fee</Th>
                  <Th right>You receive</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const isOpen = !!open[o.id]
                  const refunded = o.status === 'refunded'
                  return (
                    <Fragment key={o.id}>
                      <tr
                        onClick={() => setOpen((s) => ({ ...s, [o.id]: !s[o.id] }))}
                        className={`cursor-pointer border-b border-gray-100 align-top transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.02] ${refunded ? 'opacity-60' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-start gap-2">
                            <button
                              aria-label={isOpen ? 'Hide order details' : 'Show order details'}
                              aria-expanded={isOpen}
                              className="mt-0.5 text-gray-400"
                            >
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {o.buyerName || o.buyerEmail || 'Unknown buyer'}
                                {o.status !== 'paid' && <RefundPill status={o.status} />}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{shortDate(o.purchasedAt)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {o.items.map((i) => (
                            <div key={i.name}>
                              {i.name} × {i.quantity}
                              {i.isTable && <span className="text-xs text-gray-500"> ({i.seats} seats)</span>}
                            </div>
                          ))}
                          {addonTotals(o).map(([name, qty]) => (
                            <div key={name} className="text-xs text-gray-500 dark:text-gray-400">
                              + {name} × {qty}
                            </div>
                          ))}
                        </td>
                        <Money value={o.ticketsSubtotal + o.addonsSubtotal} />
                        <Money value={o.serviceFee} muted />
                        <Money value={o.amountTotal} strong />
                        <Money value={-o.platformFee} muted />
                        <Money value={o.net} strong />
                      </tr>

                      {isOpen && (
                        <tr className="border-b border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-white/[0.02]">
                          <td colSpan={7} className="px-3 py-4">
                            <OrderDetail o={o} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {data!.unpaidTicketCount > 0 && (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            {data!.unpaidTicketCount} free or complimentary ticket{data!.unpaidTicketCount === 1 ? '' : 's'} aren&apos;t
            listed here since no payment was made. They&apos;re on the Guests tab.
          </p>
        )}
      </Card>
    </>
  )
}

function MobileOrders({
  orders, open, toggle,
}: { orders: SalesOrder[]; open: Record<string, boolean>; toggle: (id: string) => void }) {
  return (
    <ul className="divide-y divide-gray-100 md:hidden dark:divide-gray-800">
      {orders.map((o) => {
        const isOpen = !!open[o.id]
        return (
          <li key={o.id} className={`py-3 ${o.status === 'refunded' ? 'opacity-60' : ''}`}>
            <button
              onClick={() => toggle(o.id)}
              aria-expanded={isOpen}
              className="flex w-full items-start gap-2 text-left"
            >
              {isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {o.buyerName || o.buyerEmail || 'Unknown buyer'}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{money(o.amountTotal)}</span>
                </div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {o.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
                  {addonTotals(o).map(([name, qty]) => ` + ${name} × ${qty}`).join('')}
                </div>
                <div className="mt-0.5 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{shortDate(o.purchasedAt)}{o.status !== 'paid' && <RefundPill status={o.status} />}</span>
                  <span className="tabular-nums">You receive {money(o.net)}</span>
                </div>
              </div>
            </button>
            {isOpen && (
              <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
                <OrderDetail o={o} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function OrderDetail({ o }: { o: SalesOrder }) {
  return (
        <div className="grid gap-6 md:grid-cols-2 md:pl-6">
          {/* Receipt-style breakdown */}
          <div>
            <SubHead>Breakdown</SubHead>
            <dl className="space-y-1.5 text-sm">
              {o.items.length === 1 ? (
                <Line label={`${o.items[0].name} × ${o.items[0].quantity}`} value={o.ticketsSubtotal} />
              ) : (
                <>
                  {o.items.map((i) => (
                    <Line key={i.name} label={`${i.name} × ${i.quantity}`} indent />
                  ))}
                  <Line label="Tickets" value={o.ticketsSubtotal} />
                </>
              )}
              {o.addons.map((a) => (
                <Line
                  key={`${a.name}-${a.choice}`}
                  label={`${a.name}${a.choice ? ` — ${a.choice}` : ''} × ${a.quantity}`}
                  value={a.amount}
                  indent
                />
              ))}
              {o.addons.length > 0 && <Line label="Add-ons" value={o.addonsSubtotal} />}
              <Line label="Service fee (paid by buyer)" value={o.serviceFee} />
              <Line label="Total charged" value={o.amountTotal} rule strong />
              <Line label="Platform fee" value={-o.platformFee} />
              <Line label="You receive" value={o.net} rule strong />
              {o.amountRefunded > 0 && <Line label="Refunded to buyer" value={-o.amountRefunded} />}
            </dl>
          </div>
    
          {/* Seats this order produced */}
          <div>
            <SubHead>Guests on this order ({o.seats.length})</SubHead>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-transparent">
              {groupSeats(o.seats).map((g) => (
                <li key={g.key} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span className="truncate text-gray-800 dark:text-gray-200">
                    {g.name}
                    {g.count > 1 && <span className="text-gray-500 dark:text-gray-400"> × {g.count}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{g.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 break-all text-[11px] text-gray-400">Stripe payment {o.paymentIntentId}</p>
          </div>
        </div>
  )
}

// Add-on quantities per add-on name, e.g. [['Meal', 8]]
function addonTotals(o: SalesOrder): [string, number][] {
  const m = new Map<string, number>()
  for (const a of o.addons) m.set(a.name, (m.get(a.name) || 0) + a.quantity)
  return [...m.entries()]
}

// Table seats all carry the buyer's name until the organizer renames
// them, so collapse identical rows ("Tamra Scheid × 6") to keep it short.
function groupSeats(seats: SalesOrder['seats']) {
  const groups = new Map<string, { key: string; name: string; label: string; count: number }>()
  for (const s of seats) {
    const name = s.name || 'Unnamed guest'
    const label = s.status === 'used' ? 'Checked in' : s.status === 'refunded' ? 'Refunded' : s.tier
    const key = `${name}::${label}`
    const g = groups.get(key) || { key, name, label, count: 0 }
    g.count += 1
    groups.set(key, g)
  }
  return [...groups.values()]
}

// ─── Small pieces ─────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      {children}
    </div>
  )
}

function Figure({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">{label}</div>
      <div
        className={`mt-1 font-display text-2xl font-bold leading-none tabular-nums ${
          strong ? 'text-success-700 dark:text-success-400' : 'text-gray-900 dark:text-white'
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</div>}
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`whitespace-nowrap px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Money({ value, strong, muted }: { value: number; strong?: boolean; muted?: boolean }) {
  const neg = value < 0
  return (
    <td
      className={`whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums ${
        strong
          ? 'font-semibold text-gray-900 dark:text-white'
          : muted
            ? 'text-gray-500 dark:text-gray-400'
            : 'text-gray-700 dark:text-gray-300'
      }`}
    >
      {neg ? `−${money(-value)}` : money(value)}
    </td>
  )
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
      {children}
    </div>
  )
}

function Line({
  label, value, indent, rule, strong,
}: { label: string; value?: number; indent?: boolean; rule?: boolean; strong?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${rule ? 'border-t border-gray-200 pt-1.5 dark:border-gray-700' : ''} ${
        indent ? 'pl-3 text-gray-500 dark:text-gray-400' : strong ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
      }`}
    >
      <dt>{label}</dt>
      {value !== undefined && (
        <dd className="tabular-nums">{value < 0 ? `−${money(-value)}` : money(value)}</dd>
      )}
    </div>
  )
}

function RefundPill({ status }: { status: string }) {
  return (
    <span className="ml-2 inline-flex rounded-full bg-brand-50 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-[0.12em] text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
      {status === 'refunded' ? 'Refunded' : 'Part refunded'}
    </span>
  )
}
