# Customer Journey Grid (Vite + React)
- Toggle **Stages** and **Stakeholders** to show a grid: rows = stages, columns = stakeholders.
- Cells show a compact card with KPI and expandable details.

## Run
npm install
npm run dev

## Build
npm run build

## Deploy (Vercel)
Framework: Vite • Build: npm run build • Output: dist
Add `vercel.json` with SPA rewrites:
{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
