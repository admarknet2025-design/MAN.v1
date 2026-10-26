/* GET /live, /live/screen, /live/control (rewritten to this function in vercel.json) — the three DMC Live pages.
     /live          attendee phone view: public, no login, noindex
     /live/screen   projector view: public (the operator opens it on the venue laptop), unlinked, noindex
     /live/control  operator panel: team login (ADMIN_USER / ADMIN_PASSWORD), never cached
   The pages are static HTML in lib/live/; they read their data from /api/live-state and /api/live-submit. */
'use strict';

const fs = require('fs');
const path = require('path');
const { requireAuth } = require('./_auth');

const FILES = { phone: 'phone.html', screen: 'screen.html', control: 'control.html' };
const CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

module.exports = function handler(req, res) {
  const which = FILES[req.query && req.query.p] ? req.query.p : 'phone';
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).send('GET only'); }
  if (which === 'control') { if (!requireAuth(req, res, 'DMC Live control')) return; }
  else {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    /* the page itself is the same for everyone: let the edge absorb 250 phones opening it at once */
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  }
  const html = fs.readFileSync(path.join(__dirname, '..', 'lib', 'live', FILES[which]), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', CSP);
  return res.status(200).send(html);
};
