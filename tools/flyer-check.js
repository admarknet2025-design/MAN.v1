#!/usr/bin/env node
/* Checks the participant flyers (assets/flyer/flyer-render.js) and writes the renders to outdir (default ./flyer-out).
     node tools/flyer-check.js [outdir]
   Needs Playwright with Chromium and the dev dependency jsqr.

   Checks: exact export size for every template/size; no text box wider than its container (long names, empty state, session line);
   the QR decodes to https://mangh.org/dmc-2026?ref=flyer-qr; no fallback font (all pinned files load, and the headline widths match the spec);
   the 9:16 safe zones; the six- and seven-tile partner rows; an EXIF-rotated selfie comes out upright; the team tool is unlisted
   (not in the nav, footer or sitemap, noindex meta and header, not in robots.txt). */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'flyer-out'));
fs.mkdirSync(OUT, { recursive: true });
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const jsQR = require('jsqr');
const { chromium } = require('playwright');

let failures = 0, passes = 0;
const fail = (m) => { failures++; console.error('FAIL ' + m); };
const ok = (m) => { passes++; console.log('ok   ' + m); };
const EXPECT_QR = 'https://mangh.org/dmc-2026?ref=flyer-qr';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/blank') { res.setHeader('content-type', 'text/html'); return res.end('<!doctype html><meta charset="utf-8"><canvas id="c"></canvas>'); }
  const p = path.join(ROOT, u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', MIME[path.extname(p)] || 'application/octet-stream'); res.end(fs.readFileSync(p));
});

async function decodeQR(png) {
  const img = await loadImage(Buffer.from(png.split(',')[1], 'base64'));
  const c = createCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, img.width, img.height);
  const r = jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' });
  return r ? r.data : null;
}

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const BASE = 'http://localhost:' + srv.address().port;
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  await page.goto(BASE + '/blank');
  await page.addScriptTag({ url: '/assets/flyer/qrcode.js' });
  await page.addScriptTag({ url: '/assets/flyer/flyer-render.js' });
  await page.evaluate(() => DMCFlyer.load());

  /* a synthetic "photo", an upright portrait with a red bar on top and a blue bar on the left, stored sideways with EXIF orientation 6 */
  const exifFile = path.join(__dirname, 'fixtures', 'exif6.jpg');
  const states = {
    'default':       { template: 'badge', level: 'yourself', participantRole: 'attending', name: 'Ama Owusu', role: 'Brand Strategist' },
    'speaking-long': { template: 'badge', level: 'work', participantRole: 'speaking', name: 'Nana Kwame Asante-Boateng', role: 'Senior Digital Marketing Communications Manager', sessionLine: 'Panel · Build Your Work · 12:35' },
    'long-name':     { template: 'badge', level: 'team', participantRole: 'volunteering', name: 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', role: 'Role' },
    'empty':         { template: 'badge', level: 'yourself', participantRole: 'attending', name: '', role: '' },
    'abena':         { template: 'badge', level: 'yourself', participantRole: 'attending', name: 'Abena Mensah', role: 'Brand Strategist' }
  };

  /* 1. exact size, text containment, QR, safe zones, for every state x template x size */
  for (const [sname, st] of Object.entries(states)) {
    for (const template of ['badge', 'brief']) {
      for (const format of ['4:5', '9:16']) {
        const tag = `${sname} ${template} ${format}`;
        const r = await page.evaluate(({ st, template, format }) => {
          const c = document.getElementById('c'), ctx = c.getContext('2d');
          const out = DMCFlyer.renderFlyer(ctx, Object.assign({}, st, { template, format, gloss: 'standard' }), { debug: true });
          return { w: c.width, h: c.height, png: c.toDataURL('image/png'), log: out.log };
        }, { st, template, format });
        const H = format === '9:16' ? 1920 : 1350;
        if (r.w !== 1080 || r.h !== H) fail(`${tag}: exported ${r.w}x${r.h}, expected 1080x${H}`); else ok(`${tag}: ${r.w}x${r.h}`);
        const over = r.log.filter((l) => l.limit != null && l.w > l.limit + 0.5);
        if (over.length) fail(`${tag}: text wider than its container: ` + over.map((l) => `${l.id} ${l.w.toFixed(1)}>${l.limit}`).join(', '));
        const off = r.log.filter((l) => l.x < -0.5 || l.x + l.w > 1080.5);
        if (off.length) fail(`${tag}: text outside the canvas: ` + off.map((l) => l.id).join(', '));
        if (format === '9:16') {   /* PORT-SPEC §3: y < 250 is planes, strap and hardware only; y >= 1580 is hashtags and weave only */
          const bad = r.log.filter((l) => l.id !== 'hashtags' && (l.y < 250 || l.y + l.h > 1580));
          if (bad.length) fail(`${tag}: text in a 9:16 safe zone: ` + bad.map((l) => `${l.id}@${l.y}`).join(', '));
        }
        const qr = await decodeQR(r.png);
        if (qr !== EXPECT_QR) fail(`${tag}: QR decodes to ${JSON.stringify(qr)}`);
        fs.writeFileSync(path.join(OUT, `${sname}-${template}-${format.replace(':', 'x')}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
      }
    }
  }
  ok('QR decodes to ' + EXPECT_QR + ' in every render (when no fail above)');

  /* 2. fonts: every pinned file loaded, and the headline widths equal PORT-SPEC §0.1 (a fallback font would not match) */
  const fonts = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d'), M = (t, pin, size, w, tr) => DMCFlyer._internal.measureW(c, t, pin, size, w, tr);
    return { ok: DMCFlyer.assets.fontsOk, w: { BUILT76: M('BUILT', 'D', 76, 900, -0.02), TO76: M('TO', 'D', 76, 900, -0.02), SCALE76: M('SCALE', 'DI', 76, 900, -0.02), BUILT86: M('BUILT', 'D', 86, 900, -0.02), SCALE86: M('SCALE', 'DI', 86, 900, -0.02),
      BRIEF40: M('CREATIVE BRIEF', 'D', 40, 900, 0), DMC72: M('DMC 2026', 'D', 72, 900, -0.02), ABENA80: M('Abena Mensah', 'B', 80, 800, 0), MYTEAM100: M('MY TEAM', 'D', 100, 900, 0) } };
  });
  const SPEC = { BUILT76: 282.5, TO76: 137.9, SCALE76: 326.1, BUILT86: 319.7, SCALE86: 369.0, BRIEF40: 434.0, DMC72: 462.5, ABENA80: 593, MYTEAM100: 619.3 };
  for (const [f, v] of Object.entries(fonts.ok)) if (v !== true) fail('font did not load: ' + f);
  for (const [k, v] of Object.entries(fonts.w)) if (Math.abs(v - SPEC[k]) > 0.6) fail(`width ${k} = ${v.toFixed(1)}, spec ${SPEC[k]} (a fallback font?)`);
  ok('pinned fonts loaded; headline, name and level-word widths match the spec');

  /* 3. name fitting: "Abena Mensah" must fit at 73px (4:5 Badge, plate 544) and 65px (9:16 Badge, plate 488) */
  const fit = await page.evaluate(() => { const c = document.createElement('canvas').getContext('2d'); return [DMCFlyer._internal.fitName(c, 'Abena Mensah', 80, 544), DMCFlyer._internal.fitName(c, 'Abena Mensah', 80, 488)]; });
  if (fit[0].size !== 73 || fit[1].size !== 65) fail(`name fit: ${fit[0].size} / ${fit[1].size}, expected 73 / 65`); else ok('"Abena Mensah" fits at 73px (4:5) and 65px (9:16)');

  /* 4. fallback for browsers without ctx.letterSpacing: glyph-by-glyph drawing must give the same text widths */
  const ls = await page.evaluate(() => {
    const c = document.createElement('canvas'), x = c.getContext('2d'), a = DMCFlyer._internal.measureW(x, 'DMC 2026 · ACCRA', 'B', 30, 600, 0.16);
    DMCFlyer._noLetterSpacing(true); const b = DMCFlyer._internal.measureW(x, 'DMC 2026 · ACCRA', 'B', 30, 600, 0.16); DMCFlyer._noLetterSpacing(false); return [a, b];
  });
  if (Math.abs(ls[0] - ls[1]) > 0.6) fail(`tracked text width differs without ctx.letterSpacing: ${ls[0].toFixed(1)} vs ${ls[1].toFixed(1)}`); else ok('tracking fallback (no ctx.letterSpacing) matches: ' + ls[0].toFixed(1) + ' vs ' + ls[1].toFixed(1));
  const noLS = await page.evaluate(({}) => { DMCFlyer._noLetterSpacing(true); const c = document.getElementById('c'), o = DMCFlyer.renderFlyer(c.getContext('2d'), { template: 'badge', format: '4:5', level: 'work', name: 'Ama Owusu', role: 'Brand Strategist' }); DMCFlyer._noLetterSpacing(false); return c.toDataURL('image/png'); }, {});
  fs.writeFileSync(path.join(OUT, 'no-letterspacing-badge-4x5.png'), Buffer.from(noLS.split(',')[1], 'base64'));

  /* 5. partner rows: six and seven tiles */
  for (const n of [6, 7]) {
    const r = await page.evaluate((n) => {
      DMCFlyer.PARTNERS.forEach((p, i) => { p.enabled = i < n; });
      const c = document.getElementById('c'); DMCFlyer.renderFlyer(c.getContext('2d'), { template: 'badge', format: '4:5', level: 'yourself', name: 'Ama Owusu', role: 'Brand Strategist' });
      const out = c.toDataURL('image/png'); DMCFlyer.PARTNERS.forEach((p) => { p.enabled = true; }); return out;
    }, n);
    fs.writeFileSync(path.join(OUT, `partner-row-${n}.png`), Buffer.from(r.split(',')[1], 'base64'));
    const w = Math.floor((952 - (n - 1) * 12) / n);
    if (w !== (n === 6 ? 148 : 125)) fail(`tile width for ${n} partners is ${w}`); else ok(`${n}-tile row: tile width ${w}`);
  }

  /* 6. an EXIF-rotated selfie decodes upright and is limited to 2000px */
  if (fs.existsSync(exifFile)) {
    const bytes = fs.readFileSync(exifFile).toString('base64');
    const r = await page.evaluate(async (b64) => {
      const f = new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'x.jpg', { type: 'image/jpeg' });
      const bm = await DMCFlyer.decodePhoto(f), c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
      return { w: bm.width, h: bm.height, top: Array.from(x.getImageData(300, 30, 1, 1).data), left: Array.from(x.getImageData(30, 400, 1, 1).data) };
    }, bytes);
    const red = r.top[0] > 180 && r.top[1] < 90, blue = r.left[2] > 180 && r.left[0] < 90;
    if (r.w !== 600 || r.h !== 800 || !red || !blue) fail(`EXIF selfie not upright: ${r.w}x${r.h}, top ${r.top}, left ${r.left}`); else ok('EXIF-rotated selfie decodes upright (600x800, red bar on top, blue bar left)');
  } else fail('missing tools/fixtures/exif6.jpg');

  /* 7. the team tool is unlisted */
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const vj = JSON.parse(read('vercel.json'));
  const hdr = (vj.headers || []).find((h) => h.source === '/studio');
  if (!hdr || !hdr.headers.some((h) => h.key === 'X-Robots-Tag' && /noindex/.test(h.value))) fail('vercel.json: /studio has no X-Robots-Tag noindex header'); else ok('vercel.json sends X-Robots-Tag: noindex for /studio');
  if (!/<meta name="robots" content="noindex,nofollow">/.test(read('lib/studio/app.html'))) fail('studio page has no noindex meta'); else ok('studio page has <meta name="robots" content="noindex,nofollow">');
  if (/studio/i.test(read('robots.txt'))) fail('robots.txt lists /studio'); else ok('robots.txt does not list /studio');
  if (/\/studio/.test(read('sitemap.xml'))) fail('sitemap.xml lists /studio'); else ok('sitemap.xml does not list /studio');
  const linked = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).filter((f) => /href="\/studio/.test(read(f)));
  if (linked.length) fail('pages link to /studio: ' + linked.join(', ')); else ok('no page links to /studio (nav, footer or body)');
  if (!/X-Robots-Tag/.test(read('api/studio.js'))) fail('api/studio.js does not set X-Robots-Tag'); else ok('api/studio.js sets X-Robots-Tag');

  await b.close(); srv.close();
  console.log(`\n${passes} checks passed, ${failures} failed. Renders in ${OUT}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
