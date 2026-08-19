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
}

type QuestionField = {
  id: string
  field_type: 'text' | 'select' | 'checkbox'
  label: string
  placeholder: string | null
  options: string[] | null
  is_required: boolean
}

type AttendeeSlot = {
  key: string       // stable per (tierId, index) — used for state + React keys
  tierId: string
  tierName: string
  index: number      // 0-based position within this tier's quantity
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

export default function TicketPurchaseButton({ eventId, eventSlug }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([])
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

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUserId(user?.id ?? null)
      setSessionChecked(true)
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
        setProfileFullName(profile?.full_name || '')
      }
    })
    supabase
      .from('ticket_tiers')
      .select(
        'id, name, description, price, quantity, quantity_sold, sale_starts_at, sale_ends_at, is_active'
      )
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const now = new Date()
        const available = (data || []).filter((t) => {
          if (t.sale_starts_at && new Date(t.sale_starts_at) > now) return false
          if (t.sale_ends_at && new Date(t.sale_ends_at) < now) return false
          if (t.quantity !== null && t.quantity - t.quantity_sold <= 0) return false
          return true
        })
        setTiers(available)
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

  const totalQuantity = cartEntries.reduce((sum, e) => sum + e.qty, 0)
  const cartHasPaid = cartEntries.some((e) => e.tier.price > 0)
  const cartHasFree = cartEntries.some((e) => e.tier.price === 0)
  const isGuest = sessionChecked && !userId

  // One slot per ticket unit, in tier-list order — this exact order
  // is what gets sent to the server and must match how tickets get
  // minted (see checkout/rsvp routes).
  const attendeeSlots: AttendeeSlot[] = useMemo(() => {
    const slots: AttendeeSlot[] = []
    for (const e of cartEntries) {
      for (let i = 0; i < e.qty; i++) {
        slots.push({ key: `${e.tier.id}__${i}`, tierId: e.tier.id, tierName: e.tier.name, index: i })
      }
    }
    return slots
  }, [cartEntries])

  // Prefill the very first attendee's name from the purchaser's own
  // name, purely as a convenience for the common single-ticket case —
  // stops as soon as they've typed something themselves.
  useEffect(() => {
    const firstSlot = attendeeSlots[0]
    if (!firstSlot) return
    if (manuallyEditedNames.has(firstSlot.key)) return
    const source = isGuest ? guestName : profileFullName
    if (source) {
      setAttendeeNames((n) => ({ ...n, [firstSlot.key]: source }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendeeSlots[0]?.key, isGuest, guestName, profileFullName])

  function setQty(tierId: string, qty: number) {
    setCart((c) => ({ ...c, [tierId]: Math.max(0, qty) }))
    if (error) setError('')
  }

  function maxQtyFor(tier: Tier): number {
    const remaining = tier.quantity !== null ? tier.quantity - tier.quantity_sold : null
    return Math.min(remaining ?? 10, 10)
  }

  // Once a paid tier has qty > 0, free tiers are locked (and vice
  // versa) — free and paid can't be purchased in one transaction.
  function tierIsLocked(tier: Tier): boolean {
    if (tier.price > 0) return cartHasFree
    return cartHasPaid
  }

  function questionsForTier(tierId: string): QuestionField[] {
    return [...eventLevelFields, ...(tierFields[tierId] || [])]
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

  const validateGuest = (): string | null => {
    if (!guestName.trim()) return 'Your name is required.'
    if (!isEmailish(guestEmail)) return 'Please enter a valid email.'
    if (cartHasPaid) {
      const normalized = normalizePhone(guestPhone)
      if (!normalized) return 'Please enter a valid phone number.'
    }
    return null
  }

  const validateAttendees = (): string | null => {
    for (let i = 0; i < attendeeSlots.length; i++) {
      const slot = attendeeSlots[i]
      const name = (attendeeNames[slot.key] || '').trim()
      const label = attendeeSlots.length > 1 ? `Attendee ${i + 1}'s` : "Attendee's"
      if (!name) return `${label} name is required.`
      const email = (attendeeEmails[slot.key] || '').trim()
      if (email && !isEmailish(email)) {
        return `${attendeeSlots.length > 1 ? `Attendee ${i + 1}'s` : "Attendee's"} email doesn't look right.`
      }
      for (const q of questionsForTier(slot.tierId)) {
        const val = (attendeeAnswers[slot.key]?.[q.id] || '').trim()
        if (q.is_required && !val) {
          return `"${q.label}" is required for ${attendeeSlots.length > 1 ? `Attendee ${i + 1}` : 'this ticket'}.`
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
      if (v) {
        setError(v)
        return
      }
      guestPayload = {
        name: guestName.trim(),
        email: guestEmail.trim().toLowerCase(),
        phone: normalizePhone(guestPhone),
      }
    }

    const aErr = validateAttendees()
    if (aErr) {
      setError(aErr)
      return
    }

    const items = cartEntries.map((e) => ({ tierId: e.tier.id, quantity: e.qty }))
    const attendees = attendeeSlots.map((slot) => ({
      tierId: slot.tierId,
      name: (attendeeNames[slot.key] || '').trim(),
      email: (attendeeEmails[slot.key] || '').trim() || null,
      responses: questionsForTier(slot.tierId)
        .map((q) => ({ field_id: q.id, value: (attendeeAnswers[slot.key]?.[q.id] || '').trim() }))
        .filter((r) => r.value.length > 0),
    }))

    setPurchasing(true)

    try {
      if (cartHasFree) {
        const res = await fetch('/api/tickets/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, items, guest: guestPayload, attendees }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error || 'Something went wrong. Please try again.')
          setPurchasing(false)
          return
        }
        setRsvpDone(true)
        setExpanded(false)
        setPurchasing(false)
      } else {
        const res = await fetch('/api/tickets/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, items, guest: guestPayload, attendees }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error || 'Something went wrong. Please try again.')
          setPurchasing(false)
          return
        }
        window.location.href = json.url
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setPurchasing(false)
    }
  }

  if (loading || tiers.length === 0) return null

  // Pricing breakdown (all in cents for precision)
  const subtotalCents = cartEntries.reduce((sum, e) => sum + Math.round(e.tier.price * 100) * e.qty, 0)
  const serviceFeeTotalCents = cartEntries.reduce(
    (sum, e) => sum + serviceFeeCentsForPreview(Math.round(e.tier.price * 100)) * e.qty,
    0
  )
  const totalCents = subtotalCents + serviceFeeTotalCents

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`
  const serviceFeeDisplay = fmt(serviceFeeTotalCents)
  const totalDisplay = fmt(totalCents)

  const lowestPrice = Math.min(...tiers.map((t) => t.price))
  const headerLabel = isFreeEvent ? 'Free Event' : 'Tickets'
  const headerPrice = isFreeEvent ? 'Free' : `From $${lowestPrice.toFixed(2)}`
  const ctaLabel = isFreeEvent ? 'RSVP' : 'Get Tickets'

  const confirmLabel = purchasing
    ? cartHasPaid
      ? 'Redirecting to checkout…'
      : 'Saving your RSVP…'
    : totalQuantity === 0
      ? 'Select tickets above'
      : cartHasPaid
        ? `Buy ${totalQuantity > 1 ? `${totalQuantity} Tickets` : 'Ticket'} · ${totalDisplay}`
        : `RSVP — ${totalQuantity} Guest${totalQuantity > 1 ? 's' : ''}`

  return (
    <div style={{ margin: '24px 0' }}>
      <style>{`
        .tpb-wrap { border: 1.5px solid #ece8e2; border-radius: 12px; overflow: hidden; background: #f7f6f4; }
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
        .tpb-error { margin-top: 12px; padding: 10px 14px; background: rgba(200,6,80,0.08); border: 1px solid rgba(200,6,80,0.2); border-radius: 8px; font-size: 0.82rem; color: #C80650; }
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
                {isGuest
                  ? 'Confirmation has been recorded. Check your email for details.'
                  : 'Check your dashboard to view your RSVP.'}
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
                <button
                  className={`tpb-action-btn ${isFreeEvent ? 'free' : 'paid'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(true)
                  }}
                >
                  {ctaLabel}
                </button>
              )}
              {expanded && (
                <span style={{ fontSize: '0.75rem', color: '#6b6560', cursor: 'pointer' }}>
                  ✕ Close
                </span>
              )}
            </div>

            {expanded && (
              <div className="tpb-expand">
                <div className="tpb-tiers">
                  {tiers.map((t) => {
                    const remaining = t.quantity !== null ? t.quantity - t.quantity_sold : null
                    const qty = cart[t.id] || 0
                    const locked = tierIsLocked(t) && qty === 0
                    const max = maxQtyFor(t)
                    return (
                      <div
                        key={t.id}
                        className={`tpb-tier${qty > 0 ? ' in-cart' : ''}${locked ? ' locked' : ''}`}
                      >
                        <div>
                          <div className="tpb-tier-name">{t.name}</div>
                          {t.description && <div className="tpb-tier-desc">{t.description}</div>}
                          {remaining !== null && remaining <= 20 && (
                            <div className="tpb-tier-note">{remaining} remaining</div>
                          )}
                        </div>
                        <div className="tpb-tier-right">
                          <span className="tpb-tier-price">
                            {t.price === 0 ? 'Free' : `$${t.price.toFixed(2)}`}
                          </span>
                          <div className="tpb-qty-ctrl">
                            <button
                              className="tpb-qty-btn"
                              onClick={() => setQty(t.id, qty - 1)}
                              disabled={locked || qty <= 0}
                            >
                              −
                            </button>
                            <span className="tpb-qty-num">{qty}</span>
                            <button
                              className="tpb-qty-btn"
                              onClick={() => setQty(t.id, qty + 1)}
                              disabled={locked || qty >= max}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {(cartHasPaid || cartHasFree) && tiers.some((t) => tierIsLocked(t) && (cart[t.id] || 0) === 0) && (
                  <div className="tpb-lock-note">
                    Free and paid tickets can't be purchased together — checkout separately for the other.
                  </div>
                )}

                {/* Pricing summary (paid carts only) */}
                {cartHasPaid && cartEntries.length > 0 && (
                  <div className="tpb-summary">
                    {cartEntries.map((e) => (
                      <div className="tpb-summary-row" key={e.tier.id}>
                        <span className="tpb-summary-label">
                          {e.qty} × {e.tier.name}
                        </span>
                        <span>{fmt(Math.round(e.tier.price * 100) * e.qty)}</span>
                      </div>
                    ))}
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

                {/* Purchaser info — only when not logged in. This is the
                    billing/contact identity, separate from attendees. */}
                {isGuest && (
                  <div className="tpb-guest-form">
                    <div className="tpb-guest-row">
                      <label className="tpb-guest-label">Your Name (purchaser)</label>
                      <input
                        type="text"
                        className="tpb-guest-input"
                        placeholder="First Last"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>
                    <div className="tpb-guest-row">
                      <label className="tpb-guest-label">Email</label>
                      <input
                        type="email"
                        className="tpb-guest-input"
                        placeholder="you@example.com"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        autoComplete="email"
                      />
                      <span className="tpb-guest-hint">
                        Your order confirmation and all tickets will be sent to this email.
                      </span>
                    </div>
                    <div className="tpb-guest-row">
                      <label className="tpb-guest-label">
                        Phone {!cartHasPaid && '(optional)'}
                      </label>
                      <input
                        type="tel"
                        className="tpb-guest-input"
                        placeholder="(555) 123-4567"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        autoComplete="tel"
                      />
                      <span className="tpb-guest-hint">
                        US numbers — country code added automatically.
                      </span>
                    </div>
                    <p className="tpb-guest-signin">
                      Have an account?{' '}
                      <a href={`/login?return=/events/${eventSlug}`}>Sign in</a> to use saved
                      details.
                    </p>
                  </div>
                )}

                {/* One block per ticket — its own name, its own answers */}
                {attendeeSlots.length > 0 && (
                  <div className="tpb-attendees">
                    <span className="tpb-attendees-title">
                      {attendeeSlots.length > 1 ? 'Attendee Details' : 'Attendee'}
                    </span>
                    {attendeeSlots.map((slot, i) => {
                      const questions = questionsForTier(slot.tierId)
                      return (
                        <div key={slot.key} className="tpb-attendee-card">
                          {attendeeSlots.length > 1 && (
                            <div className="tpb-attendee-heading">
                              Attendee {i + 1} <span>— {slot.tierName}</span>
                            </div>
                          )}
                          <div className="tpb-attendee-fields">
                            <div className="tpb-guest-row">
                              <label className="tpb-guest-label">Name</label>
                              <input
                                type="text"
                                className="tpb-guest-input"
                                placeholder="First Last"
                                maxLength={MAX_NAME_LEN}
                                value={attendeeNames[slot.key] || ''}
                                onChange={(e) => setAttendeeName(slot.key, e.target.value)}
                              />
                            </div>

                            <div className="tpb-guest-row">
                              <label className="tpb-guest-label">Email (optional)</label>
                              <input
                                type="email"
                                className="tpb-guest-input"
                                placeholder="attendee@example.com"
                                value={attendeeEmails[slot.key] || ''}
                                onChange={(e) => setAttendeeEmail(slot.key, e.target.value)}
                                autoComplete="off"
                              />
                              <span className="tpb-guest-hint">
                                If this ticket isn't for you, add their email and we'll send them
                                a copy directly.
                              </span>
                            </div>

                            {questions.map((q) => (
                              <div key={q.id} className="tpb-guest-row">
                                <label className="tpb-guest-label">
                                  {q.label} {q.is_required ? '' : '(optional)'}
                                </label>

                                {q.field_type === 'text' && (
                                  <input
                                    type="text"
                                    className="tpb-guest-input"
                                    placeholder={q.placeholder || ''}
                                    maxLength={MAX_ANSWER_LEN}
                                    value={attendeeAnswers[slot.key]?.[q.id] || ''}
                                    onChange={(e) => setAttendeeAnswer(slot.key, q.id, e.target.value)}
                                  />
                                )}

                                {q.field_type === 'select' && (
                                  <select
                                    className="tpb-guest-input"
                                    value={attendeeAnswers[slot.key]?.[q.id] || ''}
                                    onChange={(e) => setAttendeeAnswer(slot.key, q.id, e.target.value)}
                                  >
                                    <option value="">Select…</option>
                                    {(q.options || []).map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                {q.field_type === 'checkbox' && (
                                  <label className="tpb-checkbox-row">
                                    <input
                                      type="checkbox"
                                      checked={attendeeAnswers[slot.key]?.[q.id] === 'Yes'}
                                      onChange={(e) =>
                                        setAttendeeAnswer(slot.key, q.id, e.target.checked ? 'Yes' : 'No')
                                      }
                                    />
                                    <span style={{ fontSize: '0.85rem', color: '#1a1814' }}>Yes</span>
                                  </label>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {error && <div className="tpb-error">{error}</div>}

                <button
                  className={`tpb-confirm-btn ${totalQuantity === 0 ? 'neutral' : cartHasPaid ? 'paid' : 'free'}`}
                  onClick={handleAction}
                  disabled={purchasing || totalQuantity === 0}
                >
                  {confirmLabel}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
