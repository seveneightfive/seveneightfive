'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

type Tier = {
  id: string
  name: string
  description: string | null
  price: number
  quantity: number | null
  quantity_sold: number
  sale_starts_at: string | null
  sale_ends_at: string | null
  is_active: boolean
  is_group: boolean
  seats_per_unit: number
}

type QuestionField = {
  id: string
  field_type: 'text' | 'select' | 'checkbox'
  label: string
  placeholder: string | null
  options: string[] | null
  is_required: boolean
}

type Addon = {
  id: string
  ticket_tier_id: string
  name: string
  price: number
  has_choice: boolean
  choice_label: string | null
  choice_options: string[] | null
}

type AttendeeSlot = {
  key: string
  tierId: string
  tierName: string
  index: number
}

type TableUnit = {
  key: string
  tierId: string
  tierName: string
  seatsPerUnit: number
  index: number
}

type Props = {
  eventId: string
  eventSlug: string
}

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s().\-]/g, '')
  if (!cleaned) return null
  if (cleaned.startsWith('+')) return cleaned.length >= 8 ? cleaned : null
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

function isEmailish(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

/**
 * Mirror of lib/stripe.ts buyer-side math so we can preview the fee
 * before redirecting to Stripe. If lib/stripe.ts constants change they
 * must change here too — intentionally duplicated because lib/stripe.ts
 * is server-only.
 */
const STRIPE_FEE_PERCENT = 0.029
const STRIPE_FIXED_FEE_CENTS = 30
function serviceFeeCentsForPreview(priceInCents: number): number {
  if (priceInCents <= 0) return 0
  const est = Math.ceil(priceInCents * STRIPE_FEE_PERCENT) + STRIPE_FIXED_FEE_CENTS
  return Math.ceil(est / 10) * 10
}

const MAX_ANSWER_LEN = 120
const MAX_NAME_LEN = 60
const NO_CHOICE_KEY = '_default'

export default function TicketPurchaseButton({ eventId, eventSlug }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [addonsByTier, setAddonsByTier] = useState<Record<string, Addon[]>>({})
  const [cart, setCart] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [rsvpDone, setRsvpDone] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profileFullName, setProfileFullName] = useState('')

  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')

  // Custom buyer questions, per event / per tier
  const [eventLevelFields, setEventLevelFields] = useState<QuestionField[]>([])
  const [tierFields, setTierFields] = useState<Record<string, QuestionField[]>>({})

  // Per-attendee data — keyed by AttendeeSlot.key
  const [attendeeNames, setAttendeeNames] = useState<Record<string, string>>({})
  const [attendeeEmails, setAttendeeEmails] = useState<Record<string, string>>({})
  const [attendeeAnswers, setAttendeeAnswers] = useState<Record<string, Record<string, string>>>({})
  const [manuallyEditedNames, setManuallyEditedNames] = useState<Set<string>>(new Set())
  // slotKey -> addonId -> { selected, choice }
  const [attendeeAddons, setAttendeeAddons] = useState<Record<string, Record<string, { selected: boolean; choice: string }>>>({})

  // Per-table data (group/table tiers) — keyed by TableUnit.key
  const [tableAnswers, setTableAnswers] = useState<Record<string, Record<string, string>>>({})
  // tableKey -> addonId -> choiceKey (NO_CHOICE_KEY if no choices) -> quantity
  const [tableAddonQty, setTableAddonQty] = useState<Record<string, Record<string, Record<string, number>>>>({})

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUserId(user?.id ?? null)
      setSessionChecked(true)
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        setProfileFullName(profile?.full_name || '')
      }
    })
    supabase
      .from('ticket_tiers')
      .select(
        'id, name, description, price, quantity, quantity_sold, sale_starts_at, sale_ends_at, is_active, is_group, seats_per_unit'
      )
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('sort_order')
      .then(async ({ data }) => {
        const now = new Date()
        const available = (data || []).filter((t) => {
          if (t.sale_starts_at && new Date(t.sale_starts_at) > now) return false
          if (t.sale_ends_at && new Date(t.sale_ends_at) < now) return false
          const seatsPerUnit = t.is_group ? t.seats_per_unit : 1
          if (t.quantity !== null) {
            const unitsSold = Math.floor(t.quantity_sold / seatsPerUnit)
            if (t.quantity - unitsSold <= 0) return false
          }
          return true
        }) as Tier[]
        setTiers(available)

        if (available.length > 0) {
          const { data: addonRows } = await supabase
            .from('event_addons')
            .select('id, ticket_tier_id, name, price, has_choice, choice_label, choice_options')
            .in('ticket_tier_id', available.map((t) => t.id))
            .eq('is_active', true)
            .order('sort_order')

          const grouped: Record<string, Addon[]> = {}
          for (const a of addonRows || []) {
            grouped[a.ticket_tier_id] = grouped[a.ticket_tier_id] || []
            grouped[a.ticket_tier_id].push(a as Addon)
          }
          setAddonsByTier(grouped)
        }

        setLoading(false)
      })

    fetch(`/api/events/${eventId}/form-fields`)
      .then((r) => r.json())
      .then((json) => {
        setEventLevelFields(json.eventLevel || [])
        setTierFields(json.byTier || {})
      })
      .catch(() => { /* non-fatal — checkout still works without questions */ })
  }, [eventId])

  const isFreeEvent = tiers.length > 0 && tiers.every((t) => t.price === 0)

  const cartEntries = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([tierId, qty]) => ({ tier: tiers.find((t) => t.id === tierId)!, qty }))
        .filter((e) => e.tier),
    [cart, tiers]
  )

  const individualEntries = cartEntries.filter((e) => !e.tier.is_group)
  const groupEntries = cartEntries.filter((e) => e.tier.is_group)

  const totalQuantity = cartEntries.reduce((sum, e) => sum + e.qty, 0)
  // Lock (free vs paid, can't mix in one order) is based on TIER price
  // only — addons riding along don't change which tiers are lockable,
  // they just change whether the final total ends up being $0 or not.
  const cartHasPaidTier = cartEntries.some((e) => e.tier.price > 0)
  const cartHasFreeTier = cartEntries.some((e) => e.tier.price === 0)
  const isGuest = sessionChecked && !userId

  function questionsForTier(tierId: string): QuestionField[] {
    return [...eventLevelFields, ...(tierFields[tierId] || [])]
  }

  const attendeeSlots: AttendeeSlot[] = useMemo(() => {
    const slots: AttendeeSlot[] = []
    for (const e of individualEntries) {
      for (let i = 0; i < e.qty; i++) {
        slots.push({ key: `${e.tier.id}__${i}`, tierId: e.tier.id, tierName: e.tier.name, index: i })
      }
    }
    return slots
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, tiers])

  const tableUnits: TableUnit[] = useMemo(() => {
    const units: TableUnit[] = []
    for (const e of groupEntries) {
      for (let i = 0; i < e.qty; i++) {
        units.push({ key: `${e.tier.id}__table__${i}`, tierId: e.tier.id, tierName: e.tier.name, seatsPerUnit: e.tier.seats_per_unit, index: i })
      }
    }
    return units
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, tiers])

  // Prefill the very first attendee's name from the purchaser's own
  // name, purely as a convenience for the common single-ticket case.
  useEffect(() => {
    const firstSlot = attendeeSlots[0]
    if (!firstSlot) return
    if (manuallyEditedNames.has(firstSlot.key)) return
    const source = isGuest ? guestName : profileFullName
    if (source) setAttendeeNames((n) => ({ ...n, [firstSlot.key]: source }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendeeSlots[0]?.key, isGuest, guestName, profileFullName])

  function setQty(tierId: string, qty: number) {
    setCart((c) => ({ ...c, [tierId]: Math.max(0, qty) }))
    if (error) setError('')
  }

  function remainingUnitsFor(tier: Tier): number | null {
    if (tier.quantity === null) return null
    const seatsPerUnit = tier.is_group ? tier.seats_per_unit : 1
    const unitsSold = Math.floor(tier.quantity_sold / seatsPerUnit)
    return tier.quantity - unitsSold
  }

  function maxQtyFor(tier: Tier): number {
    const remaining = remainingUnitsFor(tier)
    return Math.min(remaining ?? 10, 10)
  }

  function tierIsLocked(tier: Tier): boolean {
    if (tier.price > 0) return cartHasFreeTier
    return cartHasPaidTier
  }

  function setAttendeeName(slotKey: string, value: string) {
    setManuallyEditedNames((s) => new Set(s).add(slotKey))
    setAttendeeNames((n) => ({ ...n, [slotKey]: value }))
    if (error) setError('')
  }
  function setAttendeeEmail(slotKey: string, value: string) {
    setAttendeeEmails((e) => ({ ...e, [slotKey]: value }))
    if (error) setError('')
  }
  function setAttendeeAnswer(slotKey: string, fieldId: string, value: string) {
    setAttendeeAnswers((a) => ({ ...a, [slotKey]: { ...(a[slotKey] || {}), [fieldId]: value } }))
    if (error) setError('')
  }
  function setAttendeeAddonSelected(slotKey: string, addonId: string, selected: boolean) {
    setAttendeeAddons((a) => ({
      ...a,
      [slotKey]: { ...(a[slotKey] || {}), [addonId]: { selected, choice: a[slotKey]?.[addonId]?.choice || '' } },
    }))
    if (error) setError('')
  }
  function setAttendeeAddonChoice(slotKey: string, addonId: string, choice: string) {
    setAttendeeAddons((a) => ({
      ...a,
      [slotKey]: { ...(a[slotKey] || {}), [addonId]: { selected: true, choice } },
    }))
    if (error) setError('')
  }

  function setTableAnswer(tableKey: string, fieldId: string, value: string) {
    setTableAnswers((a) => ({ ...a, [tableKey]: { ...(a[tableKey] || {}), [fieldId]: value } }))
    if (error) setError('')
  }
  function setTableAddonChoiceQty(tableKey: string, addonId: string, choiceKey: string, qty: number) {
    setTableAddonQty((prev) => ({
      ...prev,
      [tableKey]: {
        ...(prev[tableKey] || {}),
        [addonId]: { ...(prev[tableKey]?.[addonId] || {}), [choiceKey]: Math.max(0, qty) },
      },
    }))
    if (error) setError('')
  }

  function attendeeAddonCostCents(slotKey: string, tierId: string): number {
    let total = 0
    const sel = attendeeAddons[slotKey] || {}
    for (const addon of addonsByTier[tierId] || []) {
      if (sel[addon.id]?.selected) total += Math.round(addon.price * 100)
    }
    return total
  }
  function tableAddonCostCents(tableKey: string, tierId: string): number {
    let total = 0
    const addonSel = tableAddonQty[tableKey] || {}
    for (const addon of addonsByTier[tierId] || []) {
      const choiceMap = addonSel[addon.id] || {}
      const qty = Object.values(choiceMap).reduce((s, n) => s + n, 0)
      total += Math.round(addon.price * 100) * qty
    }
    return total
  }
  function tableAddonTotalQty(tableKey: string, addonId: string): number {
    const choiceMap = tableAddonQty[tableKey]?.[addonId] || {}
    return Object.values(choiceMap).reduce((s, n) => s + n, 0)
  }

  const validateGuest = (): string | null => {
    if (!guestName.trim()) return 'Your name is required.'
    if (!isEmailish(guestEmail)) return 'Please enter a valid email.'
    if (cartHasPaidTier || totalAddonCostCents() > 0) {
      const normalized = normalizePhone(guestPhone)
      if (!normalized) return 'Please enter a valid phone number.'
    }
    return null
  }

  function totalAddonCostCents(): number {
    let total = 0
    for (const slot of attendeeSlots) total += attendeeAddonCostCents(slot.key, slot.tierId)
    for (const unit of tableUnits) total += tableAddonCostCents(unit.key, unit.tierId)
    return total
  }

  const validateAttendees = (): string | null => {
    for (let i = 0; i < attendeeSlots.length; i++) {
      const slot = attendeeSlots[i]
      const name = (attendeeNames[slot.key] || '').trim()
      const nLabel = attendeeSlots.length > 1 ? `Attendee ${i + 1}'s` : "Attendee's"
      if (!name) return `${nLabel} name is required.`
      const email = (attendeeEmails[slot.key] || '').trim()
      if (email && !isEmailish(email)) return `${nLabel} email doesn't look right.`
      for (const q of questionsForTier(slot.tierId)) {
        const val = (attendeeAnswers[slot.key]?.[q.id] || '').trim()
        if (q.is_required && !val) {
          return `"${q.label}" is required for ${attendeeSlots.length > 1 ? `Attendee ${i + 1}` : 'this ticket'}.`
        }
      }
      for (const addon of addonsByTier[slot.tierId] || []) {
        const sel = attendeeAddons[slot.key]?.[addon.id]
        if (sel?.selected && addon.has_choice && !sel.choice) {
          return `Please choose ${addon.choice_label || 'an option'} for "${addon.name}" (${attendeeSlots.length > 1 ? `Attendee ${i + 1}` : 'this ticket'}).`
        }
      }
    }
    return null
  }

  const validateTables = (): string | null => {
    for (let i = 0; i < tableUnits.length; i++) {
      const unit = tableUnits[i]
      const tLabel = tableUnits.length > 1 ? `Table ${i + 1}` : 'the table'
      for (const q of questionsForTier(unit.tierId)) {
        const val = (tableAnswers[unit.key]?.[q.id] || '').trim()
        if (q.is_required && !val) return `"${q.label}" is required for ${tLabel}.`
      }
      for (const addon of addonsByTier[unit.tierId] || []) {
        const total = tableAddonTotalQty(unit.key, addon.id)
        if (total > unit.seatsPerUnit) {
          return `"${addon.name}" total can't exceed ${unit.seatsPerUnit} seats for ${tLabel}.`
        }
      }
    }
    return null
  }

  const handleAction = async () => {
    setError('')

    if (totalQuantity === 0) {
      setError('Add at least one ticket.')
      return
    }

    let guestPayload: { name: string; email: string; phone: string | null } | null = null
    if (isGuest) {
      const v = validateGuest()
      if (v) { setError(v); return }
      guestPayload = { name: guestName.trim(), email: guestEmail.trim().toLowerCase(), phone: normalizePhone(guestPhone) }
    }

    const aErr = validateAttendees()
    if (aErr) { setError(aErr); return }
    const tErr = validateTables()
    if (tErr) { setError(tErr); return }

    const items = cartEntries.map((e) => ({ tierId: e.tier.id, quantity: e.qty }))

    const attendees = attendeeSlots.map((slot) => ({
      tierId: slot.tierId,
      name: (attendeeNames[slot.key] || '').trim(),
      email: (attendeeEmails[slot.key] || '').trim() || null,
      responses: questionsForTier(slot.tierId)
        .map((q) => ({ field_id: q.id, value: (attendeeAnswers[slot.key]?.[q.id] || '').trim() }))
        .filter((r) => r.value.length > 0),
      addons: (addonsByTier[slot.tierId] || [])
        .filter((addon) => attendeeAddons[slot.key]?.[addon.id]?.selected)
        .map((addon) => ({ addon_id: addon.id, choice: attendeeAddons[slot.key]?.[addon.id]?.choice || null })),
    }))

    const tables = tableUnits.map((unit) => {
      const addonsPayload: { addon_id: string; choice: string | null; quantity: number }[] = []
      for (const addon of addonsByTier[unit.tierId] || []) {
        const choiceMap = tableAddonQty[unit.key]?.[addon.id] || {}
        for (const [choiceKey, qty] of Object.entries(choiceMap)) {
          if (qty > 0) addonsPayload.push({ addon_id: addon.id, choice: choiceKey === NO_CHOICE_KEY ? null : choiceKey, quantity: qty })
        }
      }
      return {
        tierId: unit.tierId,
        responses: questionsForTier(unit.tierId)
          .map((q) => ({ field_id: q.id, value: (tableAnswers[unit.key]?.[q.id] || '').trim() }))
          .filter((r) => r.value.length > 0),
        addons: addonsPayload,
      }
    })

    const orderIsPaid = orderTotalBeforeFeesCents() > 0

    setPurchasing(true)

    try {
      if (!orderIsPaid) {
        const res = await fetch('/api/tickets/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, items, guest: guestPayload, attendees, tables }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error || 'Something went wrong. Please try again.'); setPurchasing(false); return }
        setRsvpDone(true)
        setExpanded(false)
        setPurchasing(false)
      } else {
        const res = await fetch('/api/tickets/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, items, guest: guestPayload, attendees, tables }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error || 'Something went wrong. Please try again.'); setPurchasing(false); return }
        window.location.href = json.url
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setPurchasing(false)
    }
  }

  function orderTotalBeforeFeesCents(): number {
    const tierSubtotal = cartEntries.reduce((sum, e) => sum + Math.round(e.tier.price * 100) * e.qty, 0)
    return tierSubtotal + totalAddonCostCents()
  }

  if (loading || tiers.length === 0) return null

  const tierSubtotalCents = cartEntries.reduce((sum, e) => sum + Math.round(e.tier.price * 100) * e.qty, 0)
  const addonSubtotalCents = totalAddonCostCents()
  const subtotalCents = tierSubtotalCents + addonSubtotalCents

  const tierFeeCents = cartEntries.reduce((sum, e) => sum + serviceFeeCentsForPreview(Math.round(e.tier.price * 100)) * e.qty, 0)
  let addonFeeCents = 0
  for (const slot of attendeeSlots) {
    for (const addon of addonsByTier[slot.tierId] || []) {
      if (attendeeAddons[slot.key]?.[addon.id]?.selected) addonFeeCents += serviceFeeCentsForPreview(Math.round(addon.price * 100))
    }
  }
  for (const unit of tableUnits) {
    for (const addon of addonsByTier[unit.tierId] || []) {
      const qty = tableAddonTotalQty(unit.key, addon.id)
      addonFeeCents += serviceFeeCentsForPreview(Math.round(addon.price * 100)) * qty
    }
  }
  const serviceFeeTotalCents = tierFeeCents + addonFeeCents
  const orderIsPaid = subtotalCents > 0
  const totalCents = subtotalCents + serviceFeeTotalCents

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`
  const serviceFeeDisplay = fmt(serviceFeeTotalCents)
  const totalDisplay = fmt(totalCents)

  const lowestPrice = Math.min(...tiers.map((t) => t.price))
  const headerLabel = isFreeEvent ? 'Free Event' : 'Tickets'
  const headerPrice = isFreeEvent ? 'Free' : `From $${lowestPrice.toFixed(2)}`
  const ctaLabel = isFreeEvent ? 'RSVP' : 'Get Tickets'

  const confirmLabel = purchasing
    ? orderIsPaid ? 'Redirecting to checkout…' : 'Saving your RSVP…'
    : totalQuantity === 0
      ? 'Select tickets above'
      : orderIsPaid
        ? `Continue · ${totalDisplay}`
        : `RSVP — ${totalQuantity} ${groupEntries.length > 0 && individualEntries.length === 0 ? 'Table' : 'Guest'}${totalQuantity > 1 ? 's' : ''}`

  return (
    <div style={{ margin: '24px 0' }}>
      <style>{`
        .tpb-wrap { border: 1.5px solid #ece8e2; border-radius: 12px; overflow: hidden; background: #f7f6f4; color-scheme: light; }
        .tpb-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; cursor: pointer; user-select: none; }
        .tpb-header-left { display: flex; flex-direction: column; gap: 3px; }
        .tpb-eyebrow { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #b8b3ad; }
        .tpb-price { font-family: 'Oswald', sans-serif; font-size: 1.3rem; font-weight: 600; color: #1a1814; }
        .tpb-price-free { color: #2d7a2d; }
        .tpb-price-note { font-size: 0.7rem; font-weight: 400; color: #6b6560; margin-left: 6px; }
        .tpb-action-btn { padding: 11px 22px; border: none; border-radius: 8px; font-family: 'Oswald', sans-serif; font-size: 0.85rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #fff; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .tpb-action-btn.paid { background: #C80650; }
        .tpb-action-btn.paid:hover { background: #a8041f; }
        .tpb-action-btn.free { background: #2d7a2d; }
        .tpb-action-btn.free:hover { background: #235e23; }
        .tpb-expand { padding: 0 20px 20px; border-top: 1px solid #ece8e2; }
        .tpb-tiers { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .tpb-tier { padding: 12px 14px; border-radius: 8px; border: 1.5px solid #ece8e2; background: #fff; display: flex; align-items: center; justify-content: space-between; gap: 12px; transition: all 0.15s; }
        .tpb-tier.in-cart { border-color: #C80650; background: rgba(200,6,80,0.04); }
        .tpb-tier.locked { opacity: 0.45; }
        .tpb-tier-name { font-weight: 500; font-size: 0.9rem; color: #1a1814; }
        .tpb-tier-badge { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px; background: #e6f0ff; color: #1a56b0; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; vertical-align: middle; }
        .tpb-tier-desc { font-size: 0.78rem; color: #6b6560; margin-top: 2px; }
        .tpb-tier-price { font-family: 'Oswald', sans-serif; font-size: 0.95rem; font-weight: 600; color: #1a1814; flex-shrink: 0; }
        .tpb-tier-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .tpb-tier-note { font-size: 0.68rem; color: #a85a30; font-weight: 500; }
        .tpb-qty-ctrl { display: flex; align-items: center; border: 1.5px solid #ece8e2; border-radius: 8px; overflow: hidden; }
        .tpb-qty-btn { width: 30px; height: 30px; border: none; background: #fff; font-size: 1rem; cursor: pointer; color: #1a1814; transition: background 0.1s; }
        .tpb-qty-btn:hover:not(:disabled) { background: #f0ede8; }
        .tpb-qty-btn:disabled { color: #d8d3cd; cursor: not-allowed; }
        .tpb-qty-num { width: 30px; text-align: center; font-weight: 600; font-size: 0.88rem; background: #fff; border-left: 1.5px solid #ece8e2; border-right: 1.5px solid #ece8e2; height: 30px; display: flex; align-items: center; justify-content: center; }
        .tpb-lock-note { margin-top: 8px; font-size: 0.72rem; color: #a85a30; }
        .tpb-summary { margin-top: 16px; padding: 12px 14px; background: #fff; border: 1.5px solid #ece8e2; border-radius: 8px; }
        .tpb-summary-row { display: flex; align-items: baseline; justify-content: space-between; font-size: 0.85rem; color: #1a1814; }
        .tpb-summary-row + .tpb-summary-row { margin-top: 6px; }
        .tpb-summary-label { color: #6b6560; }
        .tpb-summary-total { border-top: 1px solid #ece8e2; margin-top: 10px; padding-top: 10px; font-family: 'Oswald', sans-serif; font-size: 1rem; font-weight: 600; }
        .tpb-error { margin-top: 12px; padding: 10px 14px; background: #2e0a15; border: 1px solid rgba(200,6,80,0.4); border-radius: 8px; font-size: 0.82rem; color: #ff6b93; }
        .tpb-guest-form { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
        .tpb-guest-row { display: flex; flex-direction: column; gap: 4px; }
        .tpb-guest-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6560; }
        .tpb-guest-input { padding: 10px 12px; font-size: 0.92rem; border: 1.5px solid #ece8e2; border-radius: 8px; background: #fff; color: #1a1814; outline: none; transition: border-color 0.15s; }
        .tpb-guest-input:focus { border-color: #C80650; }
        .tpb-guest-hint { font-size: 0.72rem; color: #8a8580; }
        .tpb-guest-signin { font-size: 0.78rem; color: #6b6560; margin-top: 4px; text-align: center; }
        .tpb-guest-signin a { color: #C80650; text-decoration: underline; font-weight: 500; }
        .tpb-attendees { margin-top: 16px; padding-top: 14px; border-top: 1px solid #ece8e2; }
        .tpb-attendees-title { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6560; margin-bottom: 10px; display: block; }
        .tpb-attendee-card { padding: 14px; border: 1.5px solid #ece8e2; border-radius: 8px; background: #fff; }
        .tpb-attendee-card + .tpb-attendee-card { margin-top: 10px; }
        .tpb-attendee-heading { font-size: 0.78rem; font-weight: 600; color: #1a1814; margin-bottom: 10px; }
        .tpb-attendee-heading span { font-weight: 400; color: #6b6560; }
        .tpb-attendee-fields { display: flex; flex-direction: column; gap: 8px; }
        .tpb-checkbox-row { display: flex; align-items: center; gap: 8px; }
        .tpb-checkbox-row input { width: 16px; height: 16px; }
        .tpb-checkout-section { margin-top: 16px; padding: 16px; border-radius: 10px; background: #17140f; }
        .tpb-checkout-section .tpb-attendees-title { color: #c9c4bc; }
        .tpb-guest-form .tpb-guest-label { color: #c9c4bc; }
        .tpb-guest-form .tpb-guest-hint { color: #9a948c; }
        .tpb-guest-form .tpb-guest-signin { color: #b8b3ad; }
        .tpb-guest-form .tpb-guest-signin a { color: #ff9dbb; }
        .tpb-addon-section { margin-top: 12px; padding: 10px; border-radius: 8px; background: #000; border: 1.5px solid #3a352e; }
        .tpb-addon-heading { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #ffffff; margin-bottom: 6px; display: block; }
        .tpb-addon-row { padding: 10px; border-radius: 8px; border: 1.5px solid #ece8e2; background: #ffffff !important; cursor: pointer; transition: border-color 0.12s; }
        .tpb-addon-row:hover { border-color: #d8d3cc; }
        .tpb-addon-row.selected { border-color: #C80650; background: #ffffff !important; }
        .tpb-addon-row + .tpb-addon-row { margin-top: 8px; }
        .tpb-addon-label-row { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
        .tpb-addon-name { font-size: 0.9rem; color: #1a1814 !important; font-weight: 600; }
        .tpb-addon-price { font-size: 0.88rem; color: #C80650; font-weight: 700; }
        .tpb-table-note { font-size: 0.75rem; color: #6b6560; margin-bottom: 10px; padding: 8px 10px; background: #f7f6f4; border-radius: 6px; }
        .tpb-table-addon-choice-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; gap: 10px; }
        .tpb-table-addon-choice-label { font-size: 0.82rem; color: #1a1814 !important; flex: 1; }
        .tpb-table-addon-qty-input { width: 56px; padding: 6px 8px; font-size: 0.85rem; border: 1.5px solid #ece8e2; border-radius: 6px; text-align: center; background: #fff; color: #1a1814; }
        .tpb-table-addon-hint { font-size: 0.7rem; color: #8a8580; margin-top: 4px; }
        .tpb-confirm-btn { margin-top: 16px; width: 100%; padding: 14px; border: none; border-radius: 8px; font-family: 'Oswald', sans-serif; font-size: 0.9rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #fff; cursor: pointer; transition: all 0.15s; }
        .tpb-confirm-btn.paid { background: #C80650; }
        .tpb-confirm-btn.paid:hover:not(:disabled) { background: #a8041f; }
        .tpb-confirm-btn.free { background: #2d7a2d; }
        .tpb-confirm-btn.free:hover:not(:disabled) { background: #235e23; }
        .tpb-confirm-btn.neutral { background: #b8b3ad; }
        .tpb-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .tpb-rsvp-done { padding: 16px 20px; display: flex; align-items: center; gap: 10px; background: rgba(45,122,45,0.06); }
        .tpb-rsvp-check { font-size: 1.1rem; }
        .tpb-rsvp-text { font-size: 0.85rem; color: #2d7a2d; font-weight: 500; }
        .tpb-rsvp-sub { font-size: 0.75rem; color: #6b6560; margin-top: 2px; }
      `}</style>

      <div className="tpb-wrap">
        {rsvpDone ? (
          <div className="tpb-rsvp-done">
            <span className="tpb-rsvp-check">✓</span>
            <div>
              <div className="tpb-rsvp-text">You&apos;re going!</div>
              <div className="tpb-rsvp-sub">
                {isGuest ? 'Confirmation has been recorded. Check your email for details.' : 'Check your dashboard to view your RSVP.'}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="tpb-header" onClick={() => setExpanded((e) => !e)}>
              <div className="tpb-header-left">
                <span className="tpb-eyebrow">{headerLabel}</span>
                <span className={`tpb-price ${isFreeEvent ? 'tpb-price-free' : ''}`}>
                  {headerPrice}
                  {!isFreeEvent && <span className="tpb-price-note">+ service fee</span>}
                  {tiers.length > 1 && <span className="tpb-price-note">· {tiers.length} options</span>}
                </span>
              </div>
              {!expanded && (
                <button className={`tpb-action-btn ${isFreeEvent ? 'free' : 'paid'}`} onClick={(e) => { e.stopPropagation(); setExpanded(true) }}>
                  {ctaLabel}
                </button>
              )}
              {expanded && <span style={{ fontSize: '0.75rem', color: '#6b6560', cursor: 'pointer' }}>✕ Close</span>}
            </div>

            {expanded && (
              <div className="tpb-expand">
                <div className="tpb-tiers">
                  {tiers.map((t) => {
                    const remaining = remainingUnitsFor(t)
                    const qty = cart[t.id] || 0
                    const locked = tierIsLocked(t) && qty === 0
                    const max = maxQtyFor(t)
                    return (
                      <div key={t.id} className={`tpb-tier${qty > 0 ? ' in-cart' : ''}${locked ? ' locked' : ''}`}>
                        <div>
                          <div className="tpb-tier-name">
                            {t.name}
                            {t.is_group && <span className="tpb-tier-badge">Table of {t.seats_per_unit}</span>}
                          </div>
                          {t.description && <div className="tpb-tier-desc">{t.description}</div>}
                          {remaining !== null && remaining <= 20 && (
                            <div className="tpb-tier-note">{remaining} {t.is_group ? 'table(s)' : ''} remaining</div>
                          )}
                        </div>
                        <div className="tpb-tier-right">
                          <span className="tpb-tier-price">{t.price === 0 ? 'Free' : `$${t.price.toFixed(2)}`}</span>
                          <div className="tpb-qty-ctrl">
                            <button className="tpb-qty-btn" onClick={() => setQty(t.id, qty - 1)} disabled={locked || qty <= 0}>−</button>
                            <span className="tpb-qty-num">{qty}</span>
                            <button className="tpb-qty-btn" onClick={() => setQty(t.id, qty + 1)} disabled={locked || qty >= max}>+</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {(cartHasPaidTier || cartHasFreeTier) && tiers.some((t) => tierIsLocked(t) && (cart[t.id] || 0) === 0) && (
                  <div className="tpb-lock-note">
                    Free and paid tickets can't be purchased together — checkout separately for the other.
                  </div>
                )}

                {orderIsPaid && cartEntries.length > 0 && (
                  <div className="tpb-summary">
                    {cartEntries.map((e) => (
                      <div className="tpb-summary-row" key={e.tier.id}>
                        <span className="tpb-summary-label">{e.qty} × {e.tier.name}{e.tier.is_group ? ' (table)' : ''}</span>
                        <span>{fmt(Math.round(e.tier.price * 100) * e.qty)}</span>
                      </div>
                    ))}
                    {addonSubtotalCents > 0 && (
                      <div className="tpb-summary-row">
                        <span className="tpb-summary-label">Add-ons</span>
                        <span>{fmt(addonSubtotalCents)}</span>
                      </div>
                    )}
                    <div className="tpb-summary-row">
                      <span className="tpb-summary-label">Service fee</span>
                      <span>{serviceFeeDisplay}</span>
                    </div>
                    <div className="tpb-summary-row tpb-summary-total">
                      <span>Total</span>
                      <span>{totalDisplay}</span>
                    </div>
                  </div>
                )}

                {/* Everything from here down — purchaser info, attendee/table
                    details, add-ons, confirm — sits in its own dark section so
                    it reads as visually distinct from tier browsing above. */}
                <div className="tpb-checkout-section">
                {isGuest && (
                  <div className="tpb-guest-form">
                    <div className="tpb-guest-row">
                      <label className="tpb-guest-label">Your Name (purchaser)</label>
                      <input type="text" className="tpb-guest-input" placeholder="First Last" value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="name" />
                    </div>
                    <div className="tpb-guest-row">
                      <label className="tpb-guest-label">Email</label>
                      <input type="email" className="tpb-guest-input" placeholder="you@example.com" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} autoComplete="email" />
                      <span className="tpb-guest-hint">Your order confirmation and all tickets will be sent to this email.</span>
                    </div>
                    <div className="tpb-guest-row">
                      <label className="tpb-guest-label">Phone {!orderIsPaid && '(optional)'}</label>
                      <input type="tel" className="tpb-guest-input" placeholder="(555) 123-4567" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} autoComplete="tel" />
                      <span className="tpb-guest-hint">US numbers — country code added automatically.</span>
                    </div>
                    <p className="tpb-guest-signin">
                      Have an account? <a href={`/login?return=/events/${eventSlug}`}>Sign in</a> to use saved details.
                    </p>
                  </div>
                )}

                {/* Individual-tier attendee cards */}
                {attendeeSlots.length > 0 && (
                  <div className="tpb-attendees">
                    <span className="tpb-attendees-title">{attendeeSlots.length > 1 ? 'Attendee Details' : 'Attendee'}</span>
                    {attendeeSlots.map((slot, i) => {
                      const questions = questionsForTier(slot.tierId)
                      const addons = addonsByTier[slot.tierId] || []
                      return (
                        <div key={slot.key} className="tpb-attendee-card">
                          {attendeeSlots.length > 1 && (
                            <div className="tpb-attendee-heading">Attendee {i + 1} <span>— {slot.tierName}</span></div>
                          )}
                          <div className="tpb-attendee-fields">
                            <div className="tpb-guest-row">
                              <label className="tpb-guest-label">Name</label>
                              <input type="text" className="tpb-guest-input" placeholder="First Last" maxLength={MAX_NAME_LEN}
                                value={attendeeNames[slot.key] || ''} onChange={(e) => setAttendeeName(slot.key, e.target.value)} />
                            </div>
                            <div className="tpb-guest-row">
                              <label className="tpb-guest-label">Email (optional)</label>
                              <input type="email" className="tpb-guest-input" placeholder="attendee@example.com"
                                value={attendeeEmails[slot.key] || ''} onChange={(e) => setAttendeeEmail(slot.key, e.target.value)} autoComplete="off" />
                              <span className="tpb-guest-hint">If this ticket isn't for you, add their email and we'll send them a copy directly.</span>
                            </div>

                            {questions.map((q) => (
                              <div key={q.id} className="tpb-guest-row">
                                <label className="tpb-guest-label">{q.label} {q.is_required ? '' : '(optional)'}</label>
                                {q.field_type === 'text' && (
                                  <input type="text" className="tpb-guest-input" placeholder={q.placeholder || ''} maxLength={MAX_ANSWER_LEN}
                                    value={attendeeAnswers[slot.key]?.[q.id] || ''} onChange={(e) => setAttendeeAnswer(slot.key, q.id, e.target.value)} />
                                )}
                                {q.field_type === 'select' && (
                                  <select className="tpb-guest-input" value={attendeeAnswers[slot.key]?.[q.id] || ''} onChange={(e) => setAttendeeAnswer(slot.key, q.id, e.target.value)}>
                                    <option value="">Select…</option>
                                    {(q.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                )}
                                {q.field_type === 'checkbox' && (
                                  <label className="tpb-checkbox-row">
                                    <input type="checkbox" checked={attendeeAnswers[slot.key]?.[q.id] === 'Yes'}
                                      onChange={(e) => setAttendeeAnswer(slot.key, q.id, e.target.checked ? 'Yes' : 'No')} />
                                    <span style={{ fontSize: '0.85rem', color: '#1a1814' }}>Yes</span>
                                  </label>
                                )}
                              </div>
                            ))}
                          </div>

                          {addons.length > 0 && (
                            <div className="tpb-addon-section">
                              <span className="tpb-addon-heading">AVAILABLE ADD-ONS</span>
                              {addons.map((addon) => {
                                const sel = attendeeAddons[slot.key]?.[addon.id]
                                return (
                                  <div key={addon.id} className={`tpb-addon-row${sel?.selected ? ' selected' : ''}`}>
                                    <label className="tpb-addon-label-row">
                                      <span className="tpb-checkbox-row">
                                        <input type="checkbox" checked={!!sel?.selected} onChange={(e) => setAttendeeAddonSelected(slot.key, addon.id, e.target.checked)} />
                                        <span className="tpb-addon-name">{addon.name}</span>
                                      </span>
                                      <span className="tpb-addon-price">+${addon.price.toFixed(2)}</span>
                                    </label>
                                    {sel?.selected && addon.has_choice && (
                                      <select
                                        className="tpb-guest-input"
                                        style={{ marginTop: '8px' }}
                                        value={sel.choice || ''}
                                        onChange={(e) => setAttendeeAddonChoice(slot.key, addon.id, e.target.value)}
                                      >
                                        <option value="">{addon.choice_label || 'Select…'}</option>
                                        {(addon.choice_options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                      </select>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Group/table tier cards */}
                {tableUnits.length > 0 && (
                  <div className="tpb-attendees">
                    <span className="tpb-attendees-title">{tableUnits.length > 1 ? 'Table Details' : 'Table'}</span>
                    {tableUnits.map((unit, i) => {
                      const questions = questionsForTier(unit.tierId)
                      const addons = addonsByTier[unit.tierId] || []
                      return (
                        <div key={unit.key} className="tpb-attendee-card">
                          {tableUnits.length > 1 && (
                            <div className="tpb-attendee-heading">Table {i + 1} <span>— {unit.tierName}</span></div>
                          )}
                          <div className="tpb-table-note">
                            Reserves {unit.seatsPerUnit} seats under {guestName || profileFullName || 'your'} name — no individual guest names needed.
                          </div>

                          {questions.length > 0 && (
                            <div className="tpb-attendee-fields">
                              {questions.map((q) => (
                                <div key={q.id} className="tpb-guest-row">
                                  <label className="tpb-guest-label">{q.label} {q.is_required ? '' : '(optional)'}</label>
                                  {q.field_type === 'text' && (
                                    <input type="text" className="tpb-guest-input" placeholder={q.placeholder || ''} maxLength={MAX_ANSWER_LEN}
                                      value={tableAnswers[unit.key]?.[q.id] || ''} onChange={(e) => setTableAnswer(unit.key, q.id, e.target.value)} />
                                  )}
                                  {q.field_type === 'select' && (
                                    <select className="tpb-guest-input" value={tableAnswers[unit.key]?.[q.id] || ''} onChange={(e) => setTableAnswer(unit.key, q.id, e.target.value)}>
                                      <option value="">Select…</option>
                                      {(q.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                  )}
                                  {q.field_type === 'checkbox' && (
                                    <label className="tpb-checkbox-row">
                                      <input type="checkbox" checked={tableAnswers[unit.key]?.[q.id] === 'Yes'}
                                        onChange={(e) => setTableAnswer(unit.key, q.id, e.target.checked ? 'Yes' : 'No')} />
                                      <span style={{ fontSize: '0.85rem', color: '#1a1814' }}>Yes</span>
                                    </label>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {addons.length > 0 && (
                            <div className="tpb-addon-section">
                              <span className="tpb-addon-heading">AVAILABLE ADD-ONS</span>
                              {addons.map((addon) => {
                                const total = tableAddonTotalQty(unit.key, addon.id)
                                return (
                                  <div key={addon.id} className={`tpb-addon-row${total > 0 ? ' selected' : ''}`}>
                                    <div className="tpb-addon-label-row">
                                      <span className="tpb-addon-name">{addon.name}</span>
                                      <span className="tpb-addon-price">+${addon.price.toFixed(2)} each</span>
                                    </div>

                                    {!addon.has_choice ? (
                                      <div className="tpb-table-addon-choice-row">
                                        <span className="tpb-table-addon-choice-label">How many?</span>
                                        <input
                                          type="number" min={0} max={unit.seatsPerUnit}
                                          className="tpb-table-addon-qty-input"
                                          value={tableAddonQty[unit.key]?.[addon.id]?.[NO_CHOICE_KEY] || 0}
                                          onChange={(e) => setTableAddonChoiceQty(unit.key, addon.id, NO_CHOICE_KEY, parseInt(e.target.value) || 0)}
                                        />
                                      </div>
                                    ) : (
                                      <>
                                        {(addon.choice_options || []).map((opt) => (
                                          <div key={opt} className="tpb-table-addon-choice-row">
                                            <span className="tpb-table-addon-choice-label">{opt}</span>
                                            <input
                                              type="number" min={0} max={unit.seatsPerUnit}
                                              className="tpb-table-addon-qty-input"
                                              value={tableAddonQty[unit.key]?.[addon.id]?.[opt] || 0}
                                              onChange={(e) => setTableAddonChoiceQty(unit.key, addon.id, opt, parseInt(e.target.value) || 0)}
                                            />
                                          </div>
                                        ))}
                                      </>
                                    )}
                                    <div className="tpb-table-addon-hint">{total} of {unit.seatsPerUnit} seats</div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {error && <div className="tpb-error">{error}</div>}

                <button
                  className={`tpb-confirm-btn ${totalQuantity === 0 ? 'neutral' : orderIsPaid ? 'paid' : 'free'}`}
                  onClick={handleAction}
                  disabled={purchasing || totalQuantity === 0}
                >
                  {confirmLabel}
                </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
