'use client'

import { useState, useEffect, useRef } from 'react'

type DateFilterProps = {
  selectedDate: string | null        // YYYY-MM-DD or null = all
  onSelect: (date: string | null) => void
}

function getDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD in local time
}

function getNext14Days(): Date[] {
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

function getWeekend(): { start: string; end: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = today.getDay() // 0=Sun, 6=Sat
  const daysToFri = day <= 5 ? 5 - day : 6
  const fri = new Date(today)
  fri.setDate(today.getDate() + daysToFri)
  const sun = new Date(fri)
  sun.setDate(fri.getDate() + 2)
  return { start: getDateKey(fri), end: getDateKey(sun) }
}

export default function DateFilter({ selectedDate, onSelect }: DateFilterProps) {
  const [open, setOpen] = useState(false)
  const [weekendRange, setWeekendRange] = useState<{ start: string; end: string } | null>(null)
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null })
  const sheetRef = useRef<HTMLDivElement>(null)
  const days = getNext14Days()
  const todayKey = getDateKey(new Date())
  const tomorrowKey = getDateKey(new Date(Date.now() + 86400000))

  useEffect(() => {
    setWeekendRange(getWeekend())
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleDayPick = (key: string) => {
    setDateRange({ start: null, end: null })
    onSelect(selectedDate === key ? null : key)
    setOpen(false)
  }

  const handleQuick = (key: string | null) => {
    setDateRange({ start: null, end: null })
    onSelect(key)
    setOpen(false)
  }

  // Format selected date for button label
  const buttonLabel = () => {
    if (!selectedDate) return 'Date'
    if (selectedDate === todayKey) return 'Today'
    if (selectedDate === tomorrowKey) return 'Tomorrow'
    const d = new Date(selectedDate + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const isActive = !!selectedDate

  return (
    <>
      <style>{`
        .date-filter-wrap { position: relative; flex-shrink: 0; }

        .date-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 100px;
          border: 1.5px solid var(--border);
          background: transparent;
          font-family: var(--sans);
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--ink-soft);
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .date-btn:hover { border-color: var(--ink); color: var(--ink); }
        .date-btn.active { background: var(--accent); border-color: var(--accent); color: white; }
        .date-btn-icon { font-size: 0.85rem; }
        .date-btn-clear {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          font-size: 0.6rem;
          line-height: 1;
          margin-left: 2px;
        }

        /* SHEET */
        .date-sheet-backdrop {
          position: fixed;
          inset: 0;
          z-index: 300;
          background: rgba(0,0,0,0.4);
          animation: bdFadeIn 0.2s ease;
        }
        @keyframes bdFadeIn { from { opacity:0 } to { opacity:1 } }

        .date-sheet {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 301;
          background: var(--white);
          border-radius: 20px 20px 0 0;
          padding: 0 0 env(safe-area-inset-bottom, 16px);
          animation: sheetUp 0.28s cubic-bezier(0.22,1,0.36,1);
          max-height: 80vh;
          overflow-y: auto;
        }
        @keyframes sheetUp { from { transform: translateY(100%) } to { transform: translateY(0) } }

        /* Desktop: dropdown instead */
        @media (min-width: 641px) {
          .date-sheet-backdrop { background: transparent; }
          .date-sheet {
            position: absolute;
            bottom: auto;
            top: calc(100% + 8px);
            left: auto;
            right: 0;
            width: 340px;
            border-radius: 12px;
            border: 1.5px solid var(--border);
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
            animation: dropIn 0.18s cubic-bezier(0.22,1,0.36,1);
            max-height: 420px;
          }
          @keyframes dropIn { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
        }

        .sheet-handle {
          width: 36px; height: 4px;
          background: var(--border);
          border-radius: 2px;
          margin: 12px auto 0;
        }
        @media (min-width: 641px) { .sheet-handle { display: none; } }

        .sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 8px;
        }
        .sheet-title {
          font-family: var(--serif);
          font-size: 0.9rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink);
        }
        .sheet-close {
          background: none;
          border: none;
          color: var(--ink-faint);
          font-size: 1rem;
          cursor: pointer;
          padding: 4px;
          line-height: 1;
        }
        .sheet-close:hover { color: var(--ink); }

        /* QUICK PICKS */
        .quick-section { padding: 4px 20px 12px; }
        .quick-label {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--ink-faint);
          margin-bottom: 8px;
        }
        .quick-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .quick-btn {
          padding: 12px 14px;
          background: var(--off);
          border: 1.5px solid transparent;
          border-radius: 10px;
          font-family: var(--sans);
          font-size: 0.82rem;
          font-weight: 500;
          color: var(--ink);
          cursor: pointer;
          text-align: left;
          transition: all 0.15s;
          line-height: 1.3;
        }
        .quick-btn:hover { background: var(--warm); border-color: var(--border); }
        .quick-btn.selected { background: var(--accent-light); border-color: var(--accent); color: var(--accent); }
        .quick-btn-sub {
          display: block;
          font-size: 0.7rem;
          color: var(--ink-faint);
          margin-top: 2px;
          font-weight: 400;
        }
        .quick-btn.selected .quick-btn-sub { color: var(--accent); opacity: 0.7; }

        /* DIVIDER */
        .sheet-divider {
          height: 1px;
          background: var(--border);
          margin: 4px 20px 12px;
        }

        /* WEEK STRIP */
        .week-section { padding: 0 20px 20px; }
        .week-strip {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 4px;
        }
        .week-strip::-webkit-scrollbar { display: none; }
        .week-day {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1.5px solid var(--border);
          background: transparent;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
          min-width: 52px;
          font-family: var(--sans);
        }
        .week-day:hover { background: var(--off); border-color: var(--ink-faint); }
        .week-day.selected { background: var(--ink); border-color: var(--ink); }
        .week-day.today { border-color: var(--accent); }
        .week-day.today .week-day-num { color: var(--accent); }
        .week-day.selected .week-day-name,
        .week-day.selected .week-day-num { color: white; }
        .week-day.today.selected { background: var(--accent); border-color: var(--accent); }
        .week-day.today.selected .week-day-num { color: white; }
        .week-day-name {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-faint);
          line-height: 1;
        }
        .week-day-num {
          font-size: 1rem;
          font-weight: 600;
          color: var(--ink);
          line-height: 1;
        }
        .week-day-month {
          font-size: 0.58rem;
          color: var(--ink-faint);
          line-height: 1;
        }

        /* CLEAR ROW */
        .sheet-clear {
          padding: 8px 20px 16px;
          border-top: 1px solid var(--border);
        }
        .clear-btn {
          width: 100%;
          padding: 10px;
          background: none;
          border: 1.5px solid var(--border);
          border-radius: 8px;
          font-family: var(--sans);
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--ink-faint);
          cursor: pointer;
          transition: all 0.15s;
        }
        .clear-btn:hover { border-color: var(--ink); color: var(--ink); }
      `}</style>

      <div className="date-filter-wrap" ref={sheetRef}>
        {/* TRIGGER BUTTON */}
        <button
          className={`date-btn ${isActive ? 'active' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          <span className="date-btn-icon">📅</span>
          {buttonLabel()}
          {isActive && (
            <span
              className="date-btn-clear"
              onClick={e => { e.stopPropagation(); onSelect(null); setOpen(false) }}
            >✕</span>
          )}
        </button>

        {/* BACKDROP + SHEET */}
        {open && (
          <>
            <div className="date-sheet-backdrop" onClick={() => setOpen(false)} />
            <div className="date-sheet">
              <div className="sheet-handle" />
              <div className="sheet-header">
                <span className="sheet-title">Browse by Date</span>
                <button className="sheet-close" onClick={() => setOpen(false)}>✕</button>
              </div>

              {/* QUICK PICKS */}
              <div className="quick-section">
                <div className="quick-label">Quick picks</div>
                <div className="quick-grid">
                  <button
                    className={`quick-btn ${selectedDate === todayKey ? 'selected' : ''}`}
                    onClick={() => handleQuick(selectedDate === todayKey ? null : todayKey)}
                  >
                    Today
                    <span className="quick-btn-sub">
                      {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </button>
                  <button
                    className={`quick-btn ${selectedDate === tomorrowKey ? 'selected' : ''}`}
                    onClick={() => handleQuick(selectedDate === tomorrowKey ? null : tomorrowKey)}
                  >
                    Tomorrow
                    <span className="quick-btn-sub">
                      {new Date(Date.now() + 86400000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </button>
                  {weekendRange && (
                    <button
                      className={`quick-btn ${selectedDate === weekendRange.start ? 'selected' : ''}`}
                      onClick={() => handleQuick(selectedDate === weekendRange.start ? null : weekendRange.start)}
                    >
                      This Weekend
                      <span className="quick-btn-sub">Fri – Sun</span>
                    </button>
                  )}
                  <button
                    className={`quick-btn ${!selectedDate ? 'selected' : ''}`}
                    onClick={() => handleQuick(null)}
                  >
                    All Upcoming
                    <span className="quick-btn-sub">Show everything</span>
                  </button>
                </div>
              </div>

              <div className="sheet-divider" />

              {/* WEEK STRIP */}
              <div className="week-section">
                <div className="quick-label" style={{ marginBottom: 10 }}>Pick a day</div>
                <div className="week-strip">
                  {days.map(d => {
                    const key = getDateKey(d)
                    const isToday = key === todayKey
                    const isSelected = selectedDate === key
                    return (
                      <button
                        key={key}
                        className={`week-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleDayPick(key)}
                      >
                        <span className="week-day-name">
                          {isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <span className="week-day-num">{d.getDate()}</span>
                        <span className="week-day-month">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedDate && (
                <div className="sheet-clear">
                  <button className="clear-btn" onClick={() => handleQuick(null)}>
                    Clear date filter
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
