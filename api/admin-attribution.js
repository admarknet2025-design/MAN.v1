/* GET /admin/attribution (rewritten to this function in vercel.json) — team-only view of the checkout-started log.
   HTTP Basic auth against ADMIN_USER / ADMIN_PASSWORD (set in Vercel; never committed). If either is missing the page
   refuses to load rather than opening up. ?format=csv (also /admin/attribution.csv) downloads the log. */
'use strict';

const crypto = require('crypto');
const store = require('./_store');

const CSV_COLUMNS = ['reference', 'ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'timestamp', 'page', 'device'];

function digest(s) { return crypto.createHash('sha256').update(String(s)).digest(); }
function same(a, b) { return crypto.timingSafeEqual(digest(a), digest(b)); }

function authorised(req) {
  const h = req.headers.authorization || '';
  if (h.slice(0, 6).toLowerCase() !== 'basic ') return false;
  const raw = Buffer.from(h.slice(6), 'base64').toString('utf8');
  const i = raw.indexOf(':');
  if (i < 0) return false;
  /* evaluate both so timing does not reveal which one was wrong */
  const u = same(raw.slice(0, i), process.env.ADMIN_USER);
  const p = same(raw.slice(i + 1), process.env.ADMIN_PASSWORD);
  return u && p;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/* CSV cell; a leading = + - @ would run as a formula in Excel/Sheets, so prefix it */
function cell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function row(r) {
  return [r.reference, r.ref, r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content, r.utm_term, r.ts, r.path, r.ua];
}

function page(counts, rows) {
  const byRef = counts.byRef.map((c) => '<tr><td>' + esc(c.ref) + '</td><td class="n">' + c.n + '</td></tr>').join('')
    || '<tr><td colspan="2" class="empty">Nothing logged yet.</td></tr>';
  const recent = rows.map((r) => '<tr><td>' + esc(r.ts) + '</td><td><code>' + esc(r.reference) + '</code></td><td>' + esc(r.ref || '(none)') +
    '</td><td>' + esc([r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(' / ')) + '</td><td>' + esc(r.path) +
    '</td><td>' + esc(r.ua) + '</td></tr>').join('') || '<tr><td colspan="6" class="empty">Nothing logged yet.</td></tr>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow"><title>Checkout attribution — DMC 2026</title><style>' +
    ':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#1C1C1C;color:#F4EFE6;font:15px/1.55 Archivo,system-ui,sans-serif;padding:28px 20px 64px}' +
    'main{max-width:1000px;margin:0 auto}h1{font-size:28px;margin:0 0 6px}h2{font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#F4EFE6;margin:34px 0 10px}' +
    'p{color:rgba(244,239,230,.78);margin:0 0 12px;max-width:68ch}table{width:100%;border-collapse:collapse;font-size:14px}' +
    'th,td{text-align:left;padding:9px 10px;border-bottom:1px solid rgba(244,239,230,.16);vertical-align:top}th{color:rgba(244,239,230,.78);font-weight:700;font-size:12px;letter-spacing:.1em;text-transform:uppercase}' +
    'td.n{text-align:right;font-variant-numeric:tabular-nums}.empty{color:rgba(244,239,230,.62)}code{font:13px ui-monospace,Menlo,monospace;word-break:break-all}' +
    '.wrap{overflow-x:auto}.btn{display:inline-block;background:#2A7B74;color:#fff;text-decoration:none;font-weight:800;letter-spacing:.06em;text-transform:uppercase;font-size:13px;padding:13px 20px;border-radius:3px;margin-top:8px}' +
    '.btn:focus-visible{outline:2px solid #F4EFE6;outline-offset:2px}.note{border-left:3px solid #D95F45;padding:6px 0 6px 14px}' +
    '</style></head><body><main><h1>Checkout attribution</h1>' +
    '<p class="note"><b>Checkout started, not paid.</b> Each row is an order that MojoTickets created from a mangh.org checkout. Match the reference against MojoPay’s paid-orders export to find real sales.</p>' +
    '<p>' + counts.total + ' checkout' + (counts.total === 1 ? '' : 's') + ' started.</p>' +
    '<a class="btn" href="/admin/attribution.csv">Download CSV</a>' +
    '<h2>Checkouts started, by ref</h2><div class="wrap"><table><thead><tr><th>Ref</th><th class="n">Started</th></tr></thead><tbody>' + byRef + '</tbody></table></div>' +
    '<h2>Most recent (' + rows.length + ')</h2><div class="wrap"><table><thead><tr><th>Time (UTC)</th><th>Order reference</th><th>Ref</th><th>UTM</th><th>Page</th><th>Device</th></tr></thead><tbody>' + recent + '</tbody></table></div>' +
    '</main></body></html>';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD) {
    return res.status(503).send('Admin login is not configured. Set ADMIN_USER and ADMIN_PASSWORD in Vercel.');
  }
  if (!authorised(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="DMC 2026 attribution", charset="UTF-8"');
    return res.status(401).send('Sign in required.');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).send('GET only'); }
  if (!store.configured()) return res.status(503).send('The attribution store is not configured (KV_REST_API_URL / KV_REST_API_TOKEN).');

  try {
    const csv = req.query && req.query.format === 'csv';
    if (csv) {
      const rows = await store.recent(10000);
      const body = [CSV_COLUMNS.join(',')].concat(rows.map((r) => row(r).map(cell).join(','))).join('\r\n') + '\r\n';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="dmc2026-checkout-started.csv"');
      return res.status(200).send(body);
    }
    const [counts, rows] = await Promise.all([store.counts(), store.recent(200)]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(page(counts, rows));
  } catch (e) {
    console.error('attribution admin error', e && e.message);
    return res.status(502).send('The attribution store is unavailable.');
  }
};
