#!/usr/bin/env node
/* Checks the speaker profile pages (tools/build-speaker-pages.js) are complete and in step with the site:
 *   node tools/speaker-pages-check.js
 * Every person in lib/studio/data.json with a `page` has: speakers/<slug>.html with the right canonical, title and
 * og:image; a 1200x627 preview JPEG; a "Speaker profile" link on their /dmc-2026 card; a sitemap entry. No stray pages,
 * every link from a speaker page to another speaker page resolves, and a Speaker short link (/t/<code>) for them goes there. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/studio/data.json'), 'utf8'));
const dmc = fs.readFileSync(path.join(ROOT, 'dmc-2026.html'), 'utf8');
const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const sp = DATA.people.filter((p) => p.page);
ok(sp.length > 0, 'nobody has a speaker page');
const files = new Set(sp.map((p) => p.page.replace('/speakers/', '')));
for (const p of sp) {
  const f = p.page.replace('/speakers/', '');
  const hp = path.join(ROOT, 'speakers', f + '.html');
  ok(/^\/speakers\/[a-z0-9-]+$/.test(p.page), p.name + ': bad page path ' + p.page);
  ok(fs.existsSync(hp), p.name + ': no ' + hp);
  if (!fs.existsSync(hp)) continue;
  const h = fs.readFileSync(hp, 'utf8');
  ok(h.indexOf('<link rel="canonical" href="https://mangh.org' + p.page + '">') >= 0, p.name + ': canonical');
  ok(h.indexOf('<h1 itemprop="name">' + p.name.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '</h1>') >= 0, p.name + ': heading');
  const og = (h.match(/<meta property="og:image" content="https:\/\/mangh\.org(\/assets\/speakers\/og\/[^"?]+)\?v=[0-9a-f]{8}">/) || [])[1];
  ok(!!og && fs.existsSync(path.join(ROOT, og)), p.name + ': og:image missing');
  if (og) { const b = fs.readFileSync(path.join(ROOT, og)); ok(b[0] === 0xff && b[1] === 0xd8 && b.length < 400 * 1024, p.name + ': preview is not a JPEG under 400 KB'); }
  ok(/tickets\.mojo-pay\.com\/events\/digital-marketers-conference-2026/.test(h), p.name + ': no ticket link');
  ok(!/\/assets\/[^"?]+\.(css|js)"/.test(h), p.name + ': unstamped asset (run tools/stamp-assets.py)');
  for (const m of h.matchAll(/href="\/speakers\/([a-z0-9-]+)"/g)) ok(files.has(m[1]), p.name + ': links to missing /speakers/' + m[1]);
  for (const m of h.matchAll(/src="\/assets\/speakers\/([^"]+)"/g)) ok(fs.existsSync(path.join(ROOT, 'assets/speakers', m[1])), p.name + ': missing photo ' + m[1]);
  ok(dmc.indexOf('<a class="sp-page" href="' + p.page + '">') >= 0, p.name + ': no profile link on the /dmc-2026 card');
  ok(sm.indexOf('<loc>https://mangh.org' + p.page + '</loc>') >= 0, p.name + ': not in sitemap.xml');
}
for (const f of fs.readdirSync(path.join(ROOT, 'speakers'))) ok(files.has(f.replace(/\.html$/, '')), 'stray page speakers/' + f);
ok((dmc.match(/class="sp-page"/g) || []).length === sp.length, 'profile links on /dmc-2026 do not match the speaker list');

/* /t/<code> for a Speaker artwork goes to the speaker's page; other templates still go to /dmc-2026 */
const storeP = require.resolve(path.join(ROOT, 'api/_store'));
const links = { aaaa1: { slug: sp[0].slug, template: 'speaker', platform: 'instagram' }, aaaa2: { slug: 'deborah-yomle', template: 'speaker', platform: 'x' }, aaaa3: { slug: sp[0].slug, template: 'quote', platform: 'x' } };
require.cache[storeP] = { id: storeP, filename: storeP, loaded: true, exports: { configured: () => true, getLink: async (c) => links[c], logClick: async () => {} } };
const t = require(path.join(ROOT, 'api/t.js'));
(async () => {
  const want = { aaaa1: sp[0].page + '?', aaaa2: '/dmc-2026?', aaaa3: '/dmc-2026?' };
  for (const code of Object.keys(want)) {
    const hd = {}; let st;
    await t({ query: { code }, headers: { 'user-agent': 'facebookexternalhit' } }, { setHeader: (k, v) => { hd[k] = v; }, status: (s) => { st = s; return { end() {} }; } });
    ok(st === 302 && String(hd.Location).indexOf(want[code]) === 0, '/t/' + code + ' went to ' + hd.Location + ', want ' + want[code]);
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
