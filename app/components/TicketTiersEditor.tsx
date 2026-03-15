'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

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

export default function TicketTiersEditor({ eventId, stripeAccountStatus }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: event }, { data: existingTiers }] = await Promise.all([
        supabase.from('events').select('ticketing_enabled').eq('id', eventId).single(),
        supabase.from('ticket_tiers').select('*').eq('event_id', eventId).order('sort_order'),
      ])
      setEnabled(event?.ticketing_enabled || false)
      setTiers(existingTiers?.map(t => ({
        ...t,
        price: String(t.price),
        quantity: t.quantity !== null ? String(t.quantity) : '',
        sale_starts_at: t.sale_starts_at ? t.sale_starts_at.slice(0, 16) : '',
        sale_ends_at: t.sale_ends_at ? t.sale_ends_at.slice(0, 16) : '',
        description: t.description || '',
      })) || [])
      setLoading(false)
    }
    load()
  }, [eventId])

  const addTier = () => {
    setTiers(prev => [...prev, { ...EMPTY_TIER(), sort_order: prev.length }])
  }

  const updateTier = (index: number, field: keyof Tier, value: any) => {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }

  const deleteTier = (index: number) => {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, _deleted: true } : t))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      // Toggle ticketing_enabled on event
      const { error: evErr } = await supabase
        .from('events')
        .update({ ticketing_enabled: enabled, ticket_platform: enabled ? '785tickets' : 'external' })
        .eq('id', eventId)
      if (evErr) throw evErr

      const activeTiers = tiers.filter(t => !t._deleted)
      const deletedTiers = tiers.filter(t => t._deleted && t.id)

      // Delete removed tiers
      for (const t of deletedTiers) {
        await supabase.from('ticket_tiers').delete().eq('id', t.id!)
      }

      // Upsert active tiers
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
          sale_starts_at: t.sale_starts_at || null,
          sale_ends_at: t.sale_ends_at || null,
        }

        if (t.id) {
          const { error } = await supabase.from('ticket_tiers').update(payload).eq('id', t.id)
          if (error) throw error
        } else {
          const { data, error } = await supabase.from('ticket_tiers').insert(payload).select('id').single()
          if (error) throw error
          // Store the new id
          setTiers(prev => prev.map((tier, idx) =>
            idx === tiers.indexOf(t) ? { ...tier, id: data.id, _new: false } : tier
          ))
        }
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const activeTiers = tiers.filter(t => !t._deleted)
  const isStripeReady = stripeAccountStatus === 'enabled'

  const S = `
    .tte-wrap { margin-top: 32px; }
    .tte-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .tte-title { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.25); }
    .tte-toggle { display: flex; align-items: center; gap: 10px; }
    .tte-toggle-label { font-size: 0.82rem; color: rgba(255,255,255,0.55); }
    .tte-switch { position: relative; width: 40px; height: 22px; }
    .tte-switch input { opacity: 0; width: 0; height: 0; }
    .tte-slider { position: absolute; inset: 0; background: rgba(255,255,255,0.1); border-radius: 22px; cursor: pointer; transition: background 0.2s; border: 1.5px solid rgba(255,255,255,0.12); }
    .tte-slider:before { content: ''; position: absolute; width: 16px; height: 16px; left: 2px; top: 1px; background: rgba(255,255,255,0.4); border-radius: 50%; transition: transform 0.2s; }
    input:checked + .tte-slider { background: rgba(200,6,80,0.3); border-color: rgba(200,6,80,0.5); }
    input:checked + .tte-slider:before { transform: translateX(18px); background: #C80650; }
    .tte-stripe-warn { padding: 12px 16px; background: rgba(255,206,3,0.06); border: 1px solid rgba(255,206,3,0.2); border-radius: 8px; font-size: 0.82rem; color: rgba(255,206,3,0.8); margin-bottom: 16px; line-height: 1.5; }
    .tte-stripe-warn a { color: #ffce03; font-weight: 600; }
    .tte-tier { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; margin-bottom: 10px; }
    .tte-tier-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .tte-tier-num { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.25); }
    .tte-sold { font-size: 0.72rem; color: rgba(255,255,255,0.35); }
    .tte-del-btn { background: none; border: none; color: rgba(200,6,80,0.4); cursor: pointer; font-size: 0.78rem; padding: 2px 6px; border-radius: 4px; transition: color 0.15s; }
    .tte-del-btn:hover { color: rgba(200,6,80,0.8); }
    .tte-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .tte-grid-3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; }
    .tte-field label { display: block; font-size: 0.6rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; }
    .tte-field input, .tte-field textarea { width: 100%; padding: 9px 11px; background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; color: #fff; outline: none; transition: border-color 0.15s; }
    .tte-field input::placeholder { color: rgba(255,255,255,0.2); }
    .tte-field input:focus { border-color: rgba(255,255,255,0.25); }
    .tte-field-hint { font-size: 0.68rem; color: rgba(255,255,255,0.2); margin-top: 3px; }
    .tte-active-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
    .tte-active-row label { font-size: 0.72rem; color: rgba(255,255,255,0.4); cursor: pointer; }
    .tte-add-btn { width: 100%; padding: 10px; background: rgba(255,255,255,0.04); border: 1.5px dashed rgba(255,255,255,0.1); border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; color: rgba(255,255,255,0.35); cursor: pointer; transition: all 0.15s; margin-top: 4px; }
    .tte-add-btn:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); }
    .tte-save-row { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
    .tte-save-btn { padding: 10px 24px; background: rgba(200,6,80,0.15); border: 1.5px solid rgba(200,6,80,0.4); border-radius: 8px; font-family: 'Oswald', sans-serif; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #C80650; cursor: pointer; transition: all 0.15s; }
    .tte-save-btn:hover { background: rgba(200,6,80,0.25); }
    .tte-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .tte-save-btn.saved { background: rgba(45,122,45,0.15); border-color: rgba(45,122,45,0.4); color: #7ecf7e; }
    .tte-error { font-size: 0.78rem; color: #ff9ab0; }
    .tte-empty { padding: 20px; text-align: center; font-size: 0.82rem; color: rgba(255,255,255,0.25); }
  `

  if (loading) return null

  return (
    <div className="tte-wrap">
      <style>{S}</style>

      <div className="tte-head">
        <span className="tte-title">785 Tickets</span>
        <div className="tte-toggle">
          <span className="tte-toggle-label">
            {enabled ? 'Ticketing on' : 'Ticketing off'}
          </span>
          <label className="tte-switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />
            <span className="tte-slider" />
          </label>
        </div>
      </div>

      {enabled && !isStripeReady && (
        <div className="tte-stripe-warn">
          ⚠ You need to <a href="/dashboard">connect Stripe</a> before you can sell tickets.
          Tiers saved here will go live once your account is connected.
        </div>
      )}

      {enabled && (
        <>
          {activeTiers.length === 0 && (
            <div className="tte-empty">No ticket tiers yet — add one below.</div>
          )}

          {activeTiers.map((tier, i) => (
            <div className="tte-tier" key={tier.id || i}>
              <div className="tte-tier-header">
                <span className="tte-tier-num">Tier {i + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {tier.quantity_sold !== undefined && tier.quantity_sold > 0 && (
                    <span className="tte-sold">{tier.quantity_sold} sold</span>
                  )}
                  <button
                    className="tte-del-btn"
                    onClick={() => deleteTier(tiers.indexOf(tier))}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="tte-grid-3" style={{ marginBottom: 10 }}>
                <div className="tte-field">
                  <label>Tier Name *</label>
                  <input
                    type="text"
                    placeholder="General Admission"
                    value={tier.name}
                    onChange={e => updateTier(tiers.indexOf(tier), 'name', e.target.value)}
                  />
                </div>
                <div className="tte-field">
                  <label>Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0 = Free"
                    value={tier.price}
                    onChange={e => updateTier(tiers.indexOf(tier), 'price', e.target.value)}
                  />
                </div>
                <div className="tte-field">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={tier.quantity}
                    onChange={e => updateTier(tiers.indexOf(tier), 'quantity', e.target.value)}
                  />
                  <div className="tte-field-hint">Leave blank for unlimited</div>
                </div>
              </div>

              <div className="tte-field" style={{ marginBottom: 10 }}>
                <label>Description (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Includes meet & greet"
                  value={tier.description}
                  onChange={e => updateTier(tiers.indexOf(tier), 'description', e.target.value)}
                />
              </div>

              <div className="tte-grid">
                <div className="tte-field">
                  <label>Sale Starts</label>
                  <input
                    type="datetime-local"
                    value={tier.sale_starts_at}
                    onChange={e => updateTier(tiers.indexOf(tier), 'sale_starts_at', e.target.value)}
                  />
                  <div className="tte-field-hint">Leave blank to sell immediately</div>
                </div>
                <div className="tte-field">
                  <label>Sale Ends</label>
                  <input
                    type="datetime-local"
                    value={tier.sale_ends_at}
                    onChange={e => updateTier(tiers.indexOf(tier), 'sale_ends_at', e.target.value)}
                  />
                  <div className="tte-field-hint">Leave blank to sell until event</div>
                </div>
              </div>

              <div className="tte-active-row">
                <input
                  type="checkbox"
                  id={`active-${i}`}
                  checked={tier.is_active}
                  onChange={e => updateTier(tiers.indexOf(tier), 'is_active', e.target.checked)}
                  style={{ accentColor: '#C80650', width: 14, height: 14 }}
                />
                <label htmlFor={`active-${i}`}>Active (visible for purchase)</label>
              </div>
            </div>
          ))}

          <button className="tte-add-btn" onClick={addTier} type="button">
            + Add Ticket Tier
          </button>
        </>
      )}

      <div className="tte-save-row">
        <button
          className={`tte-save-btn${saved ? ' saved' : ''}`}
          onClick={handleSave}
          disabled={saving}
          type="button"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : enabled ? 'Save Ticketing' : 'Save'}
        </button>
        {error && <span className="tte-error">{error}</span>}
      </div>
    </div>
  )
}
