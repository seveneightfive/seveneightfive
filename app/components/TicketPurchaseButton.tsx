'use client'

import { useState, useEffect } from 'react'
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

type Props = {
  eventId: string
  eventSlug: string
}

export default function TicketPurchaseButton({ eventId, eventSlug }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('ticket_tiers')
      .select('id, name, description, price, quantity, quantity_sold, sale_starts_at, sale_ends_at, is_active')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const now = new Date()
        const available = (data || []).filter(t => {
          if (t.sale_starts_at && new Date(t.sale_starts_at) > now) return false
          if (t.sale_ends_at && new Date(t.sale_ends_at) < now) return false
          if (t.quantity !== null && t.quantity - t.quantity_sold <= 0) return false
          return true
        })
        setTiers(available)
        if (available.length === 1) setSelectedTier(available[0].id)
        setLoading(false)
      })
  }, [eventId])

  const handlePurchase = async () => {
    if (!selectedTier) return
    setPurchasing(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = `/login?return=/events/${eventSlug}`
        return
      }

      const res = await fetch('/api/tickets/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId: selectedTier, eventId, quantity }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Something went wrong. Please try again.')
        setPurchasing(false)
        return
      }

      // Redirect to Stripe Checkout
      window.location.href = json.url

    } catch {
      setError('Something went wrong. Please try again.')
      setPurchasing(false)
    }
  }

  if (loading || tiers.length === 0) return null

  const tier = tiers.find(t => t.id === selectedTier) || tiers[0]
  const remaining = tier.quantity !== null ? tier.quantity - tier.quantity_sold : null
  const maxQty = Math.min(remaining ?? 10, 10)
  const totalPrice = (tier.price * quantity).toFixed(2)

  return (
    <div style={{ margin: '24px 0' }}>
      <style>{`
        .tpb-wrap { border: 1.5px solid #ece8e2; border-radius: 12px; overflow: hidden; background: #f7f6f4; }
        .tpb-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; cursor: pointer; user-select: none; }
        .tpb-header-left { display: flex; flex-direction: column; gap: 3px; }
        .tpb-eyebrow { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #b8b3ad; }
        .tpb-price { font-family: 'Oswald', sans-serif; font-size: 1.3rem; font-weight: 600; color: #1a1814; }
        .tpb-price-free { color: #2d7a2d; }
        .tpb-buy-btn {
          padding: 11px 22px; background: #C80650; border: none; border-radius: 8px;
          font-family: 'Oswald', sans-serif; font-size: 0.85rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase; color: #fff;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .tpb-buy-btn:hover { background: #a8041f; }
        .tpb-buy-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .tpb-expand { padding: 0 20px 20px; border-top: 1px solid #ece8e2; }
        .tpb-tiers { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .tpb-tier {
          padding: 12px 14px; border-radius: 8px; border: 1.5px solid #ece8e2;
          background: #fff; cursor: pointer; transition: all 0.15s;
          display: flex; align-items: center; justify-content: space-between;
        }
        .tpb-tier.selected { border-color: #C80650; background: rgba(200,6,80,0.04); }
        .tpb-tier-name { font-weight: 500; font-size: 0.9rem; color: #1a1814; }
        .tpb-tier-desc { font-size: 0.78rem; color: #6b6560; margin-top: 2px; }
        .tpb-tier-price { font-family: 'Oswald', sans-serif; font-size: 1rem; font-weight: 600; color: #1a1814; flex-shrink: 0; margin-left: 12px; }
        .tpb-tier-sold-out { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #b8b3ad; }
        .tpb-qty-row { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
        .tpb-qty-label { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6560; }
        .tpb-qty-ctrl { display: flex; align-items: center; gap: 0; border: 1.5px solid #ece8e2; border-radius: 8px; overflow: hidden; }
        .tpb-qty-btn { width: 36px; height: 36px; border: none; background: #fff; font-size: 1.1rem; cursor: pointer; color: #1a1814; transition: background 0.1s; }
        .tpb-qty-btn:hover { background: #f0ede8; }
        .tpb-qty-btn:disabled { color: #b8b3ad; cursor: not-allowed; }
        .tpb-qty-num { width: 36px; text-align: center; font-weight: 600; font-size: 0.95rem; background: #fff; border-left: 1.5px solid #ece8e2; border-right: 1.5px solid #ece8e2; height: 36px; display: flex; align-items: center; justify-content: center; }
        .tpb-total { margin-left: auto; font-family: 'Oswald', sans-serif; font-size: 1rem; font-weight: 600; color: #1a1814; }
        .tpb-remaining { font-size: 0.72rem; color: #a85a30; font-weight: 500; margin-top: 8px; }
        .tpb-error { margin-top: 12px; padding: 10px 14px; background: rgba(200,6,80,0.08); border: 1px solid rgba(200,6,80,0.2); border-radius: 8px; font-size: 0.82rem; color: #C80650; }
        .tpb-confirm-btn {
          margin-top: 16px; width: 100%; padding: 14px;
          background: #C80650; border: none; border-radius: 8px;
          font-family: 'Oswald', sans-serif; font-size: 0.9rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase; color: #fff;
          cursor: pointer; transition: all 0.15s;
        }
        .tpb-confirm-btn:hover { background: #a8041f; }
        .tpb-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="tpb-wrap">
        {/* Collapsed header — quick buy */}
        <div className="tpb-header" onClick={() => setExpanded(e => !e)}>
          <div className="tpb-header-left">
            <span className="tpb-eyebrow">🎟 785 Tickets</span>
            <span className={`tpb-price ${tier.price === 0 ? 'tpb-price-free' : ''}`}>
              {tier.price === 0 ? 'Free' : `$${tier.price.toFixed(2)}`}
              {tiers.length > 1 && <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#6b6560', marginLeft: 6 }}>+ more tiers</span>}
            </span>
          </div>
          {!expanded && (
            <button
              className="tpb-buy-btn"
              onClick={e => { e.stopPropagation(); setExpanded(true) }}
            >
              Get Tickets
            </button>
          )}
          {expanded && (
            <span style={{ fontSize: '0.75rem', color: '#6b6560', cursor: 'pointer' }}>✕ Close</span>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="tpb-expand">
            {/* Tier selection (only show if multiple tiers) */}
            {tiers.length > 1 && (
              <div className="tpb-tiers">
                {tiers.map(t => {
                  const rem = t.quantity !== null ? t.quantity - t.quantity_sold : null
                  const soldOut = rem !== null && rem <= 0
                  return (
                    <div
                      key={t.id}
                      className={`tpb-tier${selectedTier === t.id ? ' selected' : ''}${soldOut ? ' disabled' : ''}`}
                      onClick={() => !soldOut && setSelectedTier(t.id)}
                      style={soldOut ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    >
                      <div>
                        <div className="tpb-tier-name">{t.name}</div>
                        {t.description && <div className="tpb-tier-desc">{t.description}</div>}
                        {soldOut && <div className="tpb-tier-sold-out">Sold Out</div>}
                        {!soldOut && rem !== null && rem <= 10 && (
                          <div style={{ fontSize: '0.72rem', color: '#a85a30', marginTop: 2 }}>
                            Only {rem} left
                          </div>
                        )}
                      </div>
                      <span className="tpb-tier-price">
                        {t.price === 0 ? 'Free' : `$${t.price.toFixed(2)}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quantity selector */}
            <div className="tpb-qty-row">
              <span className="tpb-qty-label">Qty</span>
              <div className="tpb-qty-ctrl">
                <button
                  className="tpb-qty-btn"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >−</button>
                <span className="tpb-qty-num">{quantity}</span>
                <button
                  className="tpb-qty-btn"
                  onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                >+</button>
              </div>
              {remaining !== null && remaining <= 20 && (
                <span className="tpb-remaining">{remaining} remaining</span>
              )}
              {quantity > 1 && (
                <span className="tpb-total">Total: ${totalPrice}</span>
              )}
            </div>

            {error && <div className="tpb-error">{error}</div>}

            <button
              className="tpb-confirm-btn"
              onClick={handlePurchase}
              disabled={purchasing || !selectedTier}
            >
              {purchasing
                ? 'Redirecting to checkout…'
                : tier.price === 0
                  ? 'Reserve Free Ticket'
                  : `Buy ${quantity > 1 ? `${quantity} Tickets` : 'Ticket'} · $${totalPrice}`
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
