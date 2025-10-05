import React, { useMemo } from 'react'

export default function StageDeck({
  stages = [],
  selectedStages = [],
  counts = {},              // optional: real numbers per stage later
  onToggle = () => {},
}) {
  const data = useMemo(() => {
    if (!stages || stages.length === 0) return []
    const hasReal = Object.keys(counts || {}).some(k => Number.isFinite(counts[k]))
    if (hasReal) {
      return stages.map(st => ({ stage: st, value: Math.max(0, Number(counts[st] || 0)) }))
    }
    const start = 120, decay = 0.62
    let v = start
    return stages.map((st, i) => {
      const jitter = 0.9 + (Math.sin(st.length * 31 + i * 17) + 1) * 0.05
      const value = Math.max(2, Math.round(v * jitter))
      v *= decay
      return { stage: st, value }
    })
  }, [stages, counts])

  const maxVal = Math.max(10, ...data.map(d => d.value))

  return (
    <div className="stage-deck">
      <div
        className="sd-grid"
        style={{ gridTemplateColumns: `repeat(${stages.length || 1}, 1fr)` }}
      >
        {/* Row 1: Bars */}
        {data.map((d, idx) => {
          const hPct = maxVal > 0 ? (d.value / maxVal) * 100 : 0
          return (
            <div
              key={`bar-${d.stage}`}
              className="sd-bar"
              title={`${d.stage}: ${d.value} prospects`}
              style={{
                gridColumn: idx + 1,
                gridRow: 1,
                height: `${Math.max(4, Math.round(hPct))}%`,
              }}
              onClick={() => onToggle(d.stage)}
              role="button"
              aria-label={`${d.stage}: ${d.value} prospects`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(d.stage) }
              }}
            />
          )
        })}

        {/* Track */}
        <div className="sd-track" style={{ gridColumn: `1 / -1`, gridRow: 2 }} />

        {/* Row 2: Steps */}
        {stages.map((st, idx) => {
          const active = selectedStages.includes(st)
          return (
            <button
              key={`step-${st}`}
              type="button"
              className={`sd-step ${active ? 'active' : ''}`}
              style={{ gridColumn: idx + 1, gridRow: 2 }}
              aria-pressed={active}
              title={st}
              onClick={() => onToggle(st)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(st) }
              }}
            >
              <span className="sd-dot" />
              <span className="sd-label">{st}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
