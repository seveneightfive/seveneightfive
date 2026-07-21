'use client'

import { useState, useEffect } from 'react'

type FiltersPanelProps = {
  open: boolean
  onClose: () => void
  search: string
  onSearchChange: (v: string) => void
  categories: string[]                 // all available category names (no 'All')
  selectedCategories: string[]
  onToggleCategory: (cat: string) => void
  quickDate: string | null             // 'today' | 'tomorrow' | 'weekend' | 'month' | null
  onQuickDate: (key: string | null) => void
  startDate: string | null
  endDate: string | null
  onStartDate: (v: string | null) => void
  onEndDate: (v: string | null) => void
  sortBy: 'featured' | 'date'
  onSortBy: (v: 'featured' | 'date') => void
  resultCount: number
  onClearAll: () => void
}

export default function FiltersPanel({
  open,
  onClose,
  search,
  onSearchChange,
  categories,
  selectedCategories,
  onToggleCategory,
  quickDate,
  onQuickDate,
  startDate,
  endDate,
  onStartDate,
  onEndDate,
  sortBy,
  onSortBy,
  resultCount,
  onClearAll,
}: FiltersPanelProps) {
  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <style>{`
        .fp-overlay {
          position: fixed;
          inset: 0;
          z-index: 400;
          background: var(--white);
          display: flex;
          flex-direction: column;
        }
        .fp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 20px 16px;
          border-bottom: 1px solid var(--border);
        }
        .fp-title {
          font-family: var(--serif);
          font-size: 1.5rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.01em;
          color: var(--ink);
        }
        .fp-close {
          background: none;
          border: none;
          font-size: 1.3rem;
          color: var(--ink);
          cursor: pointer;
          line-height: 1;
          padding: 6px;
        }
        .fp-body { flex: 1; overflow-y: auto; padding: 20px; padding-bottom: 100px; }

        .fp-search-wrap { position: relative; margin-bottom: 28px; }
        .fp-search-input {
          width: 100%;
          padding: 12px 44px 12px 16px;
          background: var(--off);
          border: 1px solid var(--border);
          border-radius: 100px;
          font-family: var(--sans);
          font-size: 0.9rem;
          color: var(--ink);
          outline: none;
        }
        .fp-search-input:focus { border-color: var(--ink); background: var(--white); }
        .fp-search-icon {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--ink-faint);
        }

        .fp-section { margin-bottom: 28px; }
        .fp-section-label {
          font-family: var(--serif);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink);
          margin-bottom: 14px;
        }

        .fp-date-row { display: flex; gap: 12px; margin-bottom: 14px; }
        .fp-date-field { flex: 1; }
        .fp-date-field-label { font-size: 0.78rem; color: var(--ink-soft); margin-bottom: 6px; display: block; }
        .fp-date-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-family: var(--sans);
          font-size: 0.85rem;
          color: var(--ink);
          outline: none;
        }
        .fp-date-input:focus { border-color: var(--ink); }

        .fp-radio-group { display: flex; flex-direction: column; gap: 4px; }
        .fp-radio-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 4px;
          cursor: pointer;
        }
        .fp-radio-circle {
          width: 18px; height: 18px;
          border-radius: 50%;
          border: 1.5px solid var(--border);
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .fp-radio-circle.checked { border-color: var(--accent); }
        .fp-radio-circle.checked::after {
          content: '';
          width: 10px; height: 10px;
          border-radius: 50%;
          background: var(--accent);
        }
        .fp-radio-label { font-size: 0.9rem; color: var(--ink); }

        .fp-check-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 4px;
          cursor: pointer;
        }
        .fp-check-box {
          width: 18px; height: 18px;
          border-radius: 4px;
          border: 1.5px solid var(--border);
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .fp-check-box.checked { background: var(--ink); border-color: var(--ink); }
        .fp-check-box.checked::after { content: '✓'; color: white; font-size: 0.7rem; line-height: 1; }
        .fp-check-label { font-size: 0.9rem; color: var(--ink); }

        .fp-footer {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: var(--white);
          border-top: 1px solid var(--border);
          padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));
          display: flex;
          gap: 12px;
        }
        .fp-clear-btn {
          padding: 12px 18px;
          background: none;
          border: 1.5px solid var(--border);
          border-radius: 100px;
          font-family: var(--sans);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--ink-soft);
          cursor: pointer;
          white-space: nowrap;
        }
        .fp-clear-btn:hover { border-color: var(--ink); color: var(--ink); }
        .fp-apply-btn {
          flex: 1;
          padding: 12px 18px;
          background: var(--ink);
          border: none;
          border-radius: 100px;
          font-family: var(--sans);
          font-size: 0.9rem;
          font-weight: 700;
          color: white;
          cursor: pointer;
        }
      `}</style>

      <div className="fp-overlay">
        <div className="fp-header">
          <span className="fp-title">Filters</span>
          <button className="fp-close" onClick={onClose} aria-label="Close filters">✕</button>
        </div>

        <div className="fp-body">
          <div className="fp-search-wrap">
            <input
              className="fp-search-input"
              type="text"
              placeholder="Search by event, artist, or venue"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
            />
            <svg className="fp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>

          <div className="fp-section">
            <div className="fp-section-label">Date</div>
            <div className="fp-date-row">
              <div className="fp-date-field">
                <label className="fp-date-field-label">Start Date</label>
                <input
                  type="date"
                  className="fp-date-input"
                  value={startDate || ''}
                  onChange={e => onStartDate(e.target.value || null)}
                />
              </div>
              <div className="fp-date-field">
                <label className="fp-date-field-label">End Date</label>
                <input
                  type="date"
                  className="fp-date-input"
                  value={endDate || ''}
                  onChange={e => onEndDate(e.target.value || null)}
                />
              </div>
            </div>

            <div className="fp-radio-group">
              {[
                { key: 'today', label: 'Today' },
                { key: 'tomorrow', label: 'Tomorrow' },
                { key: 'weekend', label: 'This Weekend' },
                { key: 'month', label: 'This Month' },
              ].map(opt => (
                <div key={opt.key} className="fp-radio-row" onClick={() => onQuickDate(quickDate === opt.key ? null : opt.key)}>
                  <span className={`fp-radio-circle ${quickDate === opt.key ? 'checked' : ''}`} />
                  <span className="fp-radio-label">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="fp-section">
            <div className="fp-section-label">Sort By</div>
            <div className="fp-radio-group">
              {[
                { key: 'featured' as const, label: 'Featured' },
                { key: 'date' as const, label: 'Date (Upcoming)' },
              ].map(opt => (
                <div key={opt.key} className="fp-radio-row" onClick={() => onSortBy(opt.key)}>
                  <span className={`fp-radio-circle ${sortBy === opt.key ? 'checked' : ''}`} />
                  <span className="fp-radio-label">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="fp-section">
            <div className="fp-section-label">Category</div>
            <div>
              {categories.map(cat => (
                <div key={cat} className="fp-check-row" onClick={() => onToggleCategory(cat)}>
                  <span className={`fp-check-box ${selectedCategories.includes(cat) ? 'checked' : ''}`} />
                  <span className="fp-check-label">{cat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fp-footer">
          <button className="fp-clear-btn" onClick={onClearAll}>Clear</button>
          <button className="fp-apply-btn" onClick={onClose}>
            View {resultCount} Event{resultCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </>
  )
}
