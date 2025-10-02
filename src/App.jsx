import { useEffect, useMemo, useState } from 'react'

// 1) Put your direct CSV download link here (OneDrive/SharePoint; if it already has ?e=..., append &download=1)
const CSV_URL = 'https://schlafenderhasegmbh-my.sharepoint.com/:x:/g/personal/alexander_stamm_sh-p_de/EQALQ6iYDwFPmpvw_zTIDokBftUFr-RxQjiEb2zs1c64kQ?e=1IwrH2?download=1'

// --- Robust inline CSV parsing (handles commas, quotes, and newlines in quoted cells) ---
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
        if (next === '"') { cell += '"'; i += 2; continue } // escaped quote
        inQuotes = false; i++; continue                      // close quote
      }
      cell += ch; i++; continue
    } else {
      if (ch === '"') { inQuotes = true; i++; continue }
      if (ch === ',') { row.push(cell); cell = ''; i++; continue }
      if (ch === '\r') {
        const next = text[i + 1]
        row.push(cell); cell = ''; rows.push(row); row = []
        i += (next === '\n') ? 2 : 1
        continue
      }
      if (ch === '\n') {
        row.push(cell); cell = ''; rows.push(row); row = []
        i++; continue
      }
      cell += ch; i++
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
  const idx = (name) => headers.indexOf(name)
  const splitSemi = (v) => (v ? String(v).split(';').map(s => s.trim()).filter(Boolean) : [])
  return matrix.slice(1).map(cells => {
    if (cells.length < headers.length) cells = cells.concat(Array(headers.length - cells.length).fill(''))
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

// ——— UI constants ———
const ALL_STAGES = ['Potential','Awareness','Research','Pitch]()_
