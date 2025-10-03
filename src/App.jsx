import { useEffect, useMemo, useState } from 'react'
import JourneyRail from './JourneyRail.jsx'
import ProspectsBar from './ProspectsBar.jsx'

// Google Sheets CSV
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2z8bKJ-yhJgr1yIWUdv4F1XQTntwc64mzz1eabNdApenFaBBmoBK9vpU_QarygI4lJan-pzK3XrE0/pub?output=csv'
const CSV_GID = '' // optional tab gid

function stripBOM(text) { return text && text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text }

// --- CSV parsing (unchanged & robust) ---
function parseCSVRaw(text) {
  const rows = []; let row = []; let cell = ''; let i = 0; let inQuotes = false
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') { const next = text[i+1]; if (next === '"') { cell += '"'; i += 2; continue } inQuotes = false; i++; continue }
      cell += ch; i++; continue
    } else {
      if (ch === '"') { inQuotes = true; i++; continue }
      if (ch === ',') { row.push(cell); cell=''; i++; continue }
      if (ch === '\r') { const n = text[i+1]; row.push(cell); cell=''; rows.push(row); row=[]; i += (n==='\\n')?2:1; continue }
      if (ch === '\n') { row.push(cell); cell=''; rows.push(row); row=[]; i++; continue }
      cell += ch; i++
    }
  }
  row.push(cell); rows.push(row); return rows
}
function parseCSV(text) {
  const matrix = parseCSVRaw(text).filter(r => r.length && !(r.length===1 && r[0]===''))
  if (!matrix.length) return []
  const headers = matrix[0].map(h => (h ?? '').trim())
  const headersLc = headers.map(h => h.toLowerCase())
  const idx = (name) => headersLc.indexOf(String(name).toLowerCase())
  const semi = (v) => (v ? String(v).split(';').map(s => s.trim()).filter(Boolean) : [])

  return matrix.slice(1).map(cells => {
    if (cells.length < headers.length) cells = cells.concat(Array(headers.length - cells.length).fill(''))
    const get = (name) => { const i = idx(name); return i >= 0 ? (cells[i] ?? '') : '' }
    return {
      stage:       get('Stage').trim(),
      stakeholder: get('Stakeholder').trim(),
      motivation:  get('Motivation').trim(),
      goal:        get('Goal').trim(),
      support:     get('Support').trim(),
      plays:       semi(get('Plays')),
      touchpoints: semi(get('Touchpoints')),
      kpi:         get('KPI').trim(),
      emotions:      semi(get('Emotions')),
      quotes:        semi(get('Quotes')),
      roles:         semi(get('Roles')),
      influences:    semi(get('Influences')),
      barriers:      semi(get('Barriers')),
      evidence:      semi(get('Evidence')),
      opportunities: semi(get('Opportunities')),
      stageOrder:       Number(get('StageOrder') || Number.POSITIVE_INFINITY),
      stakeholderOrder: Number(get('StakeholderOrder') || Number.POSITIVE_INFINITY),
      stageGroup:       get('StageGroup').trim(),
    }
  })
}

// --- Small UI helpers ---
function ToggleRail({ label, values, selected, onToggle, onSelectAll, onClear }) {
  return (
    <div>
      <div className="section-title">{label}</div>
      <div className="rail">
        {values.map(v => (
          <button
            key={v}
            className={`btn ${selected.includes(v) ? 'active' : ''}`}
            aria-pressed={selected.includes(v)}
            onClick={() => onToggle(v)}
          >
            {v}
          </button>
        ))}
        <button className="btn ghost" onClick={onSelectAll}>All</button>
        <button className="btn ghost" onClick={onClear}>Clear</button>
      </div>
    </div>
  )
}

const OPTIONAL_ORDER = ['goal','support','plays','emotions','quotes','roles','influences','barriers','evidence','opportunities']
const FULL_ORDER = ['motivation','goal','support','plays','touchpoints','emotions','quotes','roles','influences','barriers','evidence','opportunities']

function pickHighlightExtras(row, max = 3) {
  if (!row) return []
  const picks = []
  for (const key of OPTIONAL_ORDER) {
    const val = row[key]
    const has = Array.isArray(val) ? val.length > 0 : (typeof val === 'string' ? val.trim().length > 0 : false)
    if (has) picks.push(key)
    if (picks.length >= max) break
  }
  return picks
}

const Section = ({ label, children }) => (<div className="meta"><strong>{label}:</strong>{children}</div>)
const Chips = ({ items }) => (<div className="chips" style={{ marginTop: 6 }}>{items.map((t,i)=>(<span key={i} className="chip">{t}</span>))}</div>)
const List  = ({ items, quote }) => (<ul className="list">{items.map((v,i)=>(<li key={i}>{quote ? <>&ldquo;{v}&rdquo;</> : v}</li>))}</ul>)

function renderField(key, row) {
  switch (key) {
    case 'motivation': return row.motivation ? <p className="meta"><strong>Motivation:</strong> {row.motivation}</p> : null
    case 'goal': return row.goal ? <p className="meta"><strong>Goal:</strong> {row.goal}</p> : null
    case 'support': return row.support ? <p className="meta"><strong>Support:</strong> {row.support}</p> : null
    case 'plays': return row.plays?.length ? <Section label="Plays"><List items={row.plays} /></Section> : null
    case 'touchpoints': return row.touchpoints?.length ? <Section label="Touchpoints"><Chips items={row.touchpoints} /></Section> : null
    case 'emotions': return row.emotions?.length ? <Section label="Emotions"><Chips items={row.emotions} /></Section> : null
    case 'quotes': return row.quotes?.length ? <Section label="Quotes"><List items={row.quotes} quote /></Section> : null
    case 'roles': return row.roles?.length ? <Section label="Roles / Stakeholders"><Chips items={row.roles} /></Section> : null
    case 'influences': return row.influences?.length ? <Section label="Influences"><List items={row.influences} /></Section> : null
    case 'barriers': return row.barriers?.length ? <Section label="Barriers / Risks"><List items={row.barriers} /></Section> : null
    case 'evidence': return row.evidence?.length ? <Section label="Evidence / Proof Needed"><List items={row.evidence} /></Section> : null
    case 'opportunities': return row.opportunities?.length ? <Section label="Opportunities (How we can win)"><List items={row.opportunities} /></Section> : null
    default: return null
  }
}

export default function App() {
  const [viewMode, setViewMode] = useState('highlights') // 'highlights' | 'full'
  const [data, setData] = useState([])
  const [error, setError] = useState('')
  const [selectedStages, setSelectedStages] = useState([])
  const [selectedStakeholders, setSelectedStakeholders] = useState([])

  // Load CSV
  useEffect(() => {
    (async () => {
      try {
        const base = CSV_URL
        const gidPart = CSV_GID ? `${base.includes('?') ? '&' : '?'}single=true&gid=${CSV_GID}` : ''
        const bustPart = `${(base.includes('?') || gidPart) ? '&' : '?'}t=${Date.now()}`
        const url = `${base}${gidPart}${bustPart}`
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

  // Derive dynamic lists (respecting optional *Order)
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

  // Active subsets
  const activeStages = useMemo(() => {
    return selectedStages.filter(st => data.some(d => d.stage === st && selectedStakeholders.includes(d.stakeholder)))
  }, [data, selectedStages, selectedStakeholders])

  const activeStakeholders = useMemo(() => {
    return selectedStakeholders.filter(sh => data.some(d => d.stakeholder === sh && selectedStages.includes(d.stage)))
  }, [data, selectedStages, selectedStakeholders])

  // Grid behavior: keep alignment for multi selection
  const effectiveStages = activeStages.length === 1 ? activeStages : selectedStages
  const effectiveStakeholders = activeStakeholders.length === 1 ? activeStakeholders : selectedStakeholders

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

  const toggle = (setArr) => (val) =>
    setArr(curr => curr.includes(val) ? curr.filter(x => x !== val) : [...curr, val])

  if (error) return <div style={{ padding: 16, whiteSpace:'pre-wrap' }}>Error: {error}</div>
  if (!data.length) return <div style={{ padding: 16 }}>Loading…</div>
  if (!allStages.length || !allStakeholders.length) return <div style={{ padding: 16 }}>No stages/stakeholders found in the CSV.</div>

  return (
    <div className="container">

      {/* View Mode switch */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8, gap:8 }}>
        <button className={`btn ${viewMode === 'highlights' ? 'active' : ''}`} aria-pressed={viewMode === 'highlights'} onClick={()=>setViewMode('highlights')}>Highlights</button>
        <button className={`btn ${viewMode === 'full' ? 'active' : ''}`} aria-pressed={viewMode === 'full'} onClick={()=>setViewMode('full')}>Full</button>
      </div>

      {/* Keep personas filter only */}
      <div className="controls">
        <ToggleRail
          label="Stakeholders"
          values={allStakeholders}
          selected={selectedStakeholders}
          onToggle={toggle(setSelectedStakeholders)}
          onSelectAll={() => setSelectedStakeholders(allStakeholders)}
          onClear={() => setSelectedStakeholders([])}
        />
      </div>

      {/* Table wrapper: chart + rail + grid share the same width */}
      <div className="grid-wrap">
        {/* Prospects bar chart (click a bar to toggle that stage) */}
        <div style={{ padding: '10px 12px 4px' }}>
          <ProspectsBar
            stages={allStages}
            onBarClick={(st) => toggle(setSelectedStages)(st)}
          />
        </div>

        {/* Journey Rail inside grid-wrap so it spans the table width */}
        <div style={{ padding: '0 8px 8px' }}>
          <JourneyRail
            stages={allStages}
            selectedStages={selectedStages}
            onToggle={toggle(setSelectedStages)}
            onSelectAll={() => setSelectedStages(allStages)}
            onClear={() => setSelectedStages([])}
          />
        </div>

        {/* The grid itself */}
        <div className="grid" style={gridStyle}>
          {effectiveStages.map(stage => {
            const rowMap = byStage.get(stage) || {}
            const stageHasAny = Object.keys(rowMap).length > 0
            if (!stageHasAny && effectiveStages.length === 1) return null

return (
  <div className="container">
    {/* View Mode switch (unchanged) */}
    <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8, gap:8 }}>
      <button className={`btn ${viewMode === 'highlights' ? 'active' : ''}`} aria-pressed={viewMode === 'highlights'} onClick={()=>setViewMode('highlights')}>Highlights</button>
      <button className={`btn ${viewMode === 'full' ? 'active' : ''}`} aria-pressed={viewMode === 'full'} onClick={()=>setViewMode('full')}>Full</button>
    </div>

    {/* Table wrapper: BAR → RAIL → STAKEHOLDERS → CARDS */}
    <div className="grid-wrap">

      {/* 1) Bar Chart (no stage names) */}
      <div style={{ padding: '10px 12px 0' }}>
        <ProspectsBar
          stages={allStages}
          // later: pass real counts like counts={{ Potential: 120, Awareness: 90, ... }}
          onBarClick={(st) => toggle(setSelectedStages)(st)}
        />
      </div>

      {/* 2) Stage Rail / Selector (aligned, full width) */}
      <div style={{ padding: '0 8px 8px' }}>
        <JourneyRail
          stages={allStages}
          selectedStages={selectedStages}
          onToggle={toggle(setSelectedStages)}
          onSelectAll={() => setSelectedStages(allStages)}
          onClear={() => setSelectedStages([])}
        />
      </div>

      {/* 3) Stakeholder selector (moved inside, right above cards) */}
      <div style={{ padding: '0 12px 8px' }}>
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
          <button className="btn ghost" onClick={()=>setSelectedStakeholders(allStakeholders)}>All</button>
          <button className="btn ghost" onClick={()=>setSelectedStakeholders([])}>Clear</button>
        </div>
      </div>

      {/* 4) Cards */}
      <div className="grid" style={gridStyle}>
        {effectiveStages.map(stage => {
          const rowMap = byStage.get(stage) || {}
          const stageHasAny = Object.keys(rowMap).length > 0
          if (!stageHasAny && effectiveStages.length === 1) return null

          return (
            <div key={stage} className="row" style={{ display:'contents' }}>
              {effectiveStakeholders.map(sh => {
                const row = rowMap[sh]
                if (!row && effectiveStakeholders.length === 1) return null

                const picks = row ? pickHighlightExtras(row, 3) : []

                return (
                  <div key={`${stage}-${sh}`} className="card-cell">
                    {row ? (
                      <div className="card">
                        <h3>{row.stakeholder} @ {row.stage}</h3>
                        {row.kpi && <div className="kpi">KPI: {row.kpi}</div>}
                        {viewMode === 'highlights' ? (
                          <>
                            {renderField('motivation', row)}
                            {renderField('touchpoints', row)}
                            {OPTIONAL_ORDER.filter(k => picks.includes(k)).map(k => (
                              <div key={k}>{renderField(k, row)}</div>
                            ))}
                          </>
                        ) : (
                          <>
                            {['motivation','goal','support','plays','touchpoints','emotions','quotes','roles','influences','barriers','evidence','opportunities'].map(k => (
                              <div key={k}>{renderField(k, row)}</div>
                            ))}
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
)
