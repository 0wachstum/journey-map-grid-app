import { useMemo, useState } from 'react'

const ALL_STAGES = ['Potential','Awareness','Research','Pitching','Deployment','Onboarding','Retention']
const ALL_STAKEHOLDERS = ['User(s)','Champion','Exec / Approver','Team Lead (Systems/QA)','QA','Peers/Refs']
const CSV_URL = https://schlafenderhasegmbh-my.sharepoint.com/:x:/g/personal/alexander_stamm_sh-p_de/EQALQ6iYDwFPmpvw_zTIDokBftUFr-RxQjiEb2zs1c64kQ?e=1IwrH2?download=1;

// RFC-4180-ish CSV parser: handles commas, quotes, and newlines in quoted fields.
// Returns array of row arrays (no headers applied yet).
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
          // Escaped quote ("")
          cell += '"'
          i += 2
          continue
        } else {
          // End of quoted field
          inQuotes = false
          i++
          continue
        }
      } else {
        cell += ch
        i++
        continue
      }
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
        // normalize CRLF → treat \r\n as one newline
        const next = text[i + 1]
        row.push(cell)
        cell = ''
        rows.push(row)
        row = []
        i += (next === '\n') ? 2 : 1
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
  // flush last cell/row
  row.push(cell)
  rows.push(row)
  return rows
}

// Applies header row → array of objects with normalized fields for your app.
function parseCSV(text) {
  const matrix = parseCSVRaw(text).filter(r => r.length && !(r.length === 1 && r[0] === ''))
  if (!matrix.length) return []

  const headers = matrix[0].map(h => (h ?? '').trim())
  const idx = name => headers.indexOf(name)

  const splitSemi = v => (v ? String(v).split(';').map(s => s.trim()).filter(Boolean) : [])

  return matrix.slice(1).map(cells => {
    // ensure cells length matches headers (pad with empty if needed)
    if (cells.length < headers.length) {
      cells = cells.concat(Array(headers.length - cells.length).fill(''))
    }
    return {
      stage: (cells[idx('Stage')] ?? '').trim(),
      stakeholder: (cells[idx('Stakeholder')] ?? '').trim(),
      motivation: (cells[idx('Motivation')] ?? '').trim(),
      goal: (cells[idx('Goal')] ?? '').trim(),
      support: (cells[idx('Support')] ?? '').trim(),
      plays: splitSemi(cells[idx('Plays')]),
      touchpoints: splitSemi(cells[idx('Touchpoints')]),
      kpi: (cells[idx('KPI')] ?? '').trim(),
    }
  })
}
// DATA IMPORTED FROM CSV

import { useEffect, useMemo, useState } from 'react'

export default function App(){
  const [data, setData] = useState([])
  const [selectedStages, setSelectedStages] = useState([])
  const [selectedStakeholders, setSelectedStakeholders] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(CSV_URL, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text() })
      .then(txt => {
        const rows = parseCSV(txt)
        // Basic guard if headers are wrong
        if (!rows.length) throw new Error('No rows parsed — check headers & CSV sharing.')
        setData(rows)
        setSelectedStages([...new Set(rows.map(r => r.stage))])
        setSelectedStakeholders([...new Set(rows.map(r => r.stakeholder))])
      })
      .catch(e => setError(e.message))
  }, [])

  // ...keep your existing UI (toggle rails + grid) but use `data` from state...
}

function ToggleRail({ label, values, selected, onToggle, onSelectAll, onClear }){
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
          >{v}</button>
        ))}
        <button className="btn ghost" onClick={onSelectAll}>All</button>
        <button className="btn ghost" onClick={onClear}>Clear</button>
      </div>
    </div>
  )
}

export default function App(){
  const [selectedStages, setSelectedStages] = useState([...ALL_STAGES])
  const [selectedStakeholders, setSelectedStakeholders] = useState([...ALL_STAKEHOLDERS])
  const [condensed, setCondensed] = useState(true); // default to Condensed
  const toggle = (setArr) => (val) => {
    setArr(curr => curr.includes(val) ? curr.filter(x => x !== val) : [...curr, val])
  }

  const visible = useMemo(() => {
    return data.filter(d => selectedStages.includes(d.stage) && selectedStakeholders.includes(d.stakeholder))
  }, [selectedStages, selectedStakeholders])

  const gridStyle = {
    gridTemplateColumns: selectedStakeholders.map(() => 'minmax(280px, 1fr)').join(' ')
  }

  // map by stage + stakeholder for grid lookup
  const byStage = useMemo(() => {
    const m = new Map()
    for (const st of selectedStages) m.set(st, {})
    for (const row of visible) {
      if (!m.has(row.stage)) m.set(row.stage, {})
      m.get(row.stage)[row.stakeholder] = row
    }
    return m
  }, [visible, selectedStages])

  return (
    <div className="container">
      <h1 className="h1">Customer Journey Grid</h1>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8, gap:8 }}>
      <button
    className={`btn ${condensed ? 'active' : ''}`}
    aria-pressed={condensed}
    onClick={()=>setCondensed(true)}
    title="Compact cards (show only KPI + quick peek)"
      >Condensed</button>
    <button
    className={`btn ${!condensed ? 'active' : ''}`}
    aria-pressed={!condensed}
    onClick={()=>setCondensed(false)}
    title="Full cards (open all details)"
    >Expanded</button>
</div>
      <div className="controls">
        <ToggleRail
          label="Journey Stages"
          values={ALL_STAGES}
          selected={selectedStages}
          onToggle={toggle(setSelectedStages)}
          onSelectAll={() => setSelectedStages([...ALL_STAGES])}
          onClear={() => setSelectedStages([])}
        />
        <ToggleRail
          label="Stakeholders"
          values={ALL_STAKEHOLDERS}
          selected={selectedStakeholders}
          onToggle={toggle(setSelectedStakeholders)}
          onSelectAll={() => setSelectedStakeholders([...ALL_STAKEHOLDERS])}
          onClear={() => setSelectedStakeholders([])}
        />
      </div>

      <div className="grid-wrap">
        <div className="grid" style={gridStyle}>
          {selectedStages.map(stage => {
            const rowMap = byStage.get(stage) || {}
            return (
              <div key={stage} className="row">
                {selectedStakeholders.map(sh => {
                  const row = rowMap[sh]
                  if (!row) return <div key={sh} className="card-cell"><div className="empty">—</div></div>
                  return (
                    <div key={sh} className="card-cell">
                      <div className="card">
                        <h3>{row.stakeholder} @ {row.stage}</h3>
                        <div className="kpi">KPI: {row.kpi}</div>
                        {/* Condensed: keep details collapsed (peek), Expanded: open fully */}
                          <details open={!condensed} className={condensed ? '' : 'opened'}>
                          <summary className="summary-line"></summary>     
                            
                          <p className="meta"><strong>Motivation:</strong> {row.motivation}</p>
                          <p className="meta"><strong>Goal:</strong> {row.goal}</p>
                          <p className="meta"><strong>Support:</strong> {row.support}</p>
                          <div className="meta"><strong>Plays:</strong><ul className="list">{row.plays.map((p,i)=><li key={i}>{p}</li>)}</ul></div>
                          <div className="chips" style={{marginTop:6}}>
                            {row.touchpoints.map((t,i)=>(<span key={i} className="chip">{t}</span>))}
                          </div>
                        </details>
                      </div>
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
}
