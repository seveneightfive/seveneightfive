'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { Loader2, Plus, Trash2, AlertCircle, Check, ChevronDown, ChevronUp, Pencil } from 'lucide-react'

type Tier = {
  id?: string
  name: string
  description: string
  price: string
  quantity: string
  sort_order: number
  is_active: boolean
  sale_starts_at: string
  sale_ends_at: string
  quantity_sold?: number
  _deleted?: boolean
  _new?: boolean
}

type Props = {
  eventId: string
  stripeAccountStatus: string | null
}

const EMPTY_TIER = (): Tier => ({
  name: '',
  description: '',
  price: '',
  quantity: '',
  sort_order: 0,
  is_active: true,
  sale_starts_at: '',
  sale_ends_at: '',
  _new: true,
})

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500'

const fieldLabelCls =
  'mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600 dark:text-gray-400'

const hintCls = 'mt-1 text-[11px] text-gray-400 dark:text-gray-500'

/**
 * Browsers (especially mobile Safari) sometimes return `YYYY-MM-DD` from a
 * <input type="datetime-local"> when the user fills only the date portion.
 * That bare date stores as NULL via `value || null`, which surprises users
 * who think they set a window. Pad to start-of-day or end-of-day so the
 * sale window actually saves.
 */
function expandSaleTime(value: string, kind: 'start' | 'end'): string | null {
  if (!value || !value.trim()) return null
  if (value.includes('T')) return value
  return kind === 'start' ? `${value}T00:00:00` : `${value}T23:59:59`
}

function formatSaleWindow(start: string, end: string): string | null {
  if (!start && !end) return null
  const fmt = (s: string) => {
    if (!s) return ''
    try {
      const d = new Date(s.includes('T') ? s : `${s}T00:00:00`)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return s
    }
  }
  if (start && end) return `Sales: ${fmt(start)} – ${fmt(end)}`
  if (start) return `Sales start ${fmt(start)}`
  return `Sales end ${fmt(end)}`
}

export default function TicketTiersEditor({ eventId, stripeAccountStatus }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Track which tiers are expanded (showing the edit form vs just the card)
  // Key is tier index in the `tiers` array. New unsaved tiers default open.
  const [openTiers, setOpenTiers] = useState<Record<number, boolean>>({})

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: event }, { data: existingTiers }] = await Promise.all([
        supabase.from('events').select('ticketing_enabled').eq('id', eventId).single(),
        supabase.from('ticket_tiers').select('*').eq('event_id', eventId).order('sort_order'),
      ])
      setEnabled(event?.ticketing_enabled || false)
      setTiers(
        existingTiers?.map((t) => ({
          ...t,
          price: String(t.price),
          quantity: t.quantity !== null ? String(t.quantity) : '',
          sale_starts_at: t.sale_starts_at ? t.sale_starts_at.slice(0, 16) : '',
          sale_ends_at: t.sale_ends_at ? t.sale_ends_at.slice(0, 16) : '',
          description: t.description || '',
        })) || []
      )
      setLoading(false)
    }
    load()
  }, [eventId])

  const addTier = () => {
    setTiers((prev) => {
      const next = [...prev, { ...EMPTY_TIER(), sort_order: prev.length }]
      // Auto-open the newly added tier
      setOpenTiers((o) => ({ ...o, [next.length - 1]: true }))
      return next
    })
  }

  const updateTier = (index: number, field: keyof Tier, value: any) => {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  }

  const deleteTier = (index: number) => {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, _deleted: true } : t)))
  }

  const toggleOpen = (index: number) => {
    setOpenTiers((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const { error: evErr } = await supabase
        .from('events')
        .update({
          ticketing_enabled: enabled,
          ticket_platform: enabled ? '785tickets' : 'external',
        })
        .eq('id', eventId)
      if (evErr) throw evErr

      const activeTiers = tiers.filter((t) => !t._deleted)
      const deletedTiers = tiers.filter((t) => t._deleted && t.id)

      for (const t of deletedTiers) {
        await supabase.from('ticket_tiers').delete().eq('id', t.id!)
      }

      const updatedTiers = [...tiers]
      for (let i = 0; i < activeTiers.length; i++) {
        const t = activeTiers[i]
        const payload = {
          event_id: eventId,
          name: t.name,
          description: t.description || null,
          price: parseFloat(t.price) || 0,
          quantity: t.quantity !== '' ? parseInt(t.quantity) : null,
          sort_order: i,
          is_active: t.is_active,
          sale_starts_at: expandSaleTime(t.sale_starts_at, 'start'),
          sale_ends_at: expandSaleTime(t.sale_ends_at, 'end'),
        }

        if (t.id) {
          const { error } = await supabase.from('ticket_tiers').update(payload).eq('id', t.id)
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('ticket_tiers')
            .insert(payload)
            .select('id')
            .single()
          if (error) throw error
          const idx = updatedTiers.indexOf(t)
          if (idx >= 0) updatedTiers[idx] = { ...t, id: data.id, _new: false }
        }
      }
      setTiers(updatedTiers)

      // Collapse all tiers after a successful save — clearer UX
      setOpenTiers({})

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const activeTiers = tiers.filter((t) => !t._deleted)
  const isStripeReady = stripeAccountStatus === 'enabled'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
        <div>
          <span className="block text-sm font-semibold text-gray-900 dark:text-white">
            {enabled ? 'Ticketing is on' : 'Ticketing is off'}
          </span>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            {enabled
              ? 'Buyers can purchase tickets to this event.'
              : 'Turn on to start configuring tiers.'}
          </span>
        </div>
        <span className="relative inline-block h-6 w-11 shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="peer absolute h-0 w-0 opacity-0"
          />
          <span className="absolute inset-0 cursor-pointer rounded-full bg-gray-300 transition peer-checked:bg-brand-600 dark:bg-gray-700" />
          <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </span>
      </label>

      {/* Stripe-not-ready warning */}
      {enabled && !isStripeReady && (
        <div className="flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            You need to{' '}
            <a
              href="/dashboard/payouts"
              className="font-semibold underline hover:text-warning-800 dark:hover:text-warning-300"
            >
              finish Stripe Connect
            </a>{' '}
            before buyers can purchase tickets. You can still set up tiers now.
          </span>
        </div>
      )}

      {/* Tiers list */}
      {enabled && (
        <>
          {activeTiers.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-400">
              No ticket tiers yet. Tap <span className="font-semibold">Create Ticket Tier</span> below to add one.
            </div>
          )}

          {activeTiers.map((tier) => {
            const realIndex = tiers.indexOf(tier)
            const isOpen = !!openTiers[realIndex]
            const isUnsaved = !tier.id

            // Card summary (collapsed view)
            const priceLabel =
              tier.price === '' || tier.price === '0' || tier.price === '0.00'
                ? 'Free'
                : `$${parseFloat(tier.price || '0').toFixed(2)}`
            const qtyLabel = tier.quantity
              ? `${tier.quantity_sold || 0}/${tier.quantity} sold`
              : tier.quantity_sold
                ? `${tier.quantity_sold} sold`
                : 'Unlimited'
            const saleWindow = formatSaleWindow(tier.sale_starts_at, tier.sale_ends_at)

            return (
              <div
                key={tier.id || `new-${realIndex}`}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"
              >
                {/* Collapsed summary header (always visible) */}
                <button
                  type="button"
                  onClick={() => toggleOpen(realIndex)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {tier.name || 'Untitled tier'}
                      </span>
                      {isUnsaved && (
                        <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300">
                          Unsaved
                        </span>
                      )}
                      {!tier.is_active && (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span>{priceLabel}</span>
                      <span>·</span>
                      <span>{qtyLabel}</span>
                      {saleWindow && (
                        <>
                          <span>·</span>
                          <span>{saleWindow}</span>
                        </>
                      )}
                    </div>
                    {tier.description && (
                      <div className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                        {tier.description}
                      </div>
                    )}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-gray-400 dark:text-gray-500">
                    {isOpen ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        <span className="hidden sm:inline">Close</span>
                      </>
                    ) : (
                      <>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </>
                    )}
                  </span>
                </button>

                {/* Expanded edit form */}
                {isOpen && (
                  <div className="space-y-3 border-t border-gray-100 p-4 dark:border-gray-800">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                      <div>
                        <label className={fieldLabelCls}>Tier Name *</label>
                        <input
                          type="text"
                          placeholder="General Admission"
                          value={tier.name}
                          onChange={(e) => updateTier(realIndex, 'name', e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={fieldLabelCls}>Price ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0 = Free"
                          value={tier.price}
                          onChange={(e) => updateTier(realIndex, 'price', e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={fieldLabelCls}>Quantity</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Unlimited"
                          value={tier.quantity}
                          onChange={(e) => updateTier(realIndex, 'quantity', e.target.value)}
                          className={inputCls}
                        />
                        <p className={hintCls}>Leave blank for unlimited</p>
                      </div>
                    </div>

                    <div>
                      <label className={fieldLabelCls}>Description (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Includes meet & greet"
                        value={tier.description}
                        onChange={(e) => updateTier(realIndex, 'description', e.target.value)}
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={fieldLabelCls}>Sale Starts</label>
                        <input
                          type="datetime-local"
                          value={tier.sale_starts_at}
                          onChange={(e) => updateTier(realIndex, 'sale_starts_at', e.target.value)}
                          className={inputCls}
                        />
                        <p className={hintCls}>Leave blank to sell immediately.</p>
                      </div>
                      <div>
                        <label className={fieldLabelCls}>Sale Ends</label>
                        <input
                          type="datetime-local"
                          value={tier.sale_ends_at}
                          onChange={(e) => updateTier(realIndex, 'sale_ends_at', e.target.value)}
                          className={inputCls}
                        />
                        <p className={hintCls}>Leave blank to sell until event.</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={tier.is_active}
                          onChange={(e) => updateTier(realIndex, 'is_active', e.target.checked)}
                          className="h-4 w-4 accent-brand-600"
                        />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Active (visible for purchase)
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => deleteTier(realIndex)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 transition hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={addTier}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-400 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
          >
            <Plus className="h-4 w-4" />
            Create Ticket Tier
          </button>
        </>
      )}

      {/* Save row */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            saved
              ? 'bg-success-600 text-white'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saving ? 'Saving…' : saved ? 'Saved' : enabled ? 'Save Ticketing' : 'Save'}
        </button>
        {error && (
          <span className="inline-flex items-center gap-1.5 text-sm text-brand-700 dark:text-brand-400">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
        )}
      </div>
    </div>
  )
}
