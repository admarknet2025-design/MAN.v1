#!/usr/bin/env node
/* The website's partner rows against the one partner list (assets/partners26/partners.json).
     node tools/partners-check.js
   The site pages are static HTML, so they cannot read the JSON at runtime; this check is how they "read" it: it fails if the home page
   or /partners leaves out a listed partner's logo, or shows a partners26 logo that is not on the list (or the MojoPay credit). The
   flyers and every DMC Studio image read the list directly (assets/flyer/flyer-render.js), and lib/studio/data.json is generated from
   it (tools/build-studio-data.js). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/partners26/partners.json'), 'utf8'));
const listed = new Set(PJ.partners.map((p) => p.logo));
const credit = new Set([PJ.poweredBy.logo, PJ.poweredBy.siteLogo, 'mojopay-white.webp']);
let bad = 0;
for (const page of ['index.html', 'partners.html']) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const shown = new Set([...html.matchAll(/\/assets\/partners26\/([a-z0-9.-]+\.(?:webp|png|svg))/g)].map((m) => m[1]));
  const missing = [...listed].filter((f) => !shown.has(f)), extra = [...shown].filter((f) => !listed.has(f) && !credit.has(f));
  if (missing.length) { bad++; console.log('FAIL ' + page + ' is missing ' + missing.join(', ')); }
  if (extra.length) { bad++; console.log('FAIL ' + page + ' shows logos not on the list: ' + extra.join(', ')); }
  if (!missing.length && !extra.length) console.log('ok   ' + page + ' shows all ' + listed.size + ' listed partners and nothing else');
}
if (PJ.partners.length !== 7 || !PJ.partners.some((p) => p.id === 'jobberman')) { bad++; console.log('FAIL the list should hold seven partners including Jobberman'); }
process.exit(bad ? 1 : 0);
