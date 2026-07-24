'use client'

import { useEffect } from 'react'

type QuickDateOption = { key: string; label: string }

type SearchFilterSheetProps = {
  open: boolean
  onClose: () => void
  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  categories: string[]
  selectedCategories: string[]
  onToggleCategory: (cat: string) => void
  quickDate: string | null
  onQuickDate: (key: string | null) => void
  startDate: string | null
  endDate: string | null
  onStartDate: (v: string | null) => void
  onEndDate: (v: string | null) => void
  // Pick-a-specific-day strip (ported from the old DateFilter.tsx week strip) —
  // distinct from quickDate/start/end above: this jumps to one exact calendar day.
  selectedDate?: string | null
  onSelectDate?: (date: string | null) => void
  resultCount: number
  resultLabel?: string
  onClearAll: () => void
  quickDateOptions?: QuickDateOption[]
}

function getDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

function getNext31Days(): Date[] {
  const days: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 31; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push(d)
  }
  return days
}

const DEFAULT_QUICK_DATE_OPTIONS: QuickDateOption[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This Weekend' },
  { key: 'month', label: 'This Month' },
]

export default function SearchFilterSheet({
  open,
  onClose,
  search,
  onSearchChange,
  searchPlaceholder = 'Search events, artists, venues...',
  categories,
  selectedCategories,
  onToggleCategory,
  quickDate,
  onQuickDate,
  startDate,
  endDate,
  onStartDate,
  onEndDate,
  selectedDate = null,
  onSelectDate,
  resultCount,
  resultLabel = 'Events',
  onClearAll,
  quickDateOptions = DEFAULT_QUICK_DATE_OPTIONS,
}: SearchFilterSheetProps) {
  const days = getNext31Days()
  const todayKey = getDateKey(new Date())

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  if (!open) return null

  const activeFilterCount =
    selectedCategories.length + (quickDate ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0)

  return (
    <>
      <style>{`
        .sfs-overlay {
          position: fixed; inset: 0; z-index: 400;
          background: #ffffff;
          display: flex; flex-direction: column;
        }
        .sfs-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px 14px;
          border-bottom: 2px solid #0A0A0A;
        }
        .sfs-title {
          font-family: 'Oswald', sans-serif; font-size: 1.3rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.02em; color: #0A0A0A;
        }
        .sfs-close {
          background: none; border: none; font-size: 1.3rem; color: #0A0A0A;
          cursor: pointer; line-height: 1; padding: 6px;
        }
        .sfs-body { flex: 1; overflow-y: auto; padding: 20px; padding-bottom: 110px; }

        .sfs-search-wrap { position: relative; margin-bottom: 26px; }
        .sfs-search-input {
          width: 100%; padding: 12px 44px 12px 16px;
          background: #f7f6f4; border: 1px solid #ece8e2; border-radius: 100px;
          font-family: 'DM Sans', system-ui, sans-serif; font-size: 0.9rem; color: #1a1814; outline: none;
        }
        .sfs-search-input:focus { border-color: #0A0A0A; background: #ffffff; }
        .sfs-search-icon {
          position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #b8b3ad;
        }

        .sfs-section { margin-bottom: 26px; }
        .sfs-section-label {
          font-family: 'Oswald', sans-serif; font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: #0A0A0A; margin-bottom: 12px;
        }

        .sfs-pill-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .sfs-pill {
          padding: 8px 14px; border-radius: 100px; border: 1.5px solid #ece8e2;
          background: transparent; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.82rem; font-weight: 500; color: #6b6560; cursor: pointer; white-space: nowrap;
        }
        .sfs-pill.checked { background: #0A0A0A; border-color: #0A0A0A; color: #ffffff; }
        .sfs-pill:hover:not(.checked) { border-color: #0A0A0A; color: #0A0A0A; }

        .sfs-date-row { display: flex; gap: 12px; margin-top: 12px; }
        .sfs-date-field { flex: 1; }
        .sfs-date-field-label { font-size: 0.78rem; color: #6b6560; margin-bottom: 6px; display: block; }
        .sfs-date-input {
          width: 100%; padding: 10px 12px; border: 1px solid #ece8e2; border-radius: 8px;
          font-family: 'DM Sans', system-ui, sans-serif; font-size: 0.85rem; color: #1a1814; outline: none;
        }
        .sfs-date-input:focus { border-color: #0A0A0A; }

        .sfs-day-strip {
          display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px;
        }
        .sfs-day-strip::-webkit-scrollbar { display: none; }
        .sfs-day {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 10px 12px; border-radius: 10px; border: 1.5px solid #ece8e2;
          background: transparent; cursor: pointer; flex-shrink: 0; min-width: 52px;
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .sfs-day:hover { background: #f7f6f4; border-color: #b8b3ad; }
        .sfs-day.today { border-color: #C80650; }
        .sfs-day.today .sfs-day-num { color: #C80650; }
        .sfs-day.selected { background: #0A0A0A; border-color: #0A0A0A; }
        .sfs-day.selected .sfs-day-name,
        .sfs-day.selected .sfs-day-num { color: #ffffff; }
        .sfs-day.today.selected { background: #C80650; border-color: #C80650; }
        .sfs-day.today.selected .sfs-day-num { color: #ffffff; }
        .sfs-day-name { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #b8b3ad; line-height: 1; }
        .sfs-day-num { font-size: 1rem; font-weight: 600; color: #1a1814; line-height: 1; }
        .sfs-day-month { font-size: 0.58rem; color: #b8b3ad; line-height: 1; }

        .sfs-footer {
          position: fixed; bottom: 0; left: 0; right: 0; background: #ffffff;
          border-top: 1px solid #ece8e2; padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));
          display: flex; gap: 12px;
        }
        .sfs-clear-btn {
          padding: 12px 18px; background: none; border: 1.5px solid #ece8e2; border-radius: 100px;
          font-family: 'DM Sans', system-ui, sans-serif; font-size: 0.85rem; font-weight: 600;
          color: #6b6560; cursor: pointer; white-space: nowrap;
        }
        .sfs-clear-btn:hover { border-color: #0A0A0A; color: #0A0A0A; }
        .sfs-apply-btn {
          flex: 1; padding: 12px 18px; background: #0A0A0A; border: none; border-radius: 100px;
          font-family: 'Oswald', sans-serif; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.03em;
          text-transform: uppercase; color: #ffffff; cursor: pointer;
        }
      `}</style>

      <div className="sfs-overlay" role="dialog" aria-modal="true" aria-label="Search and filter">
        <div className="sfs-header">
          <span className="sfs-title">Search &amp; Filter</span>
          <button className="sfs-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="sfs-body">
          <div className="sfs-search-wrap">
            <input
              className="sfs-search-input"
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => onSearchChange(e.target.value)}
            />
            <svg className="sfs-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>

          <div className="sfs-section">
            <div className="sfs-section-label">When</div>
            <div className="sfs-pill-row">
              {quickDateOptions.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  className={`sfs-pill ${quickDate === opt.key ? 'checked' : ''}`}
                  onClick={() => onQuickDate(quickDate === opt.key ? null : opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="sfs-date-row">
              <div className="sfs-date-field">
                <label className="sfs-date-field-label" htmlFor="sfs-start-date">Start date</label>
                <input
                  id="sfs-start-date"
                  type="date"
                  className="sfs-date-input"
                  value={startDate || ''}
                  onChange={e => onStartDate(e.target.value || null)}
                />
              </div>
              <div className="sfs-date-field">
                <label className="sfs-date-field-label" htmlFor="sfs-end-date">End date</label>
                <input
                  id="sfs-end-date"
                  type="date"
                  className="sfs-date-input"
                  value={endDate || ''}
                  onChange={e => onEndDate(e.target.value || null)}
                />
              </div>
            </div>
          </div>

          {onSelectDate && (
            <div className="sfs-section">
              <div className="sfs-section-label">Pick a day</div>
              <div className="sfs-day-strip">
                {days.map(d => {
                  const key = getDateKey(d)
                  const isToday = key === todayKey
                  const isSelected = selectedDate === key
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`sfs-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelectDate(selectedDate === key ? null : key)}
                    >
                      <span className="sfs-day-name">{isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      <span className="sfs-day-num">{d.getDate()}</span>
                      <span className="sfs-day-month">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="sfs-section">
            <div className="sfs-section-label">Category</div>
            <div className="sfs-pill-row">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`sfs-pill ${selectedCategories.includes(cat) ? 'checked' : ''}`}
                  onClick={() => onToggleCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="sfs-footer">
          <button className="sfs-clear-btn" onClick={onClearAll}>Clear</button>
          <button className="sfs-apply-btn" onClick={onClose}>
            Show {resultCount} {resultLabel}
          </button>
        </div>
      </div>
    </>
  )
}

export function getActiveFilterCount({
  selectedCategories,
  quickDate,
  startDate,
  endDate,
  selectedDate,
}: {
  selectedCategories: string[]
  quickDate: string | null
  startDate: string | null
  endDate: string | null
  selectedDate?: string | null
}) {
  return (
    selectedCategories.length +
    (quickDate ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (selectedDate ? 1 : 0)
  )
}
