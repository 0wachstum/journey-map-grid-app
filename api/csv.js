// /api/csv.js — OneDrive/SharePoint → CSV with .xlsx support (ESM)
import ExcelJS from 'exceljs';

export default async function handler(req, res) {
  try {
    const {
      ONEDRIVE_TENANT_ID,
      ONEDRIVE_CLIENT_ID,
      ONEDRIVE_CLIENT_SECRET,

      // A) Stable & recommended
      ONEDRIVE_DRIVE_ID,
      ONEDRIVE_ITEM_ID,

      // B) SharePoint site + path (if you prefer paths)
      ONEDRIVE_SITE_HOSTNAME,   // e.g. "contoso.sharepoint.com"
      ONEDRIVE_SITE_PATH,       // e.g. "/sites/Marketing"
      ONEDRIVE_FILE_PATH,       // e.g. "/Shared Documents/Data/JourneyCards.xlsx"

      XLSX_SHEET                // optional default sheet name
    } = process.env;

    // parse query
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sheetParam = url.searchParams.get('sheet');  // which worksheet to export
    const shareUrl   = url.searchParams.get('share');  // optional: public/tenant share link
    const pathParam  = url.searchParams.get('path');   // optional: override file path

    // 1) App-only token
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${ONEDRIVE_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: ONEDRIVE_CLIENT_ID,
          client_secret: ONEDRIVE_CLIENT_SECRET,
          grant_type: 'client_credentials',
          scope: 'https://graph.microsoft.com/.default'
        })
      }
    );
    const tok = await tokenRes.json();
    if (!tokenRes.ok) {
      res.status(500).send(`Token error: ${tok.error_description || tokenRes.status}`);
      return;
    }
    const AUTH = { Authorization: `Bearer ${tok.access_token}` };

    // 2) Build download URL
    let downloadUrl;
    if (shareUrl) {
      // Resolve any share link → driveId/itemId (great as a one-time helper)
      const encoded = 'u!' + Buffer.from(shareUrl).toString('base64url');
      const metaRes = await fetch(`https://graph.microsoft.com/v1.0/shares/${encoded}/driveItem`, { headers: AUTH });
      const meta = await metaRes.json();
      if (!metaRes.ok) return res.status(metaRes.status).send(`Share resolve failed: ${JSON.stringify(meta)}`);
      const driveId = meta.parentReference?.driveId;
      const itemId  = meta.id;
      if (!driveId || !itemId) return res.status(400).send('Could not resolve driveId/itemId from share URL.');
      downloadUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`;
    } else if (ONEDRIVE_DRIVE_ID && ONEDRIVE_ITEM_ID) {
      // Most robust
      downloadUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(ONEDRIVE_DRIVE_ID)}/items/${encodeURIComponent(ONEDRIVE_ITEM_ID)}/content`;
    } else {
      // Site + path
      const filePath = pathParam || ONEDRIVE_FILE_PATH;
      if (!ONEDRIVE_SITE_HOSTNAME || !ONEDRIVE_SITE_PATH || !filePath) {
        res.status(400).send('Missing config. Provide DRIVE_ID+ITEM_ID, or SITE_HOSTNAME+SITE_PATH+FILE_PATH, or ?share=');
        return;
      }
      downloadUrl =
        `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(ONEDRIVE_SITE_HOSTNAME)}:${ONEDRIVE_SITE_PATH}` +
        `:/drive/root:${filePath}:/content`;
    }

    // 3) Download file
    const fileRes = await fetch(downloadUrl, { headers: AUTH, redirect: 'follow' });
    if (!fileRes.ok) {
      const text = await fileRes.text();
      res.status(fileRes.status).send(`Graph fetch failed ${fileRes.status}: ${text}`);
      return;
    }
    const ab  = await fileRes.arrayBuffer();
    const buf = Buffer.from(ab);

    // Basic safety guards (since we parse server-side)
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    if (buf.length > MAX_BYTES) {
      res.status(413).send('File too large');
      return;
    }

    // 4) If already CSV → passthrough
    const ct = (fileRes.headers.get('content-type') || '').toLowerCase();
    const looksCsv  = ct.includes('text/csv') || /\.csv(\?|$)/i.test(downloadUrl);
    const looksXlsx = ct.includes('spreadsheetml') || (buf[0] === 0x50 && buf[1] === 0x4B); // 'PK'

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    if (looksCsv && !looksXlsx) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(buf);
      return;
    }

    // 5) XLSX → CSV
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet =
      (sheetParam && wb.getWorksheet(sheetParam)) ||
      wb.worksheets[0];
    if (!sheet) {
      res.status(400).send(`Sheet not found. Available: ${wb.worksheets.map(w => w.name).join(', ')}`);
      return;
    }

    // Build CSV (quote/escape values, keep rows aligned)
    const maxCols = sheet.actualColumnCount || 50;
    let out = '';
    sheet.eachRow((row) => {
      const cells = [];
      for (let c = 1; c <= maxCols; c++) {
        const cell = row.getCell(c);
        const raw  = (cell?.text ?? cell?.value ?? '') + '';
        const esc  = '"' + raw.replace(/"/g, '""') + '"';
        cells.push(esc);
      }
      // Trim trailing empties for cleaner CSV
      let i = cells.length - 1;
      while (i >= 0 && (cells[i] === '""')) i--;
      out += cells.slice(0, i + 1).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(out);
  } catch (e) {
    res.status(500).send(`Proxy error: ${e.message || e}`);
  }
}
