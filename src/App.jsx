import { useEffect, useMemo, useState } from 'react'

// Google Sheets “Publish to web” CSV
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2z8bKJ-yhJgr1yIWUdv4F1XQTntwc64mzz1eabNdApenFaBBmoBK9vpU_QarygI4lJan-pzK3XrE0/pub?output=csv'

// ---------- CSV parsing ----------
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
        if (next === '"') { cell += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      cell += ch; i++; continue
    } else {
      if (ch === '"') { inQuotes = true; i++; continue }
      if (ch === ',') { row.push(cell); cell = ''; i++; continue }
      if (ch === '\r') { const n = text[i + 1]; row.push(cell); cell=''; rows.push(row); row=[]; i += (n === '\n') ? 2 : 1; continue }
      if (ch === '\n') { row.push(cell); cell=''; rows.push(row); row=[]; i++; continue }
      cell += ch; i++
    }
  }
  row.push(cell); rows.push(row)
  return rows
}

function parseCSV(text) {
  const matrix = parseCSVRaw(text).filter(r => r.length && !(r.length === 1 && r[0] === ''))
  if (!matrix.length) return []
  const headers = matrix[0].map(h => (h ?? '').trim())
  const idx = (name) => headers.indexOf(name)
  const semi = (v) => (v ? String(v).split(';').map(s => s.trim()).filter(Boolean) : [])

  return matrix.slice(1).map(cells => {
    if (cells.length < headers.length) cells = cells.concat(Array(headers.length - cells.length).fill(''))

    const get = (name) => {
      const i = idx(name)
      return i >= 0 ? (cells[i] ?? '') : ''
    }

    return {
      // Core required fields
      stage:       get('Stage').trim(),
      stakeholder: get('Stakeholder').trim(),
      motivation:  get('Motivation').trim(),
      goal:        get('Goal').trim(),
      support:     get('Support').trim(),
      plays:       semi(get('Plays')),
      touchpoints: semi(get('Touchpoints')),
      kpi:         get('KPI').trim(),

      // Optional detail fields
      emotions:      semi(get('Emotions')),
      quotes:        semi(get('Quotes')),
      roles:         semi(get('Roles')),
      influences:    semi(get('Influences')),
      barriers:      semi(get('Barriers')),
      evidence:      semi(get('Evidence')),
      opportunities: semi(get('Opportunities')),

      // Optional override & ordering / grouping
      highlightFields: semi(get('HighlightFields')), // e.g. plays;emotions;roles
      stageOrder:       Number(get('StageOrder') || Number.POSITIVE_INFINITY),
      stakeholderOrder: Number(get('StakeholderOrder') || Number.POSITIVE_INFINITY),
      stageGroup:       get('StageGroup').trim(),
    }
  })
}

// ---------- Field metadata ----------
const FIELD_LABELS = {
  motivation: 'Motivation',
  goal: 'Goal',
  support: 'Support',
  plays: 'Plays',
  touchpoints: 'Touchpoints',
  kpi: 'KPI',
  emotions: 'Emotions',
  quotes: 'Quotes',
  roles: 'Roles / Stakeholders',
  influences: 'Influences',
  barriers: 'Barriers / Risks',
  evidence: 'Evidence / Proof Needed',
  opportunities: 'Opportunities (How we can win)',
}

// fields that render as chip rows
const CHIP_FIELDS = new Set(['touchpoints', 'emotions', 'roles'])
// fields that render as list bullets
const LIST_FIELDS = new Set(['plays', 'quotes', 'influences', 'barriers', 'evidence', 'opportunities'])
// master ordered list for full view
const FIELD_ORDER = ['motivation','goal','support','plays','touchpoints','emotions','quotes','roles','influences','barriers','evidence','opportunities']
// evergreen highlights (KPI stays near title)
const BASE_HIGHLIGHTS = ['motivation','touchpoints']
// priority for auto-choosing the extra 3 highlight sections
const HIGHLIGHT_PRIORITY = ['goal','plays','evidence','barriers','emotions','quotes','roles','influences','support','opportunities']

function sectionHasContent(row, key) {
  const v = row?.[key]
  if (Array.isArray(v)) return v.length > 0
  return Boolean(v && String(v).trim())
}

function normalizeKey(k) {
  return String(k || '').toLowerCase().replace(/\s+/g,'').replace(/[^\w]/g,'')
}

function renderSection(row, key) {
  if (!sectionHasContent(row, key)) return null
  if (key === 'kpi') {
    return <div className="kpi">KPI: {row.kpi}</div>
  }
  const label = FIELD_LABELS[key] || key
  if (CHIP_FIELDS.has(key)) {
    return (
      <div className="meta">
        <strong>{label}:</strong>
        <div className="chips" style={{ marginTop: 6 }}>
          {row[key].map((t, i) => (<span key={i} className="chip">{t}</span>))}
        </div>
      </div>
    )
  }
  if (LIST_FIELDS.has(key)) {
    return (
      <div className="meta">
        <strong>{label}:</strong>
        <ul className="list">
          {row[key].map((t, i) => (
            <li key={i}>{key === 'quotes' ? <>“{t}”</> : t}</li>
          ))}
        </ul>
      </div>
    )
  }
  // default scalar paragraph
  return <p className="meta"><strong>{label}:</strong> {row[key]}</p>
}

function computeHighlightKeys(row) {
  // Start with evergreen
  let highlights = [...BASE_HIGHLIGHTS]

  // Optional per-row override via CSV: HighlightFields (e.g., "plays;emotions;roles")
  const valid = new Set(FIELD_ORDER)
  const override = (row.highlightFields || [])
    .map(normalizeKey)
    .map(k => {
      // map normalized back to known keys
      // (handles values like 'roles', 'Roles', 'roles/stakeholders')
      for (const key of FIELD_ORDER) if (normalizeKey(key) === k) return key
      return null
    })
    .filter(Boolean)
    .filter(k => valid.has(k))
    .filter(k => k !== 'motivation' && k !== 'touchpoints' && k !== 'kpi')

  const chosen = []
  for (const k of override) {
    if (chosen.length >= 3) break
    if (sectionHasContent(row, k)) chosen.push(k)
  }

  // backfill from priority if we have fewer than 3 override picks
  if (chosen.length < 3) {
    for (const k of HIGHLIGHT_PRIORITY) {
      if (chosen.length >= 3) break
      if (override.includes(k)) continue
      if (sectionHasContent(row, k)) chosen.push(k)
    }
  }

  highlights = highlights.concat(chosen.slice(0,3))
  return highlights
}

// ---------- UI ----------
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

export default function App() {
  // NOTE: we reuse 'condensed' as the global Highlights/Full toggle
  // condensed = true  → Highlights
  // condensed = false → Full
  const [condensed, setCondensed] = useState(true)
  const [data, setData] = useState([])
  const [error, setError] = useState('')
  const [selectedStages, setSelectedStages] = useState([])
  const [selectedStakeholders, setSelectedStakeholders] = useState([])

  // Load CSV (cache-busted)
  useEffect(() => {
    const url = `${CSV_URL}&t=${Date.now()}`
    fetch(url, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text() })
      .then(txt => {
        const rows = parseCSV(txt)
        if (!rows.length) throw new Error('No rows parsed')
        setData(rows)
        // selections from data (unique, first-appearance order)
        setSelectedStages([...new Set(rows.map(r => r.stage))])
        setSelectedStakeholders([...new Set(rows.map(r => r.stakeholder))])
      })
      .catch(e => setError(e.message))
  }, [])

  // Derive all stages/stakeholders dynamically (respect optional *Order columns)
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
    rows.sort((a, b) => (a.stakeholderOrder - b.stakeholderOrder) || 0
