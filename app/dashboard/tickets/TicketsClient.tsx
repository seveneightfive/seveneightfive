'use client'

import { useState } from 'react'
import QRCode from 'qrcode'
import { useEffect } from 'react'
import { X } from 'lucide-react'

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

type Props = {
  upcomingTickets: Ticket[]
  pastTickets: Ticket[]
}

const formatDate = (d: string) => {
  const date = new Date(d + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatMonth = (d: string) =>
  new Date(d + 'T12:00:00')
    .toLocaleDateString('en-US', { month: 'short' })
    .toUpperCase()

const formatDay = (d: string) => new Date(d + 'T12:00:00').getDate()

export default function TicketsClient({
  upcomingTickets,
  pastTickets,
}: Props) {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  // Generate QR code when modal opens
  useEffect(() => {
    if (!selectedTicket) {
      setQrDataUrl('')
      return
    }

    QRCode.toDataURL(selectedTicket.qr_token, {
      width: 280,
      margin: 2,
      color: { dark: '#1a1814', light: '#ffffff' },
    }).then(setQrDataUrl)
  }, [selectedTicket])

  // Close modal on Esc
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedTicket(null)
    }
    if (selectedTicket) {
      window.addEventListener('keydown', handleEsc)
      return () => window.removeEventListener('keydown', handleEsc)
    }
  }, [selectedTicket])

  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
            Attending
          </p>
          <h1 className="mb-2 font-display text-3xl font-bold leading-none text-gray-900 dark:text-white">
            My Tickets
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {upcomingTickets.length + pastTickets.length > 0
              ? `${upcomingTickets.length} upcoming · ${pastTickets.length} past`
              : "You haven't purchased any tickets yet."}
          </p>
        </div>

        {/* Upcoming */}
        <Section label="Upcoming">
          {upcomingTickets.length === 0 ? (
            <Empty>
              No upcoming tickets.{' '}
              <a
                href="/events"
                className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                Browse events →
              </a>
            </Empty>
          ) : (
            <List>
              {upcomingTickets.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => setSelectedTicket(ticket)}
                />
              ))}
            </List>
          )}
        </Section>

        {/* Past */}
        {pastTickets.length > 0 && (
          <Section label="Past">
            <List>
              {pastTickets.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => setSelectedTicket(ticket)}
                  dimmed
                />
              ))}
            </List>
          </Section>
        )}
      </div>

      {/* Modal */}
      {selectedTicket && (
        <Modal ticket={selectedTicket} qrDataUrl={qrDataUrl} onClose={() => setSelectedTicket(null)} />
      )}
    </>
  )
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
        {label}
      </p>
      {children}
    </div>
  )
}

function List({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-6 text-center dark:border-gray-700 dark:bg-white/[0.02]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{children}</p>
    </div>
  )
}

function TicketRow({
  ticket,
  onClick,
  dimmed,
}: {
  ticket: Ticket
  onClick: () => void
  dimmed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left transition hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-gray-700 ${
        dimmed ? 'opacity-60' : ''
      }`}
    >
      {/* Date block */}
      <div className="flex w-11 shrink-0 flex-col items-center text-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">
          {formatMonth(ticket.event_date)}
        </span>
        <span className="font-display text-2xl font-bold leading-none text-gray-900 dark:text-white">
          {formatDay(ticket.event_date)}
        </span>
      </div>

      {/* Title + meta + tier */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {ticket.event_title}
        </div>
        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {[ticket.event_start_time, ticket.venue_name]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {ticket.tier_name && (
          <span className="mt-1 inline-block rounded-full border border-brand-600/25 bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
            {ticket.tier_name}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="shrink-0">
        <StatusBadge status={ticket.status} />
      </div>
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; classes: string }
  > = {
    valid: {
      label: 'Valid',
      classes:
        'bg-success-50 text-success-700 border-success-200 dark:bg-success-500/15 dark:text-success-400 dark:border-success-500/30',
    },
    used: {
      label: 'Used',
      classes:
        'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/[0.06] dark:text-gray-400 dark:border-gray-700',
    },
    refunded: {
      label: 'Refunded',
      classes:
        'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-400 dark:border-brand-500/30',
    },
  }
  const m = map[status] ?? {
    label: status,
    classes:
      'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/[0.06] dark:text-gray-400 dark:border-gray-700',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${m.classes}`}
    >
      {m.label}
    </span>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({
  ticket,
  qrDataUrl,
  onClose,
}: {
  ticket: Ticket
  qrDataUrl: string
  onClose: () => void
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-white/[0.03]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Ticket card inside modal */}
          <div className="p-5">
            {/* Accent stripe */}
            <div className="mb-4 h-1 bg-brand-600 rounded-full" />

            {/* Event info */}
            <div className="mb-4">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                {ticket.event_title}
              </h2>
              <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                <div>{formatDate(ticket.event_date)}</div>
                {ticket.event_start_time && (
                  <div>{ticket.event_start_time}</div>
                )}
                {ticket.venue_name && <div>{ticket.venue_name}</div>}
                {ticket.venue_address && <div>{ticket.venue_address}</div>}
              </div>
              {ticket.tier_name && (
                <span className="mt-2 inline-block rounded-full border border-brand-600/25 bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
                  {ticket.tier_name}
                </span>
              )}
            </div>

            {/* Divider */}
            <hr className="my-4 border-t border-gray-100 dark:border-gray-800" />

            {/* QR code section */}
            <div className="space-y-4">
              {ticket.status === 'refunded' ? (
                <div className="flex items-center justify-center rounded-lg bg-brand-50 px-4 py-6 text-center dark:bg-brand-500/10">
                  <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">
                    This ticket has been refunded.
                  </p>
                </div>
              ) : (
                <>
                  {/* QR Code */}
                  {qrDataUrl && (
                    <div className="flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrDataUrl}
                        alt="Ticket QR code"
                        className="h-48 w-48 rounded-lg border border-gray-200 dark:border-gray-800"
                      />
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="flex justify-center">
                    <StatusBadge status={ticket.status} />
                  </div>

                  {/* Ticket ID */}
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400 mb-1">
                      Ticket ID
                    </p>
                    <p className="font-mono text-xs text-gray-700 break-all dark:text-gray-300">
                      {ticket.qr_token}
                    </p>
                  </div>

                  {/* Used notice */}
                  {ticket.status === 'used' && (
                    <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-white/[0.02]">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        This ticket was scanned at the door. Thanks for coming!
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Close hint */}
          <div className="border-t border-gray-100 px-5 py-3 text-center text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
            Press Esc or click outside to close
          </div>
        </div>
      </div>
    </>
  )
}
