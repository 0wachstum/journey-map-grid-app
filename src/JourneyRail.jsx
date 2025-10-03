import React from 'react'

export default function JourneyRail({
  stages = [],
  selectedStages = [],
  onToggle = () => {},
  onSelectAll = () => {},
  onClear = () => {},
}) {
  return (
    <div className="journey-rail">
      <div className="jr-track" aria-hidden="true" />
      <div className="jr-steps" role="list">
        {stages.map((st) => {
          const active = selectedStages.includes(st)
          return (
            <button
              key={st}
              type="button"
              role="listitem"
              className={`jr-step ${active ? 'active' : ''}`}
              aria-pressed={active}
              title={st}
              onClick={() => onToggle(st)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onToggle(st)
                }
              }}
            >
              <span className="jr-dot" />
              <span className="jr-label">{st}</span>
            </button>
          )
        })}
      </div>
      <div className="jr-actions">
        <button className="btn ghost" type="button" onClick={onSelectAll}>All</button>
        <button className="btn ghost" type="button" onClick={onClear}>Clear</button>
      </div>
    </div>
  )
}
