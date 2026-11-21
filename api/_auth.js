/* Team logins (HTTP Basic auth; values set in Vercel, never committed):
     admin login   ADMIN_USER / ADMIN_PASSWORD    every protected route (/admin/attribution, /live/control, /studio, ...)
     studio login  STUDIO_USER / STUDIO_PASSWORD  DMC Studio routes ONLY (/studio, /api/studio-render, -links, -library)
   The default is admin login only: a route accepts the studio login only when it passes { allowStudio: true }.
   Fail closed: a login whose user or password is unset or empty never matches. If no login is configured for a route,
   it answers 503. */
'use strict';

const crypto = require('crypto');

function digest(s) { return crypto.createHash('sha256').update(String(s)).digest(); }
function same(a, b) { return crypto.timingSafeEqual(digest(a), digest(b)); }

/* the logins a route accepts, leaving out any whose user or password is unset or empty */
function logins(opts) {
  const list = [[process.env.ADMIN_USER, process.env.ADMIN_PASSWORD]];
  if (opts && opts.allowStudio === true) list.push([process.env.STUDIO_USER, process.env.STUDIO_PASSWORD]);
  return list.filter(([u, p]) => Boolean(u) && Boolean(p));
}

function authorised(req, opts) {
  const h = req.headers.authorization || '';
  if (h.slice(0, 6).toLowerCase() !== 'basic ') return false;
  const raw = Buffer.from(h.slice(6), 'base64').toString('utf8');
  const i = raw.indexOf(':');
  if (i < 0) return false;
  const user = raw.slice(0, i), pass = raw.slice(i + 1);
  if (!user || !pass) return false;
  let ok = false;
  for (const [u, p] of logins(opts)) {
    /* evaluate both, and every login, so timing does not reveal which part was wrong */
    const a = same(user, u);
    const b = same(pass, p);
    if (a && b) ok = true;
  }
  return ok;
}

/* true when the request may continue; otherwise the response has been sent.
   opts.allowStudio: also accept the studio login (DMC Studio routes only). */
function requireAuth(req, res, realm, opts) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!logins(opts).length) {
    res.status(503).send('Team login is not configured. Set ADMIN_USER and ADMIN_PASSWORD in Vercel.');
    return false;
  }
  if (!authorised(req, opts)) {
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
