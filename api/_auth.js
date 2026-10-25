/* Shared team login for /admin/attribution and /studio (and the Studio's API routes): HTTP Basic auth against the
   ADMIN_USER / ADMIN_PASSWORD environment variables (set in Vercel; never committed). If either is missing, nothing
   opens up: the route answers 503. */
'use strict';

const crypto = require('crypto');

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

/* true when the request may continue; otherwise the response has been sent */
function requireAuth(req, res, realm) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD) {
    res.status(503).send('Team login is not configured. Set ADMIN_USER and ADMIN_PASSWORD in Vercel.');
    return false;
  }
  if (!authorised(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="' + (realm || 'DMC 2026 team') + '", charset="UTF-8"');
    res.status(401).send('Sign in required.');
    return false;
  }
  return true;
}

/* the public origin to put in short links: production hosts collapse to https://mangh.org, a preview keeps its own host */
function origin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'mangh.org').split(',')[0].trim().toLowerCase();
  if (host === 'mangh.org' || host === 'www.mangh.org') return 'https://mangh.org';
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return (local ? 'http://' : 'https://') + host;
}

module.exports = { authorised, requireAuth, origin };
