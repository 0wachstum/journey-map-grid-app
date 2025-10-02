
import { useEffect, useMemo, useState } from 'react'

// Google Sheets “Publish to web” CSV
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2z8bKJ-yhJgr1yIWUdv4F1XQTntwc64mzz1eabNdApenFaBBmoBK9vpU_QarygI4lJan-pzK3XrE0/pub?output=csv'
const CSV_GID = '' // optional: '123456789'

// ---------- CSV parsing ----------
function stripBOM(text) {
  if (text && text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1)
  }
  return text
}

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
  if (!matrix.length) return { rows: [], headers: [] }
  const headers = matrix[0].map(h => (h ?? '').trim())
  const idx = (name) => headers.indexOf(name)
  const semi = (v) => (v ? String(v).split(';').map(s => s.trim()).filter(Boolean) : [])

  const rows = matrix.slice(1).map(cells => {
    if (cells.length < headers.length) cells = cells.concat(Array(headers.length - cells.length).fill(''))
    const get = (name) => {
      const i = idx(name)
      return i >= 0 ? (cells[i] ?? '') : ''
    }
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

  return { rows, headers }
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
  const [condensed, setCondensed] = useState(true)
  const [data, setData] = useState([])
  const [headers, setHeaders] = useState([])
  const [error, setError] = useState('')
  const [rawPreview, setRawPreview] = useState('')
  const [selectedStages, setSelectedStages] = useState([])
  const [selectedStakeholders, setSelectedStakeholders] = useState([])

  // Load CSV with diagnostics
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
        const firstNewline = txt.indexOf('\n')
        const firstLine = firstNewline >= 0 ? txt.slice(0, firstNewline) : txt
        const secondNewline = txt.indexOf('\n', firstNewline + 1)
        const secondLine = secondNewline >= 0 ? txt.slice(firstNewline + 1, secondNewline) : ''
        setRawPreview(`${firstLine}\n${secondLine}`)

        if (/<!doctype html|<html/i.test(txt.slice(0, 200))) {
          throw new Error('Received HTML instead of CSV. Check: publish the correct tab to web, or add &single=true&gid=<tab_gid>.')
        }

        const { rows, headers } = parseCSV(txt)
        if (!rows.length) {
          const hint = [
            'No rows parsed. Check:',
            '• Row 1 must be the header (Stage,Stakeholder,...)',
            '• At least one data row under the header',
            '• Correct tab is published (try &single=true&gid=<tab>)',
          ].join('\n')
          setHeaders(headers)
          throw new Error(hint)
        }

        setData(rows)
        setHeaders(headers)
        setSelectedStages([...new Set(rows.map(r => r.stage))])
        setSelectedStakeholders([...new Set(rows.map(r => r.stakeholder))])
      } catch (e) {
        setError(e.message || String(e))
      }
    })()
  }, [])

  // Derive all stages/stakeholders dynamically
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

  // Which stages/stakeholders actually have any data under current filters
  const activeStages = useMemo(() => {
    return selectedStages.filter(st =>
      data.some(d => d.stage === st && selectedStakeholders.includes(d.stakeholder))
    )
  }, [data, selectedStages, selectedStakeholders])

  const activeStakeholders = useMemo(() => {
    return selectedStakeholders.filter(sh =>
      data.some(d => d.stakeholder === sh && selectedStages.includes(d.stage))
    )
  }, [data, selectedStages, selectedStakeholders])

  // Logical grid behavior
  const effectiveStages = activeStages.length === 1 ? activeStages : selectedStages
  const effectiveStakeholders = activeStakeholders.length === 1 ? activeStakeholders : selectedStakeholders

  // stage → stakeholder → row map
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

  const gridStyle = {
    gridTemplateColumns: effectiveStakeholders.map(() => 'minmax(280px, 1fr)').join(' ')
  }

  const toggle = (setArr) => (val) =>
    setArr(curr => curr.includes(val) ? curr.filter(x => x !== val) : [...curr, val])

  return (
    <div className="container">
      <h1 className="h1">Customer Journey Grid</h1>

      {/* Debug helper */}
      {(error || headers.length || rawPreview) && (
        <details style={{ marginBottom: 12 }} open={!!error}>
          <summary>CSV Debug</summary>
          {error && <pre style={{ whiteSpace:'pre-wrap', color:'#f88' }}>{error}</pre>}
          {headers.length > 0 && (
            <p className="meta"><strong>Headers detected:</strong> {headers.join(' | ')}</p>
          )}
          {rawPreview && (
            <pre className="meta" style={{ whiteSpace:'pre-wrap' }}>
{rawPreview}
            </pre>
          )}
        </details>
      )}

      {/* Condensed / Expanded switch */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8, gap:8 }}>
        <button className={`btn ${condensed ? 'active' : ''}`} aria-pressed={condensed} onClick={()=>setCondensed(true)}>Condensed</button>
        <button className={`btn ${!condensed ? 'active' : ''}`} aria-pressed={!condensed} onClick={()=>setCondensed(false)}>Expanded</button>
      </div>

      <div className="controls">
        <ToggleRail
          label="Journey Stages"
          values={allStages}
          selected={selectedStages}
          onToggle={toggle(setSelectedStages)}
          onSelectAll={() => setSelectedStages(allStages)}
          onClear={() => setSelectedStages([])}
        />
        <ToggleRail
          label="Stakeholders"
          values={allStakeholders}
          selected={selectedStakeholders}
          onToggle={toggle(setSelectedStakeholders)}
          onSelectAll={() => setSelectedStakeholders(allStakeholders)}
          onClear={() => setSelectedStakeholders([])}
        />
      </div>

      {!data.length ? (
        <div style={{ padding: 16 }}>Loading…</div>
      ) : (
        <div className="grid-wrap">
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

                    return (
                      <div key={`${stage}-${sh}`} className="card-cell">
                        {row ? (
                          <div className="card">
                            <h3>{row.stakeholder} @ {row.stage}</h3>
                            {row.kpi && <div className="kpi">KPI: {row.kpi}</div>}

                            <details open={!condensed} className={condensed ? '' : 'opened'}>
                              <summary className="summary-line"></summary>

                              {row.motivation && (<p className="meta"><strong>Motivation:</strong> {row.motivation}</p>)}
                              {row.goal && (<p className="meta"><strong>Goal:</strong> {row.goal}</p>)}
                              {row.support && (<p className="meta"><strong>Support:</strong> {row.support}</p>)}

                              {row.plays?.length > 0 && (
                                <div className="meta">
                                  <strong>Plays:</strong>
                                  <ul className="list">{row.plays.map((p,i)=><li key={i}>{p}</li>)}</ul>
                                </div>
                              )}

                              {row.touchpoints?.length > 0 && (
                                <div className="chips" style={{ marginTop: 6 }}>
                                  {row.touchpoints.map((t,i)=>(<span key={i} className="chip">{t}</span>))}
                                </div>
                              )}

                              {row.emotions?.length > 0 && (
                                <div className="meta">
                                  <strong>Emotions:</strong>
                                  <div className="chips" style={{ marginTop: 6 }}>
                                    {row.emotions.map((e,i)=>(<span key={i} className="chip">{e}</span>))}
                                  </div>
                                </div>
                              )}

                              {row.quotes?.length > 0 && (
                                <div className="meta">
                                  <strong>Quotes:</strong>
                                  <ul className="list">
                                    {row.quotes.map((q,i)=><li key={i}>&ldquo;{q}&rdquo;</li>)}
                                  </ul>
                                </div>
                              )}

                              {row.roles?.length > 0 && (
                                <div className="meta">
                                  <strong>Roles / Stakeholders:</strong>
                                  <div className="chips" style={{ marginTop: 6 }}>
                                    {row.roles.map((r,i)=>(<span key={i} className="chip">{r}</span>))}
                                  </div>
                                </div>
                              )}

                              {row.influences?.length > 0 && (
                                <div className="meta">
                                  <strong>Influences:</strong>
                                  <ul className="list">
                                    {row.influences.map((inf,i)=><li key={i}>{inf}</li>)}
                                  </ul>
                                </div>
                              )}

                              {row.barriers?.length > 0 && (
                                <div className="meta">
                                  <strong>Barriers / Risks:</strong>
                                  <ul className="list">
                                    {row.barriers.map((b,i)=><li key={i}>{b}</li>)}
                                  </ul>
                                </div>
                              )}

                              {row.evidence?.length > 0 && (
                                <div className="meta">
                                  <strong>Evidence / Proof Needed:</strong>
                                  <ul className="list">
                                    {row.evidence.map((ev,i)=><li key={i}>{ev}</li>)}
                                  </ul>
                                </div>
                              )}

                              {row.opportunities?.length > 0 && (
                                <div className="meta">
                                  <strong>Opportunities (How we can win):</strong>
                                  <ul className="list">
                                    {row.opportunities.map((op,i)=><li key={i}>{op}</li>)}
                                  </ul>
                                </div>
                              )}
                            </details>
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
      )}
    </div>
  )
}
