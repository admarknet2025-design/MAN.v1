/* POST /api/attribution — logs one "checkout started" event from the ticket modal (assets/ticket-checkout.js).
   "Checkout started" means MojoTickets created an order; it does NOT mean the order was paid. Match the saved
   references against MojoPay's paid-orders export to find real sales. */
'use strict';

const store = require('./_store');

const PARAM = /^[A-Za-z0-9_.~%-]{0,80}$/;
const REFERENCE = /^[A-Za-z0-9._:-]{1,100}$/;
const UA = new Set(['mobile', 'desktop', 'in-app']);
const HOSTS = new Set(['mangh.org', 'www.mangh.org']);

function sameSite(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  let host;
  try { host = new URL(origin).hostname; } catch (e) { return false; }
  /* production hosts, or whatever host served this request (so each Vercel preview accepts only itself) */
  return HOSTS.has(host) || host === String(req.headers.host || '').split(':')[0];
}

function str(v, re, max) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string' || v.length > max || !re.test(v)) return null;
  return v;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  if (!sameSite(req)) return res.status(403).json({ error: 'forbidden' });

  const b = req.body && typeof req.body === 'object' ? req.body : null;
  if (!b || JSON.stringify(b).length > 2000) return res.status(400).json({ error: 'bad body' });

  const rec = {
    reference: str(b.reference, REFERENCE, 100),
    ref: str(b.ref, PARAM, 80),
    utm_source: str(b.utm_source, PARAM, 80),
    utm_medium: str(b.utm_medium, PARAM, 80),
    utm_campaign: str(b.utm_campaign, PARAM, 80),
    utm_content: str(b.utm_content, PARAM, 80),
    utm_term: str(b.utm_term, PARAM, 80),
    path: typeof b.path === 'string' && b.path.charAt(0) === '/' && b.path.length <= 200 && !/[\s<>"']/.test(b.path) ? b.path : null,
    ts: typeof b.ts === 'string' && !isNaN(Date.parse(b.ts)) && b.ts.length <= 40 ? new Date(b.ts).toISOString() : null,
    ua: UA.has(b.ua) ? b.ua : null,
  };
  if (!rec.reference || Object.keys(rec).some((k) => rec[k] === null)) return res.status(400).json({ error: 'invalid field' });
  rec.received = new Date().toISOString();
  rec.event = 'checkout_started';

  if (!store.configured()) return res.status(503).json({ error: 'attribution store is not configured' });
  try {
    const created = await store.add(rec);
    return res.status(created ? 201 : 200).json({ ok: true, duplicate: !created });
  } catch (e) {
    console.error('attribution store error', e && e.message);
    return res.status(502).json({ error: 'store unavailable' });
  }
};
