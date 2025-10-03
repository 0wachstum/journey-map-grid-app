import React, { useMemo } from 'react'

export default function ProspectsBar({
  stages = [],
  counts = {},              // later you can feed real numbers { [stage]: number }
  onBarClick = () => {},
}) {
  const data = useMemo(() => {
    if (stages.length === 0) return []
    const hasReal = Object.keys(counts || {}).some(k => Number.isFinite(counts[k]))
    if (hasReal) {
      return stages.map((st) => ({ stage: st, value: Math.max(0, Number(counts[st] || 0)) }))
    }
    // Synthetic funnel: high → low with mild jitter so it “looks real”
    const start = 120
    const decay = 0.62
    let v = start
    return stages.map((st, i) => {
      const jitter = 0.9 + (Math.sin(st.length * 31 + i * 17) + 1) * 0.05
      const value = Math.max(2, Math.round(v * jitter))
      v *= decay
      return { stage: st, value }
    })
  }, [stages, counts])

  const max = Math.max(10, ...data.map(d => d.value))
  const W = Math.max(320, stages.length * 80)
  const H = 120
  const pad = { l: 16, r: 16, t: 10, b: 20 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const slot = innerW / Math.max(1, data.length)
  const barW = slot * 0.65
  const gap = slot - barW

  return (
    <div className="prospects-bar" role="img" aria-label="Prospects per stage">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {/* baseline */}
        <line x1={pad.l} y1={H - pad.b + 0.5} x2={W - pad.r} y2={H - pad.b + 0.5} stroke="var(--border)" strokeWidth="1" />
        {data.map((d, i) => {
          const x = pad.l + i * (barW + gap) + gap / 2
          const h = Math.round((d.value / max) * innerH)
          const y = H - pad.b - h
          return (
            <g key={d.stage} onClick={() => onBarClick(d.stage)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width={barW} height={h} rx="4" fill="var(--accent)" opacity="0.9" />
              {/* value label only (no stage names) */}
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.value}</text>
              <title>{`${d.stage}: ${d.value} prospects`}</title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
