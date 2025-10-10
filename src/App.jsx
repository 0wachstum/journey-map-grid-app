import { useEffect, useMemo, useState } from 'react'
import StageDeck from './StageDeck.jsx'

// ===== CONFIG =====
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2z8bKJ-yhJgr1yIWUdv4F1XQTntwc64mzz1eabNdApenFaBBmoBK9vpU_QarygI4lJan-pzK3XrE0/pub?output=csv'
const CSV_GID = ''

// View logic
const HIGHLIGHT_FIELDS = ['kpi', 'motivation', 'emotions', 'barriers', 'opportunities', 'quotes']
const FULL_FIELDS = ['motivation', 'goal', 'support', 'barriers', 'opportunities', 'signals', 'kpi', 'emotions', 'quotes', 'evidence']

function stripBOM(text) {
  return text && text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}

// --- CSV parsing (robust) ---
function parseCSVRaw(text) {
  const rows = []
  let row = []
  let cell = ''
  let i = 0
  let inQuotes = false
  
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1]
        if (next === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
        continue
      }
      if (ch === ',') {
        row.push(cell)
        cell = ''
        i++
        continue
      }
      if (ch === '\r') {
        const n = text[i + 1]
        row.push(cell)
        cell = ''
        rows.push(row)
        row = []
        i += (n === '\n') ? 2 : 1
        continue
      }
      if (ch === '\n') {
        row.push(cell)
        cell = ''
        rows.push(row)
        row = []
        i++
        continue
      }
      cell += ch
      i++
    }
  }
  row.push(cell)
  rows.push(row)
  return rows
}

function parseCSV(text) {
  const matrix = parseCSVRaw(text).filter(r => r.length && !(r.length === 1 && r[0] === ''))
  if (!matrix.length) return []
  
  const headers = matrix[0].map(h => (h ?? '').trim())
  const headersLc = headers.map(h => h.toLowerCase())
  const idx = (name) => headersLc.indexOf(String(name).toLowerCase())
  const semi = (v) => (v ? String(v).split(';').map(s => s.trim()).filter(Boolean) : [])
  
  return matrix.slice(1).map(cells => {
    if (cells.length < headers.length) {
      cells = cells.concat(Array(headers.length - cells.length).fill(''))
    }
    const get = (name) => {
      const i = idx(name)
      return i >= 0 ? (cells[i] ?? '') : ''
    }
    
    return {
      stage: get('Stage').trim(),
      stakeholder: get('Stakeholder').trim(),
      motivation: get('Motivation').trim(),
      goal: get('Goal').trim(),
      support: get('Support').trim(),
      barriers: semi(get('Barriers')),
      opportunities: semi(get('Opportunities')),
      signals: semi(get('Signals')),
      kpi: semi(get('KPI')),
      emotions: semi(get('Emotions')),
      quotes: semi(get('Quotes')),
      evidence: semi(get('Evidence')),
      stageOrder: Number(get('StageOrder') || Number.POSITIVE_INFINITY),
      stakeholderOrder: Number(get('StakeholderOrder') || Number.POSITIVE_INFINITY),
    }
  })
}

// --- UI helpers ---
const Section = ({ label, children }) => (
  <div className="meta">
    <strong>{label}:</strong>
    {children}
  </div>
)

const Chips = ({ items }) => (
  <div className="chips" style={{ marginTop: 6 }}>
    {items.map((t, i) => (
      <span key={i} className="chip">{t}</span>
    ))}
  </div>
)

const List = ({ items, quote }) => (
  <ul className="list">
    {items.map((v, i) => (
      <li key={i}>{quote ? <>&ldquo;{v}&rdquo;</> : v}</li>
    ))}
  </ul>
)

function renderField(key, row) {
  switch (key) {
    case 'motivation':
      return row.motivation ? (
        <p className="meta break">
          <strong>Motivation:</strong> {row.motivation}
        </p>
      ) : null
      
    case 'goal':
      return row.goal ? (
        <p className="meta break">
          <strong>Goal:</strong> {row.goal}
        </p>
      ) : null
      
    case 'support':
      return row.support ? (
        <p className="meta break">
          <strong>Support:</strong> {row.support}
        </p>
      ) : null
      
    case 'kpi':
      return row.kpi?.length ? (
        <Section label="KPI">
          <Chips items={row.kpi} />
        </Section>
      ) : null
      
    case 'emotions':
      return row.emotions?.length ? (
        <Section label="Emotions">
          <Chips items={row.emotions} />
        </Section>
      ) : null
      
    case 'barriers':
      return row.barriers?.length ? (
        <Section label="Barriers">
          <List items={row.barriers} />
        </Section>
      ) : null
      
    case 'opportunities':
      return row.opportunities?.length ? (
        <Section label="Opportunities">
          <List items={row.opportunities} />
        </Section>
      ) : null
      
    case 'quotes':
      return row.quotes?.length ? (
        <Section label="Quotes">
          <List items={row.quotes} quote />
        </Section>
      ) : null
      
    case 'signals':
      return row.signals?.length ? (
        <Section label="Signals">
          <Chips items={row.signals} />
        </Section>
      ) : null
      
    case 'evidence':
      return row.evidence?.length ? (
        <Section label="Evidence">
          <List items={row.evidence} />
        </Section>
      ) : null
      
    default:
      return null
  }
}

export default function App() {
  const [viewMode, setViewMode] = useState('highlights')
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
        setSelectedStages([...new Set(rows.map(r => r.stage).filter(Boolean))])
        setSelectedStakeholders([...new Set(rows.map(r => r.stakeholder).filter(Boolean))])
      } catch (e) {
        setError(e.message || String(e))
      }
    })()
  }, [])

  // Derive dynamic lists (respect ordering hints)
  const allStages = useMemo(() => {
    const seen = new Set()
    const rows = [...data]
    rows.sort((a, b) => (a.stageOrder - b.stageOrder) || 0)
    const list = []
    for (const r of rows) {
      if (!r.stage) continue
      if (!seen.has(r.stage)) {
        seen.add(r.stage)
        list.push(r.stage)
      }
    }
    return list
  }, [data])

  const allStakeholders = useMemo(() => {
    const seen = new Set()
    const rows = [...data]
    rows.sort((a, b) => (a.stakeholderOrder - b.stakeholderOrder) || 0)
    const list = []
    for (const r of rows) {
      if (!r.stakeholder) continue
      if (!seen.has(r.stakeholder)) {
        seen.add(r.stakeholder)
        list.push(r.stakeholder)
      }
    }
    return list
  }, [data])

  // Visible rows under current filters
  const visible = useMemo(() => {
    return data.filter(d => 
      selectedStages.includes(d.stage) && 
      selectedStakeholders.includes(d.stakeholder)
    )
  }, [data, selectedStages, selectedStakeholders])

  // Prune empty rows/columns
  const activeStages = useMemo(() => {
    return selectedStages.filter(st => visible.some(d => d.stage === st))
  }, [visible, selectedStages])

  const activeStakeholders = useMemo(() => {
    return selectedStakeholders.filter(sh => visible.some(d => d.stakeholder === sh))
  }, [visible, selectedStakeholders])

  // stage → stakeholder → row
  const byStage = useMemo(() => {
    const m = new Map()
    for (const st of activeStages) m.set(st, {})
    for (const row of visible) {
      if (!activeStages.includes(row.stage)) continue
      if (!activeStakeholders.includes(row.stakeholder)) continue
      if (!m.has(row.stage)) m.set(row.stage, {})
      m.get(row.stage)[row.stakeholder] = row
    }
    return m
  }, [visible, activeStages, activeStakeholders])

  const gridStyle = {
    gridTemplateColumns: activeStakeholders.map(() => 'minmax(300px, 1fr)').join(' ')
  }

  const toggle = (setArr) => (val) => 
    setArr(curr => 
      curr.includes(val) ? curr.filter(x => x !== val) : [...curr, val]
    )

  if (error) {
    return (
      <div style={{ padding: 16, whiteSpace: 'pre-wrap' }}>
        Error: {error}
      </div>
    )
  }
  
  if (!data.length) {
    return <div style={{ padding: 16 }}>Loading…</div>
  }
  
  if (!allStages.length || !allStakeholders.length) {
    return (
      <div style={{ padding: 16 }}>
        No stages/stakeholders found in the CSV.
      </div>
    )
  }

  return (
    <div className="container">
      {/* View Mode switch */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, gap: 8 }}>
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

      {/* Shared scroller for header + cards */}
      <div className="grid-wrap">
        <div className="table-inner">
          {/* Sticky header */}
          <div className="deck-header">
            <div className="deck-row deck-bars">
              <StageDeck
                stages={allStages}
                selectedStages={selectedStages}
                onToggle={toggle(setSelectedStages)}
              />
            </div>

            {/* Stakeholder rail */}
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
                  <button
                    className="btn ghost"
                    onClick={() => setSelectedStakeholders(allStakeholders)}
                  >
                    All
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => setSelectedStakeholders([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cards */}
          <div className="grid" style={gridStyle}>
            {activeStages.map(stage => {
              const rowMap = byStage.get(stage) || {}
              return (
                <div key={stage} className="row" style={{ display: 'contents' }}>
                  {activeStakeholders.map(sh => {
                    const row = rowMap[sh]
                    const fieldsToShow = viewMode === 'highlights' ? HIGHLIGHT_FIELDS : FULL_FIELDS
                    
                    return (
                      <div key={`${stage}-${sh}`} className="card-cell">
                        {row ? (
                          <div className="card">
                            <h3>{row.stakeholder} @ {row.stage}</h3>
                            {fieldsToShow.map(key => (
                              <div key={key}>{renderField(key, row)}</div>
                            ))}
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
