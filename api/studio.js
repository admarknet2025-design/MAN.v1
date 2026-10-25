/* GET /studio (rewritten to this function in vercel.json) — DMC Studio, behind the team login. Not linked from the site
   and marked noindex. The page's data (speakers, programme, partners) is inlined from lib/studio/data.json. */
'use strict';

const fs = require('fs');
const path = require('path');
const { requireAuth } = require('./_auth');

module.exports = function handler(req, res) {
  if (!requireAuth(req, res, 'DMC Studio')) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).send('GET only'); }
  const dir = path.join(__dirname, '..', 'lib', 'studio');
  const html = fs.readFileSync(path.join(dir, 'app.html'), 'utf8');
  const data = fs.readFileSync(path.join(dir, 'data.json'), 'utf8').replace(/</g, '\\u003c');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'");
  return res.status(200).send(html.replace('/*__STUDIO_DATA__*/null', data));
};
