'use client'

// "When should ticket sales stop?" — one event-wide setting, shown on the
// Ticketing tab. Presets are relative to the event's start time so they
// stay correct if the start time changes later.

import { useMemo, useState } from 'react'
import {
  EVENT_TZ,
  eventSalesEndAt,
  eventStartsAt,
  zonedTimeToUtc,
  type SalesCutoffEvent,
} from '@/lib/ticketSalesCutoff'

type Props = {
  eventId: string
  event: SalesCutoffEvent
  onSaved?: (next: Partial<SalesCutoffEvent>) => void
}

const PRESETS: { key: string; label: string; mode: 'none' | 'offset' | 'custom'; offset?: number }[] = [
  { key: 'b60', label: '1 hour before the event starts', mode: 'offset', offset: -60 },
  { key: 'o0', label: 'When the event starts', mode: 'offset', offset: 0 },
  { key: 'a60', label: '1 hour after the event starts', mode: 'offset', offset: 60 },
  { key: 'a120', label: '2 hours after the event starts', mode: 'offset', offset: 120 },
  { key: 'custom', label: 'At a specific date & time', mode: 'custom' },
  { key: 'none', label: "Don't stop automatically — I'll turn tickets off myself", mode: 'none' },
]

function presetKeyFor(ev: SalesCutoffEvent): string {
  const mode = ev.ticket_sales_end_mode || 'none'
  if (mode === 'none') return 'none'
  if (mode === 'custom') return 'custom'
  const hit = PRESETS.find(p => p.mode === 'offset' && p.offset === (ev.ticket_sales_end_offset_minutes || 0))
  return hit ? hit.key : 'o0'
}

const fmt = (d: Date) =>
  d.toLocaleString('en-US', {
    timeZone: EVENT_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

// UTC ISO -> "YYYY-MM-DDTHH:mm" in Topeka time, for <input type="datetime-local">
function toLocalInput(iso?: string | null) {
  if (!iso) return ''
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso))
  const g = (t: string) => p.find(x => x.type === t)?.value
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
}

export default function TicketSalesCutoffCard({ eventId, event, onSaved }: Props) {
  const [choice, setChoice] = useState(presetKeyFor(event))
  const [customLocal, setCustomLocal] = useState(toLocalInput(event.ticket_sales_end_at))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const preset = PRESETS.find(p => p.key === choice)!
  const startsAt = eventStartsAt(event)

  const customUtc = useMemo(() => {
    const m = customLocal.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/)
    return m ? zonedTimeToUtc(m[1], Number(m[2]), Number(m[3])) : null
  }, [customLocal])

  const preview = eventSalesEndAt({
    ...event,
    ticket_sales_end_mode: preset.mode,
    ticket_sales_end_offset_minutes: preset.offset ?? 0,
    ticket_sales_end_at: customUtc ? customUtc.toISOString() : null,
  })

  const dirty =
    choice !== presetKeyFor(event) ||
    (choice === 'custom' && customLocal !== toLocalInput(event.ticket_sales_end_at))

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      if (preset.mode === 'custom' && !customUtc) throw new Error('Choose a date and time')
      const res = await fetch(`/api/events/${eventId}/sales-cutoff`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: preset.mode,
          offsetMinutes: preset.offset ?? 0,
          endsAt: customUtc ? customUtc.toISOString() : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to save')
      onSaved?.(json)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="space-y-1.5">
        {PRESETS.map(p => (
          <label
            key={p.key}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
              choice === p.key
                ? 'border-brand-500 bg-brand-50/60 text-gray-900 dark:border-brand-500/60 dark:bg-brand-500/10 dark:text-white'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]'
            }`}
          >
            <input
              type="radio"
              name="sales-cutoff"
              checked={choice === p.key}
              onChange={() => setChoice(p.key)}
              className="accent-brand-600"
            />
            {p.label}
          </label>
        ))}
      </div>

      {choice === 'custom' && (
        <div className="mt-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
            Stop selling at (Topeka time)
          </label>
          <input
            type="datetime-local"
            value={customLocal}
            onChange={e => setCustomLocal(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
          />
        </div>
      )}

      <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-700 dark:bg-white/[0.03] dark:text-gray-300">
        {preset.mode === 'none' ? (
          <>Tickets stay on sale until you switch tiers off, or until each tier&rsquo;s own &ldquo;Sale Ends&rdquo; time.</>
        ) : preview ? (
          <>
            Online sales will stop <strong>{fmt(preview)}</strong>.
            {preset.mode === 'offset' && !startsAt && (
              <span className="mt-1 block text-xs text-warning-700 dark:text-warning-400">
                We couldn&rsquo;t read this event&rsquo;s start time, so sales will stop at the end of the event
                day. Add a start time to the event to use this option exactly.
              </span>
            )}
          </>
        ) : (
          <>Pick a date and time.</>
        )}
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          Applies to every tier, online and on your website embed. If a tier has an earlier &ldquo;Sale Ends&rdquo;
          time, that tier stops then. You can still add tickets by hand at the door.
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-xs font-semibold text-success-700 dark:text-success-400">Saved</span>}
        {error && <span className="text-xs font-medium text-brand-600 dark:text-brand-400">{error}</span>}
      </div>
    </div>
  )
}
