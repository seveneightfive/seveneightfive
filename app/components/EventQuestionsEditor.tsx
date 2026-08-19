'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'

type FieldType = 'text' | 'select' | 'checkbox'

type Question = {
  field_type: FieldType
  label: string
  placeholder?: string | null
  options?: string[] | null
  is_required: boolean
}

type Tier = { id: string; name: string }

type Props = {
  eventId: string
  tiers: Tier[]
}

const MAX_PER_TIER = 3

function emptyQuestion(): Question {
  return { field_type: 'text', label: '', placeholder: '', options: [], is_required: false }
}

export default function EventQuestionsEditor({ eventId, tiers }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [eventLevel, setEventLevel] = useState<Question[]>([])
  const [byTier, setByTier] = useState<Record<string, Question[]>>({})
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    fetch(`/api/events/${eventId}/form-fields`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        setEventLevel(
          (json.eventLevel || []).map((f: any) => ({
            field_type: f.field_type,
            label: f.label,
            placeholder: f.placeholder,
            options: f.options,
            is_required: !!f.is_required,
          }))
        )
        const nextByTier: Record<string, Question[]> = {}
        for (const [tierId, fields] of Object.entries(json.byTier || {})) {
          nextByTier[tierId] = (fields as any[]).map((f) => ({
            field_type: f.field_type,
            label: f.label,
            placeholder: f.placeholder,
            options: f.options,
            is_required: !!f.is_required,
          }))
        }
        setByTier(nextByTier)
        setExpandedTiers(
          Object.fromEntries(Object.keys(nextByTier).map((tid) => [tid, true]))
        )
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => { cancelled = true }
  }, [eventId])

  function updateEventQuestion(index: number, patch: Partial<Question>) {
    setEventLevel((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)))
    setSaved(false)
  }
  function addEventQuestion() {
    if (eventLevel.length >= MAX_PER_TIER) return
    setEventLevel((qs) => [...qs, emptyQuestion()])
    setSaved(false)
  }
  function removeEventQuestion(index: number) {
    setEventLevel((qs) => qs.filter((_, i) => i !== index))
    setSaved(false)
  }

  function updateTierQuestion(tierId: string, index: number, patch: Partial<Question>) {
    setByTier((bt) => ({
      ...bt,
      [tierId]: (bt[tierId] || []).map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }))
    setSaved(false)
  }
  function addTierQuestion(tierId: string) {
    const used = eventLevel.length + (byTier[tierId]?.length || 0)
    if (used >= MAX_PER_TIER) return
    setByTier((bt) => ({ ...bt, [tierId]: [...(bt[tierId] || []), emptyQuestion()] }))
    setSaved(false)
  }
  function removeTierQuestion(tierId: string, index: number) {
    setByTier((bt) => ({ ...bt, [tierId]: (bt[tierId] || []).filter((_, i) => i !== index) }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/events/${eventId}/form-fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventLevel, byTier }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to save questions')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err?.message || 'Failed to save questions')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading questions…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
        <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Ask buyers up to {MAX_PER_TIER} questions at checkout — dietary restrictions, t-shirt
          size, a waiver, anything you need. Questions here apply to every tier. You can also add
          extra questions for one specific tier below, as long as the total for that tier stays
          at {MAX_PER_TIER} or fewer.
        </span>
      </div>

      {/* Event-level questions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Questions for all buyers
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {eventLevel.length}/{MAX_PER_TIER}
          </span>
        </div>

        {eventLevel.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">No questions yet.</p>
        )}

        {eventLevel.map((q, i) => (
          <QuestionRow
            key={i}
            question={q}
            onChange={(patch) => updateEventQuestion(i, patch)}
            onRemove={() => removeEventQuestion(i)}
          />
        ))}

        {eventLevel.length < MAX_PER_TIER && (
          <button
            onClick={addEventQuestion}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Add question
          </button>
        )}
      </div>

      {/* Per-tier extra questions */}
      {tiers.length > 0 && (
        <div className="space-y-3 border-t border-gray-100 pt-5 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Extra questions for a specific tier
          </h3>
          <div className="space-y-2">
            {tiers.map((tier) => {
              const tierQuestions = byTier[tier.id] || []
              const used = eventLevel.length + tierQuestions.length
              const expanded = !!expandedTiers[tier.id]
              return (
                <div
                  key={tier.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <button
                    onClick={() =>
                      setExpandedTiers((e) => ({ ...e, [tier.id]: !e[tier.id] }))
                    }
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
                  >
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {tier.name}
                      {tierQuestions.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                          {tierQuestions.length} extra question{tierQuestions.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">{used}/{MAX_PER_TIER} total</span>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </span>
                  </button>

                  {expanded && (
                    <div className="space-y-3 border-t border-gray-100 px-3.5 py-3 dark:border-gray-800">
                      {tierQuestions.map((q, i) => (
                        <QuestionRow
                          key={i}
                          question={q}
                          onChange={(patch) => updateTierQuestion(tier.id, i, patch)}
                          onRemove={() => removeTierQuestion(tier.id, i)}
                        />
                      ))}
                      {used < MAX_PER_TIER ? (
                        <button
                          onClick={() => addTierQuestion(tier.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add question for this tier
                        </button>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          This tier is at the {MAX_PER_TIER}-question limit.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm font-medium text-brand-600 dark:text-brand-400">{error}</p>
      )}

      <div className="flex items-center gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : ''}
          {saving ? 'Saving…' : 'Save questions'}
        </button>
        {saved && (
          <span className="text-sm font-semibold text-success-600 dark:text-success-400">✓ Saved</span>
        )}
      </div>
    </div>
  )
}

function QuestionRow({
  question,
  onChange,
  onRemove,
}: {
  question: Question
  onChange: (patch: Partial<Question>) => void
  onRemove: () => void
}) {
  const optionsText = (question.options || []).join(', ')

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-start gap-2">
        <input
          type="text"
          value={question.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. T-shirt size, Dietary restrictions"
          maxLength={120}
          className="min-w-[180px] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
        />
        <select
          value={question.field_type}
          onChange={(e) => onChange({ field_type: e.target.value as FieldType })}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-700 outline-none dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300"
        >
          <option value="text">Text field</option>
          <option value="select">Select (choose one)</option>
          <option value="checkbox">Checkbox (yes/no)</option>
        </select>
        <button
          onClick={onRemove}
          className="rounded-lg p-2 text-gray-400 transition hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
          title="Remove question"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {question.field_type === 'select' && (
        <input
          type="text"
          value={optionsText}
          onChange={(e) =>
            onChange({ options: e.target.value.split(',').map((s) => s.trim()) })
          }
          placeholder="Options, comma separated — e.g. Small, Medium, Large"
          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
        />
      )}

      <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        <input
          type="checkbox"
          checked={question.is_required}
          onChange={(e) => onChange({ is_required: e.target.checked })}
          className="rounded border-gray-300"
        />
        Required
      </label>
    </div>
  )
}
