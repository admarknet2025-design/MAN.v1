#!/usr/bin/env node
/* Checks the contracted sponsor credit (Powered by MojoPay, and the line "Tickets exclusively on MojoLife") on every DMC 2026 generated asset.
     node tools/sponsor-check.js [outdir] [--strict]
   Renders every DMC Studio template at every size, the Live quote cards (every layout, both sizes, each movement colour), the public flyer,
   the link-preview images and the projector page (every view it can be put in), and fails if any of them is missing either lockup,
   draws the MojoPay tile under the contract minimum (assets/sponsor/config.js), draws the ticket line too small, draws any MojoLife logo, or draws a tile
   that does not look like the official one in the pixels (cream tile, the blue wordmark). Writes contact sheets to outdir (default ./sponsor-out).
   MojoLife is named in words only: no MojoLife logo is drawn anywhere (team decision).
   Needs Playwright with Chromium for the flyer, the Live cards and the projector page. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..');
const SP = require(path.join(ROOT, 'assets/sponsor/lockup.js'));
const { renderMeta, SIZES, TEMPLATES } = require(path.join(ROOT, 'lib/studio/render'));
const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) || 'sponsor-out');
fs.mkdirSync(OUT, { recursive: true });
GlobalFonts.registerFromPath(path.join(ROOT, 'lib/studio/fonts/Archivo-Bold.ttf'), 'SheetB');

let bad = 0, checked = 0;
const fail = (msg) => { bad++; console.log('FAIL ' + msg); };
const sheets = {};   /* sheet name -> [{ label, buf }] */
const addSheet = (name, label, buf) => { (sheets[name] = sheets[name] || []).push({ label, buf }); };

/* does a placement look right: the MojoPay tile is cream with the blue wordmark; the ticket line is real text on a flat ground */
function looksRight(img, p) {
  const c = createCanvas(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  if (p.kind === 'ticketline') {
    /* real text in the ticket colour: a few percent of the rectangle is cream-bright or obsidian-dark text pixels against a flat ground */
    const d = x.getImageData(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(p.w)), Math.max(1, Math.round(p.h))).data;
    const bg = [d[0], d[1], d[2]]; let diff = 0, n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 200) diff++;
    return diff / n > 0.04;
  }
  const t = p.tile, X0 = Math.round(t.x), Y0 = Math.round(t.y), Wd = Math.round(t.w), Ht = Math.round(t.h);
  const d = x.getImageData(X0, Y0, Wd, Ht).data;
  let cream = 0, blue = 0, n = Wd * Ht;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (Math.abs(r - 0xF4) < 10 && Math.abs(g - 0xEF) < 10 && Math.abs(b - 0xE6) < 10) cream++;
    else if (b > 140 && r < 80 && g < 80) blue++;
  }
  return cream / n > 0.5 && blue / n > 0.04;
}
async function verify(name, pngBuf, placements, w, h, tall) {
  checked++;
  const img = await loadImage(pngBuf);
  if (img.width !== w || img.height !== h) fail(name + ': image is ' + img.width + 'x' + img.height + ', expected ' + w + 'x' + h);
  SP.check(placements, w, h, tall).forEach((m) => fail(name + ': ' + m));
  for (const p of placements) if (!looksRight(img, p)) fail(name + ': the ' + p.kind + ' does not look right in the pixels');
  return img;
}

(async () => {
  
  /* 1. DMC Studio: every template x every size */
  const jobs = {
    speaker: { name: 'Ama Mensah', title: 'Head of Growth', company: 'Acme', role: 'Speaker', session: 'Build Yourself: Presentation', time: '10:35–10:45', movement: 'Build Yourself' },
    attending: { name: 'Test Person', title: 'Title', company: 'Company', building: 'something' },
    sponsor: { name: 'Test Partner', tier: 'Silver Sponsor', role: 'Role' },
    quote: { quote: 'A quote that says something useful about building.', name: 'Test Person', title: 'Title', company: 'Company', movement: 'Build Your Work' },
    countdown: {},
    earlybird: { price: 'GH₵100', priceAfter: 'GH₵150', deadline: '2026-10-31' },
    session: { title: 'Session title', time: '10:45–11:15', movement: 'Build Your Team', speakers: 'Nobody Known · Another Person' }
  };
  const missing = TEMPLATES.filter((t) => !jobs[t]);
  if (missing.length) fail('Studio has templates this check does not know: ' + missing.join(', ') + ' (add them to tools/sponsor-check.js)');
  for (const t of TEMPLATES) {
    for (const size of Object.keys(SIZES)) {
      const m = await renderMeta({ template: t, size, fields: jobs[t] || {}, qrUrl: size === 'story' ? 'https://mangh.org/t/abcdefg' : '' });
      await verify('studio ' + t + ' ' + size, m.png, m.placements, m.w, m.h, m.tall);
      addSheet('studio-' + size, t, m.png);
    }
  }
  console.log('studio: ' + TEMPLATES.length + ' templates x ' + Object.keys(SIZES).length + ' sizes checked');

  /* 2. link-preview images */
  const og = require('./og-dmc.js');
  for (const out of ['og-dmc-2026.png', 'og-home-dmc-2026.png']) {
    const r = await og.make(out, {}, OUT);
    const buf = fs.readFileSync(path.join(OUT, out));
    await verify('og ' + out, buf, r.placements, og.W, og.H, false);
    addSheet('other', 'og ' + out, buf);
  }
  for (const [page, file] of [['dmc-2026.html', 'og-dmc-2026.png'], ['index.html', 'og-home-dmc-2026.png'], ['press.html', 'og-dmc-2026.png']]) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    if (!html.includes('content="https://mangh.org/assets/' + file + '"')) fail(page + ' does not point its og:image at ' + file);
  }
  /* the shared image stays out of this: pages that are not DMC 2026 keep it */
  console.log('link previews: 2 images, 3 pages checked');

  /* 2b. email footer: every email goes through renderEmail(), which cannot leave out the logos or the line "Tickets exclusively on MojoLife" */
  const EM = require(path.join(ROOT, 'assets/sponsor/email.js'));
  const sample = EM.renderEmail({ html: '<!doctype html><html><body style="margin:0;background:#fff"><table width="600" align="center" style="font:16px Arial"><tr><td style="padding:28px"><h1>See you at DMC 2026</h1><p>Your registration is confirmed.</p></td></tr></table></body></html>', text: 'See you at DMC 2026.\nYour registration is confirmed.' });
  checked++;
  EM.assertFooter(sample.html, sample.text).forEach((m) => fail('email: ' + m));
  /* a message with no body of its own still gets the footer */
  const bare = EM.renderEmail({});
  EM.assertFooter(bare.html, bare.text).forEach((m) => fail('email (empty message): ' + m));
  fs.writeFileSync(path.join(OUT, 'sample-email.html'), sample.html.replace(/src="https:\/\/mangh\.org/g, 'src="..'));
  console.log('email footer checked');

  /* 3 to 5 need a browser */
  let chromium = null;
  try { chromium = require('playwright').chromium; } catch (e) { fail('Playwright is not installed, so the flyer, the Live cards and the projector page were NOT checked (npm i --no-save playwright)'); }
  if (chromium) {
    const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; return res.end(); }
      res.setHeader('content-type', MIME[path.extname(p)] || 'application/octet-stream'); res.end(fs.readFileSync(p));
    });
    await new Promise((r) => srv.listen(0, r));
    const BASE = 'http://localhost:' + srv.address().port;
    const b = await chromium.launch();

    /* 2c. the sample email as a mail client draws it (the logo path is served from this checkout) */
    {
      const pg = await b.newPage({ viewport: { width: 700, height: 600 } });
      await pg.setContent(sample.html.replace(/src="https:\/\/mangh\.org/g, 'src="' + BASE));
      await pg.waitForTimeout(400);
      const ok = await pg.evaluate(() => [...document.querySelectorAll('img')].every((i) => i.complete && i.naturalWidth > 0));
      if (!ok) fail('email: a logo image did not load');
      addSheet('other', 'email footer', await pg.screenshot({ fullPage: true }));
      await pg.close();
    }

    /* 3. the public flyer */
    {
      const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
      await pg.route(/cdnjs|googletagmanager|google-analytics/, (r) => r.abort());
      await pg.goto(BASE + '/dmc-2026.html', { waitUntil: 'load' });
      await pg.waitForFunction(() => window.DMC_SPONSOR_PLACEMENTS, null, { timeout: 15000 }).catch(() => {});
      const r = await pg.evaluate(() => ({ pl: window.DMC_SPONSOR_PLACEMENTS || [], png: document.getElementById('dmc26-flyer').toDataURL('image/png') }));
      const buf = Buffer.from(r.png.split(',')[1], 'base64');
      await verify('flyer', buf, r.pl, 1080, 1440, false);
      addSheet('other', 'flyer', buf);
      const txt = await pg.evaluate(() => document.getElementById('fl-caption').value);
      if (!/Tickets exclusively on MojoLife/.test(txt)) fail('flyer caption does not say Tickets exclusively on MojoLife');
      await pg.close();
      console.log('flyer checked');
    }

    /* 4. Live quote cards */
    {
      const pg = await b.newPage();
      await pg.setContent('<!doctype html><meta charset="utf-8"><body><canvas id="c"></canvas>');
      await pg.addScriptTag({ path: path.join(ROOT, 'assets', 'live-cards.js') });
      const res = await pg.evaluate(async () => {
        const D = window.DMCCards; await D.loadFonts();
        const c = document.getElementById('c'), out = [];
        const moves = [['#2A7B74', '#FFFFFF'], ['#D95F45', '#1C1C1C'], ['#F4EFE6', '#1C1C1C']];
        for (const type of ['official', 'takeaway']) for (const size of ['4x5', '9x16']) for (const layout of ['bold', 'portrait', 'night']) for (const m of moves) {
          const spec = { type, size, layout, accent: m[0], ink: m[1], text: 'Ship it every week.', name: 'Ama', session: { movement: 'Build Yourself', title: 'Panel', speakers: [{ name: 'Alex Offei Lartey' }] }, speaker: { name: 'Alex Offei Lartey', title: 'Founder', handle: '' }, qr: 'https://mangh.org/t/abc123' };
          const o = D.render(c, spec);
          out.push({ id: type + '-' + layout + '-' + size + '-' + m[0], w: c.width, h: c.height, pl: o.placements, png: c.toDataURL('image/png') });
        }
        return out;
      });
      for (const x of res) {
        const buf = Buffer.from(x.png.split(',')[1], 'base64');
        await verify('live card ' + x.id, buf, x.pl, x.w, x.h, x.h > 1500);
      }
      res.filter((x) => /-teal|2A7B74/.test(x.id) || /F4EFE6|D95F45/.test(x.id)).filter((_, i) => i % 3 === 0).forEach((x) => addSheet('live-cards', x.id, Buffer.from(x.png.split(',')[1], 'base64')));
      await pg.close();
      console.log('live cards: ' + res.length + ' checked');
    }

    /* 5. the projector page: the lockups sit outside the changing view, so they are on every view; check a range of states at two sizes */
    {
      const states = {
        holding: { mode: 'holding', session: { accent: '#2A7B74' } },
        wall: { mode: 'wall', session: { accent: '#D95F45' }, wall: [{ name: 'Ama', line: 'A payments product for market traders' }, { name: 'Kofi', line: 'A newsletter on growth' }] },
        takeaways: { mode: 'takeaways', session: { accent: '#2A7B74' }, takeaways: [{ text: 'Ship it.', name: 'Ama' }] },
        quote: { mode: 'quote', session: { accent: '#F4EFE6' }, quote: { text: 'We hired for curiosity first.', speaker: { name: 'Alex Offei Lartey', title: 'Founder' } } },
        poll: { mode: 'poll', session: { accent: '#2A7B74' }, poll: { id: 'p1', question: 'Where do you sell?', options: ['Online', 'In person', 'Both'], counts: [3, 5, 9], total: 17, open: false } }
      };
      for (const vp of [[1920, 1080], [1280, 720]]) {
        for (const [name, st] of Object.entries(states)) {
          const pg = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
          await pg.route('**/api/live-state*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.assign({ rehearsal: false, ver: 1 }, st)) }));
          await pg.route(/googletagmanager|google-analytics/, (r) => r.abort());
          await pg.goto(BASE + '/lib/live/screen.html', { waitUntil: 'load' });
          await pg.waitForTimeout(900);
          const m = await pg.evaluate(() => {
            const st = document.getElementById('stage').getBoundingClientRect(), v = document.getElementById('view').getBoundingClientRect();
            return {
              stageW: st.width, viewBottom: v.bottom, stageRight: st.right, stageBottom: st.bottom, stageLeft: st.left,
              ticket: (function () { const e = document.querySelector('#sponsor .dmc-ticketline'); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.textContent, x: r.x, y: r.y, w: r.width, h: r.height, fontPx: parseFloat(getComputedStyle(e).fontSize) * 1, color: getComputedStyle(e).color }; })(), logos: document.querySelectorAll('#sponsor img').length,
              lockups: [...document.querySelectorAll('#sponsor .dmc-lockup')].map((l) => { const t = l.children[1].getBoundingClientRect(), s = getComputedStyle(l.children[1]); return { kind: l.dataset.kind, x: t.x, y: t.y, w: t.width, h: t.height, bg: s.backgroundColor, placeholder: !!l.querySelector('[data-placeholder]'), blue: !!l.querySelector('img') }; }),
              gold: /201,\s*162,\s*74/.test(document.getElementById('stage').outerHTML) || [...document.querySelectorAll('#stage *')].some((e) => { const c = getComputedStyle(e); return /rgb\(201, 162, 74\)/.test(c.backgroundColor + c.color + c.borderTopColor + c.backgroundImage); })
            };
          });
          const tag = 'screen ' + name + ' ' + vp.join('x');
          checked++;
          const pay = m.lockups.find((l) => l.kind === 'mojopay'), tk = m.ticket;
          if (!pay) fail(tag + ': the MojoPay lockup is missing');
          if (!tk || tk.text !== SP.config.TICKET_EXCLUSIVE) fail(tag + ': the ticket line is missing');
          if (m.logos !== 1) fail(tag + ': expected exactly one logo (MojoPay) in the corner, found ' + m.logos);
          if (pay && tk) {
            const need = SP.minTileW(m.stageW, false);
            if (pay.w + 1 < need) fail(tag + ': MojoPay tile ' + Math.round(pay.w) + 'px is under the minimum ' + need + 'px');
            const scale = m.stageW / 1920, minPx = Math.max(12, m.stageW * SP.config.MIN_TICKET_TEXT_PCT / 100);
            if (tk.fontPx + 0.25 < minPx) fail(tag + ': ticket line text ' + tk.fontPx.toFixed(1) + 'px is under ' + minPx.toFixed(1) + 'px');
            if (pay.y < m.viewBottom - 1 || tk.y < m.viewBottom - 1) fail(tag + ': the credit overlaps the content area');
            if (tk.x + tk.w > m.stageRight + 1 || pay.y + pay.h > m.stageBottom + 1) fail(tag + ': the credit is outside the stage');
            if (tk.x < pay.x + pay.w) fail(tag + ': the ticket line overlaps the MojoPay lockup');
            if (!pay.blue) fail(tag + ': the MojoPay logo is not drawn');
          }
          if (m.gold) fail(tag + ': Akan Gold on the projector page (rule D-09)');
          if (vp[0] === 1920) { addSheet('other', 'screen ' + name, await pg.screenshot()); }
          await pg.close();
        }
      }
      console.log('projector page: ' + Object.keys(states).length + ' views x 2 sizes checked');
    }
    await b.close();
    srv.close();
  }

  /* contact sheets */
  for (const [name, items] of Object.entries(sheets)) {
    const cols = name.startsWith('studio') ? 4 : 4, cw = 330;
    const imgs = []; for (const it of items) imgs.push(await loadImage(it.buf));
    const ch = Math.max(...imgs.map((im) => Math.round(cw * im.height / im.width))) + 34;
    const rows = Math.ceil(imgs.length / cols);
    const c = createCanvas(cols * (cw + 16) + 16, rows * (ch + 16) + 16), x = c.getContext('2d');
    x.fillStyle = '#777'; x.fillRect(0, 0, c.width, c.height);
    imgs.forEach((im, i) => {
      const px = 16 + (i % cols) * (cw + 16), py = 16 + Math.floor(i / cols) * (ch + 16), hh = Math.round(cw * im.height / im.width);
      x.drawImage(im, px, py, cw, hh);
      x.fillStyle = '#fff'; x.font = '14px SheetB'; x.fillText(items[i].label, px, py + hh + 20);
    });
    fs.writeFileSync(path.join(OUT, 'contact-sheet-' + name + '.png'), c.toBuffer('image/png'));
  }

  console.log(checked + ' assets checked; contact sheets in ' + OUT);
  console.log(bad ? bad + ' problem(s)' : 'every asset carries the MojoPay lockup and the ticket line at or above the minimum size');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
