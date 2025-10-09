import { useEffect, useMemo, useState } from 'react'

// --- Build marker (optional; helps verify deploys) ---
const BUILD_TAG = 'APP-2025-10-09T17:25';

// ===== CONFIG =====
// Google Sheets “Publish to web” CSV (leave CSV_GID empty unless you target a specific tab)
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2z8bKJ-yhJgr1yIWUdv4F1XQTntwc64mzz1eabNdApenFaBBmoBK9vpU_QarygI4lJan-pzK3XrE0/pub?output=csv'
const CSV_GID = ''

// View logic
// Highlights: (KPI removed), per your last change
const HIGHLIGHT_FIELDS = ['motivation','emotions','barriers','opportunities','quotes']
// Full: KPI appears AFTER Opportunities; includes Touchpoints; Evidence omitted
const FULL_FIELDS = ['motivation','goal','support','touchpoints','emotions','barriers','opportunities','kpi','quotes','signals','satisfactionScore']

// ===== CSV parsing =====
function stripBOM(text) {
  return text && text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}
function parseCSVRaw(text) {
  const rows = []; let row = []; let cell = ''; let i = 0; let inQuotes = false
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1]
        if (next === '"') { cell += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      cell += ch; i++; continue
    } else {
      if (ch === '"') { inQuotes = true; i++; continue }
      if (ch === ',') { row.push(cell); cell = ''; i++; continue }
      if (ch === '\r') { const n = text[i+1]; row.push(cell); cell=''; rows.push(row); row=[]; i += (n === '\n') ? 2 : 1; continue }
      if (ch === '\n') { row.push(cell); cell=''; rows.push(row); row=[]; i++; continue }
      cell += ch; i++
    }
  }
  row.push(cell); rows.push(row); return rows
}
function parseCSV(text) {
  const matrix = parseCSVRaw(text).filter(r => r.length && !(r.length === 1 && r[0] === ''))
  if (!matrix.length) return []
  const headers = matrix[0].map(h => (h ?? '').trim())
  const lc = headers.map(h => h.toLowerCase())
  const idx = (name) => lc.indexOf(String(name).toLowerCase())
  const get = (cells, name) => { const i = idx(name); return i >= 0 ? (cells[i] ?? '') : '' }
  const semi = (v) => (v ? String(v).split(';').map(s => s.trim()).filter(Boolean) : [])

  return matrix.slice(1).map(cells => {
    if (cells.length < headers.length) cells = cells.concat(Array(headers.length - cells.length).fill(''))
    return {
      stage:       get(cells,'Stage').trim(),
      stakeholder: get(cells,'Stakeholder').trim(),

      motivation:  get(cells,'Motivation').trim(),
      goal:        get(cells,'Goal').trim(),
      support:     get(cells,'Support').trim(),

      barriers:      semi(get(cells,'Barriers')),
      opportunities: semi(get(cells,'Opportunities')),
      signals:       semi(get(cells,'Signals')),      // renders as “Survey Input”
      touchpoints:   semi(get(cells,'Touchpoints')),

      kpi:           semi(get(cells,'KPI')),          // chips (single/multiple)
      emotions:      semi(get(cells,'Emotions')),
      quotes:        semi(get(cells,'Quotes')),

      // Evidence intentionally ignored (not rendered)
      satisfactionScore: (get(cells,'SatisfactionScore') || '').trim(),

      // Optional ordering hints (ignored if absent)
      stageOrder:       Number(get(cells,'StageOrder') || Number.POSITIVE_INFINITY),
      stakeholderOrder: Number(get(cells,'StakeholderOrder') || Number.POSITIVE_INFINITY),
    }
  })
}

// ===== Render helpers =====
const Section = ({ label, children }) => (<div className="meta"><strong>{label}:</strong>{children}</div>)
const Chips = ({ items }) => (<div className="chips" style={{ marginTop: 6 }}>{items.map((t,i)=>(<span key={i} className="chip">{t}</span>))}</div>)
const List  = ({ items, quote }) => (<ul className="list">{items.map((v,i)=>(<li key={i}>{quote ? <>&ldquo;{v}&rdquo;</> : v}</li>))}</ul>)

function renderField(key, row) {
  switch (key) {
    case 'motivation':
      return row.motivation ? <p className="meta break"><strong>Motivation:</strong> {row.motivation}</p> : null
    case 'goal':
      return row.goal ? <p className="meta break"><strong>Goal:</strong> {row.goal}</p> : null
    case 'support':
      return row.support ? <p className="meta break"><strong>Support:</strong> {row.support}</p> : null

    case 'touchpoints':
      return row.touchpoints?.length ? <Section label="Touchpoints"><Chips items={row.touchpoints} /></Section> : null

    case 'kpi':
      return row.kpi?.length ? <Section label="KPI"><Chips items={row.kpi} /></Section> : null

    case 'emotions':
      return row.emotions?.length ? <Section label="Emotions"><Chips items={row.emotions} /></Section> : null

    case 'barriers':
      return row.barriers?.length ? <Section label="Barriers"><List items={row.barriers} /></Section> : null
    case 'opportunities':
      return row.opportunities?.length ? <Section label="Opportunities"><List items={row.opportunities} /></Section> : null
    case 'quotes':
      return row.quotes?.length ? <Section label="Quotes"><List items={row.quotes} quote /></Section> : null

    case 'signals': {
      const items = row.signals || []
      if (!items.length) return null
      return <p className="meta"><strong>Survey Input:</strong> {items.join(', ')}</p>
    }

    case 'satisfactionScore': {
      const v = row.satisfactionScore
      if (!v) return null
      const num = Number(v)
      const looks05 = Number.isFinite(num) && num >= 0 && num <= 5
      return <div className="kpi">Satisfaction: {looks05 ? `${num} / 5` : v}</div>
    }

    default: return null
  }
}

// ===== Inline header widgets (no external files) =====
function SmallBarChart({ stages, counts, selectedStages, onToggle }) {
  const H = 48
  const max = Math.max(1, ...stages.map(s => counts[s] ?? 0))
  const W = Math.max(1, stages.length) * 28 // 20 bar + 8 gap per stage
  return (
    <div style={{ padding:'6px 8px' }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block' }}>
        {stages.map((s, i) => {
          const val = counts[s] ?? 0
          const h = Math.max(2, Math.round((val / max) * (H - 6)))
          const x = i * 28
          const y = H - h
          const active = selectedStages.includes(s)
          return (
            <g key={s} onClick={() => onToggle(s)} style={{ cursor:'pointer' }}>
              <rect x={x} y={y} width={20} height={h}
                    fill={active ? 'var(--accent)' : 'var(--border)'} />
              <title>{`${s}: ${val}`}</title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
function StageRail({ stages, selectedStages, onToggle }) {
  return (
    <div className="rail">
      {stages.map(s => (
        <button
          key={s}
          className={`btn ${selectedStages.includes(s) ? 'active' : ''}`}
          aria-pressed={selectedStages.includes(s)}
          onClick={() => onToggle(s)}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

// ===== Main App =====
export default function App() {
  const [viewMode, setViewMode] = useState('highlights') // 'highlights' | 'full'
  const [data, setData] = useState([])
  const [error, setError] = useState('')
  const [selectedStages, setSelectedStages] = useState([])
  const [selectedStakeholders, setSelectedStakeholders] = useState([])

  useEffect(() => {
    console.log('Loaded build:', BUILD_TAG)
    ;(async () => {
      try {
        const base = CSV_URL
        const gidPart = CSV_GID ? `${base.includes('?') ? '&' : '?'}single=true&gid=${CSV_GID}` : ''
        const bust = `${(base.includes('?') || gidPart) ? '&' : '?'}t=${Date.now()}`
        const url = `${base}${gidPart}${bust}`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        let txt = await res.text()
        txt = stripBOM(txt)
        const rows = parseCSV(txt)
        if (!rows.length) throw new Error('No rows parsed')
        setData(rows)
        setSelectedStages([...new Set(rows.map(r => r.stage))])
        setSelectedStakeholders([...new Set(rows.map(r => r.stakeholder))])
      } catch (e) { setError(e.message || String(e)) }
    })()
  }, [])

  // Stage/Stakeholder lists (respect optional ordering hints)
  const allStages = useMemo(() => {
    const seen = new Set(); const rows = [...data]
    rows.sort((a,b)=> (a.stageOrder - b.stageOrder) || 0)
    const list = []
    for (const r of rows) { if (!r.stage) continue; if (!seen.has(r.stage)) { seen.add(r.stage); list.push(r.stage) } }
    return list
  }, [data])
  const allStakeholders = useMemo(() => {
    const seen = new Set(); const rows = [...data]
    rows.sort((a,b)=> (a.stakeholderOrder - b.stakeholderOrder) || 0)
    const list = []
    for (const r of rows) { if (!r.stakeholder) continue; if (!seen.has(r.stakeholder)) { seen.add(r.stakeholder); list.push(r.stakeholder) } }
    return list
  }, [data])

  // Visible rows under current filters
  const visible = useMemo(() => {
    return data.filter(d => selectedStages.includes(d.stage) && selectedStakeholders.includes(d.stakeholder))
  }, [data, selectedStages, selectedStakeholders])

  // Prune empty rows/columns (always)
  const activeStages = useMemo(() => selectedStages.filter(st => visible.some(d => d.stage === st)), [visible, selectedStages])
  const activeStakeholders = useMemo(() => selectedStakeholders.filter(sh => visible.some(d => d.stakeholder === sh)), [visible, selectedStakeholders])

  const effectiveStages = activeStages
  const effectiveStakeholders = activeStakeholders

  // stage → stakeholder → row
  const byStage = useMemo(() => {
    const m = new Map()
    for (const st of effectiveStages) m.set(st, {})
    for (const row of visible) {
      if (!effectiveStages.includes(row.stage)) continue
      if (!effectiveStakeholders.includes(row.stakeholder)) continue
      if (!m.has(row.stage)) m.set(row.stage, {})
      m.get(row.stage)[row.stakeholder] = row
    }
    return m
  }, [visible, effectiveStages, effectiveStakeholders])

  const gridStyle = { gridTemplateColumns: effectiveStakeholders.map(() => 'minmax(300px, 1fr)').join(' ') }
  const toggle = (setArr) => (val) => setArr(curr => curr.includes(val) ? curr.filter(x => x !== val) : [...curr, val])

  // Simple counts for the header chart
  const stageCounts = useMemo(() => {
    const m = {}; for (const s of allStages) m[s] = 0
    for (const r of data) { if (r.stage && m.hasOwnProperty(r.stage)) m[r.stage]++ }
    return m
  }, [data, allStages])

  if (error) return <div style={{ padding: 16, whiteSpace:'pre-wrap' }}>Error: {error}</div>
  if (!data.length) return <div style={{ padding: 16 }}>Loading…</div>
  if (!allStages.length || !allStakeholders.length) return <div style={{ padding: 16 }}>No stages/stakeholders found in the CSV.</div>

  return (
    <div className="container">
      {/* Build tag */}
      <div style={{fontSize:12, color:'var(--muted)', marginBottom:8}}>Build: {BUILD_TAG}</div>

      {/* Highlights / Full switch */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8, gap:8 }}>
        <button
          className={`btn ${viewMode === 'highlights' ? 'active' : ''}`}
          aria-pressed={viewMode === 'highlights'}
          onClick={() => setViewMode('highlights')}
        >
          Highlights
        </button>
        <button
          className={`btn ${viewMode === 'full' ? 'active' : ''}`}
          aria-pressed={viewMode === 'full'}
          onClick={() => setViewMode('full')}
        >
          Full
        </button>
      </div>

      {/* Sticky header with inline bar chart + stage rail */}
      <div className="grid-wrap">
        <div className="table-inner">
          <div className="deck-header">
            <div className="deck-row deck-bars">
              <SmallBarChart
                stages={allStages}
                counts={stageCounts}
                selectedStages={selectedStages}
                onToggle={(s) => toggle(setSelectedStages)(s)}
              />
            </div>

            <div className="deck-row deck-stages">
              <StageRail
                stages={allStages}
                selectedStages={selectedStages}
                onToggle={(s) => toggle(setSelectedStages)(s)}
              />
            </div>

            <div className="deck-row deck-personas">
              <div className="section-title">Stakeholders</div>
              <div className="rail">
                {allStakeholders.map(v => (
                  <button
                    key={v}
                    className={`btn ${selectedStakeholders.includes(v) ? 'active' : ''}`}
                    aria-pressed={selectedStakeholders.includes(v)}
                    onClick={() => toggle(setSelectedStakeholders)(v)}
                  >
                    {v}
                  </button>
                ))}
                <div className="rail-actions">
                  <button className="btn ghost" onClick={()=>setSelectedStakeholders(allStakeholders)}>All</button>
                  <button className="btn ghost" onClick={()=>setSelectedStakeholders([])}>Clear</button>
                </div>
              </div>
            </div>
          </div>

          {/* Cards */}
          <div className="grid" style={gridStyle}>
            {effectiveStages.map(stage => {
              const rowMap = byStage.get(stage) || {}
              return (
                <div key={stage} className="row" style={{ display:'contents' }}>
                  {effectiveStakeholders.map(sh => {
                    const row = rowMap[sh]
                    return (
                      <div key={`${stage}-${sh}`} className="card-cell">
                        {row ? (
                          <div className="card">
                            <h3>{row.stakeholder} @ {row.stage}</h3>
                            {viewMode === 'highlights' ? (
                              <>
                                {HIGHLIGHT_FIELDS.map(key => <div key={key}>{renderField(key, row)}</div>)}
                              </>
                            ) : (
                              <>
                                {FULL_FIELDS.map(key => <div key={key}>{renderField(key, row)}</div>)}
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="empty">—</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
