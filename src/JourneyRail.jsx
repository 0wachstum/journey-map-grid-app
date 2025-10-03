
// src/JourneyRail.jsx
import React from 'react'

export default function JourneyRail({
  stages = [],
  selectedStages = [],
  counts = {},
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
          const count = counts[st] ?? 0
          return (
            <button
              key={st}
              type="button"
              role="listitem"
              className={\`jr-step \${active ? 'active' : ''}\`}
              aria-pressed={active}
              title={\`\${st} • \${count} card\${count === 1 ? '' : 's'}\`}
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
              <span className="jr-count">{count}</span>
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
