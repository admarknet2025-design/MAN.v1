/* GET /admin/attribution (rewritten to this function in vercel.json) — team-only view of the checkout-started log and of
   DMC Studio's tracked short links: clicks and checkouts started by person, platform and template, plus CSV exports.
   HTTP Basic auth against ADMIN_USER / ADMIN_PASSWORD (set in Vercel; never committed). If either is missing the page
   refuses to load rather than opening up. ?format=csv (also /admin/attribution.csv) downloads the log. */
'use strict';

const store = require('./_store');
const { requireAuth } = require('./_auth');

const CSV_COLUMNS = ['reference', 'ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'timestamp', 'page', 'device'];

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


/* Roll the combo counters up by person (ref), platform (utm_source) and template (utm_campaign). Clicks come from the
   tracked short links (/t/<code>); checkouts started come from the ticket modal's log. Both use the same three keys. */
function summarise(combos) {
  const key = (c) => [c.ref, c.source, c.campaign].join('|');
  const rows = new Map();
  combos.forEach((c) => {
    const k = key(c);
    const r = rows.get(k) || { ref: c.ref, platform: c.source, template: c.campaign, clicks: 0, checkouts: 0 };
    if (c.kind === 'cl') r.clicks += c.n; else if (c.kind === 'ck') r.checkouts += c.n;
    rows.set(k, r);
  });
  const all = [...rows.values()].sort((a, b) => (b.clicks + b.checkouts) - (a.clicks + a.checkouts) || a.ref.localeCompare(b.ref));
  const by = (f) => {
    const m = new Map();
    all.forEach((r) => {
      const k = r[f];
      const o = m.get(k) || { name: k, clicks: 0, checkouts: 0 };
      o.clicks += r.clicks; o.checkouts += r.checkouts; m.set(k, o);
    });
    return [...m.values()].sort((a, b) => (b.clicks + b.checkouts) - (a.clicks + a.checkouts));
  };
  return {
    all, person: by('ref'), platform: by('platform'), template: by('template'),
    clicks: all.reduce((a, r) => a + r.clicks, 0), checkouts: all.reduce((a, r) => a + r.checkouts, 0),
  };
}
const dash = (v) => (v === '-' || !v ? '(none)' : v);
const rate = (c, k) => (c ? Math.round((k / c) * 1000) / 10 + '%' : '–');

function summaryTable(title, rows, first) {
  const body = rows.map((r) => '<tr><td>' + esc(dash(r.name)) + '</td><td class="n">' + r.clicks + '</td><td class="n">' + r.checkouts + '</td><td class="n">' + rate(r.clicks, r.checkouts) + '</td></tr>').join('')
    || '<tr><td colspan="4" class="empty">Nothing logged yet.</td></tr>';
  return '<h2>' + title + '</h2><div class="wrap"><table><thead><tr><th>' + first + '</th><th class="n">Clicks</th><th class="n">Checkouts started</th><th class="n">Started per click</th></tr></thead><tbody>' + body + '</tbody></table></div>';
}

function summaryCsv(sum) {
  const head = ['person', 'platform', 'template', 'clicks', 'checkouts_started'];
  return [head.join(',')].concat(sum.all.map((r) => [r.ref, r.platform, r.template, r.clicks, r.checkouts].map(cell).join(','))).join('\r\n') + '\r\n';
}

function page(counts, rows, sum, clicks) {
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
    '<a class="btn" href="/admin/attribution.csv">Download checkouts CSV</a> <a class="btn" href="/admin/attribution-summary.csv">Download summary CSV</a>' +
    '<h2>Studio links: totals</h2><p>' + sum.clicks + ' click' + (sum.clicks === 1 ? '' : 's') + ' on tracked short links; ' + sum.checkouts + ' checkout' + (sum.checkouts === 1 ? '' : 's') + ' started with a ref. “Started per click” compares the two for the same person, platform and template; it is a guide, not a sales rate, because a visitor can start a checkout without the link they first clicked.</p>' +
    summaryTable('By person', sum.person, 'Person (ref)') + summaryTable('By platform', sum.platform, 'Platform (utm_source)') + summaryTable('By template', sum.template, 'Template (utm_campaign)') +
    '<h2>Person, platform and template</h2><div class="wrap"><table><thead><tr><th>Person</th><th>Platform</th><th>Template</th><th class="n">Clicks</th><th class="n">Checkouts started</th></tr></thead><tbody>' +
    (sum.all.map((r) => '<tr><td>' + esc(dash(r.ref)) + '</td><td>' + esc(dash(r.platform)) + '</td><td>' + esc(dash(r.template)) + '</td><td class="n">' + r.clicks + '</td><td class="n">' + r.checkouts + '</td></tr>').join('') || '<tr><td colspan="5" class="empty">Nothing logged yet.</td></tr>') + '</tbody></table></div>' +
    '<h2>Most recent clicks (' + clicks.length + ')</h2><div class="wrap"><table><thead><tr><th>Time (UTC)</th><th>Code</th><th>Person</th><th>Platform</th><th>Template</th><th>Device</th></tr></thead><tbody>' +
    (clicks.map((c) => '<tr><td>' + esc(c.ts) + '</td><td><code>' + esc(c.code) + '</code></td><td>' + esc(c.slug) + '</td><td>' + esc(c.platform) + '</td><td>' + esc(c.template) + '</td><td>' + esc(c.ua) + '</td></tr>').join('') || '<tr><td colspan="6" class="empty">No clicks yet.</td></tr>') + '</tbody></table></div>' +
    '<h2>Checkouts started, by ref</h2><div class="wrap"><table><thead><tr><th>Ref</th><th class="n">Started</th></tr></thead><tbody>' + byRef + '</tbody></table></div>' +
    '<h2>Most recent (' + rows.length + ')</h2><div class="wrap"><table><thead><tr><th>Time (UTC)</th><th>Order reference</th><th>Ref</th><th>UTM</th><th>Page</th><th>Device</th></tr></thead><tbody>' + recent + '</tbody></table></div>' +
    '</main></body></html>';
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res, 'DMC 2026 attribution')) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).send('GET only'); }
  if (!store.configured()) return res.status(503).send('The attribution store is not configured (KV_REST_API_URL / KV_REST_API_TOKEN).');

  try {
    const q = req.query || {};
    if (q.format === 'csv' && q.view === 'summary') {
      const body = summaryCsv(summarise(await store.combos()));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="dmc2026-studio-summary.csv"');
      return res.status(200).send(body);
    }
    if (q.format === 'csv') {
      const rows = await store.recent(10000);
      const body = [CSV_COLUMNS.join(',')].concat(rows.map((r) => row(r).map(cell).join(','))).join('\r\n') + '\r\n';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="dmc2026-checkout-started.csv"');
      return res.status(200).send(body);
    }
    const [counts, rows, combos, clicks] = await Promise.all([store.counts(), store.recent(200), store.combos(), store.recentClicks(200)]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(page(counts, rows, summarise(combos), clicks));
  } catch (e) {
    console.error('attribution admin error', e && e.message);
    return res.status(502).send('The attribution store is unavailable.');
  }
};
