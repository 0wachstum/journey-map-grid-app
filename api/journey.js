// /api/journey.js
// Proxies a public SharePoint/OneDrive CSV to bypass CORS.
// Set Vercel env var CSV_URL to your SharePoint sharing link (the normal one with ?e=...).

export default async function handler(req, res) {
  try {
    const base = process.env.CSV_URL;
    if (!base) {
      res.status(500).json({ error: 'Missing CSV_URL env var' });
      return;
    }

    // Ensure ?download=1 and add a cache-buster so we always get fresh content
    let url = base;
    if (!/(\?|&)download=1\b/.test(url)) {
      url += (url.includes('?') ? '&' : '?') + 'download=1';
    }
    url += (url.includes('?') ? '&' : '?') + `t=${Date.now()}`;

    const upstream = await fetch(url, { headers: { Accept: 'text/csv,*/*' } });

    const body = await upstream.text();
    if (!upstream.ok) {
      res.status(upstream.status).send(body);
      return;
    }

    // Send CSV back to the browser with permissive CORS and no caching
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(body);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
