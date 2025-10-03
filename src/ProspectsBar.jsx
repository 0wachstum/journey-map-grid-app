import React, { useMemo } from 'react'

export default function ProspectsBar({
  stages = [],
  counts = {},              // later: { [stage]: number }
  onBarClick = () => {},
}) {
  const data = useMemo(() => {
    if (stages.length === 0) return []
    const hasReal = Object.keys(counts || {}).some(k => Number.isFinite(counts[k]))
    if (hasReal) {
      return stages.map(st => ({ stage: st, value: Math.max(0, Number(counts[st] || 0)) }))
    }
    // Synthetic funnel (deterministic)
    const start = 120, decay = 0.62
    let v = start
    return stages.map((st, i) => {
      const jitter = 0.9 + (Math.sin(st.length * 31 + i * 17) + 1) * 0.05
      const value = Math.max(2, Math.round(v * jitter))
      v *= decay
      return { stage: st, value }
    })
  }, [stages, counts])

  const max = Math.max(10, ...data.map(d => d.value))
  // IMPORTANT: padding must match JourneyRail CSS padding
  const padL = 12, padR = 12
  const H = 120
  const padT = 10, padB = 20

  // Width is responsive; we use viewBox and %, so positions are proportional.
  // Centers are equally spaced from padL to (100%-padR).
  const W = Math.max(320, stages.length * 80)
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const slot = innerW / Math.max(1, data.length)
  const barW = slot * 0.65
  const gap = slot - barW

  return (
    <div className="prospects-bar" role="img" aria-label="Prospects per stage">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={padL} y1={H
