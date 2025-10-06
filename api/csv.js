// /api/csv.js  (Node.js Vercel Function)
export default async function handler(req, res) {
  try {
    const src = process.env.CSV_SOURCE_URL || req.query.u;
    if (!src) return res.status(400).send('Missing CSV source URL');

    const upstream = await fetch(src, { redirect: 'follow' });
    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).send(text || `Upstream error ${upstream.status}`);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    // Pass through content type if it looks like CSV, otherwise force CSV
    const ct = upstream.headers.get('content-type') || '';
    res.setHeader('Content-Type', ct.includes('csv') ? ct : 'text/csv; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*'); // safe because it’s just CSV
    // Cache at the edge but allow quick refresh
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    res.send(buf);
  } catch (e) {
    res.status(500).send(`Proxy error: ${e.message || e}`);
  }
}
