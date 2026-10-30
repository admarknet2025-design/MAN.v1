#!/usr/bin/env node
/* Makes DMC 2026 flyers for speakers and hosts, using the same drawing code as the public flyer maker.
 * The public site has no speaker option on purpose; these are produced here and sent to each person.
 *
 *   node tools/speaker-flyers.js [out-dir]        (default: speaker-flyers-out/)
 *
 * Needs Playwright with Chromium (npm i playwright). The QR code library loads from cdnjs, or set
 * QRCODE_JS=/path/to/qrcode.min.js to use a local copy. Each flyer's QR/caption link carries ?ref=spk-<slug>,
 * so Google Analytics shows how many visits each speaker's network brings.
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'speaker-flyers-out'));
const people = JSON.parse(fs.readFileSync(path.join(__dirname, 'speakers.json'), 'utf8')).people;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json' };

const KINDS = {
  speaker: { lines: ["I'M", 'SPEAKING'], tag: 'SPEAKER', verb: 'speaking at' },
  host:    { lines: ["I'M", 'HOSTING'],  tag: 'HOST',    verb: 'hosting' }
};

function caption(p) {
  const k = KINDS[p.kind];
  return `I’m ${k.verb} the Digital Marketers’ Conference 2026 — 21 Nov, British Council Accra. #DMC2026 #BuiltToScale. Tickets exclusively on MojoLife: mangh.org/dmc-2026?ref=spk-${p.slug}\n\nCome and say hello — and bring a colleague!\n— ${p.name}${p.role ? ', ' + p.role : ''}\n`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/dmc-2026.html'));
    const file = fs.existsSync(f) ? f : f + '.html';
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(0);
  const base = 'http://localhost:' + server.address().port;

  const browser = await chromium.launch();
  let made = 0;
  for (const p of people) {
    const photo = path.join(ROOT, 'assets', 'speakers', p.photo || '');
    if (!p.photo || !fs.existsSync(photo)) { console.log('skipped (no photo yet): ' + p.name); continue; }
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    const k = KINDS[p.kind] || KINDS.speaker;
    await page.addInitScript((spk) => { window.DMC_SPEAKER_FLYER = spk; localStorage.setItem('man_analytics', 'denied'); }, k);
    if (process.env.QRCODE_JS) await page.route('**/qrcode.min.js', (r) => r.fulfill({ path: process.env.QRCODE_JS, contentType: 'application/javascript' }));
    await page.goto(base + '/dmc-2026.html', { waitUntil: 'networkidle' });
    await page.setInputFiles('#fl-photo', photo);
    await page.fill('#fl-name', p.name);
    await page.evaluate(() => document.getElementById('fl-role').removeAttribute('maxlength')); /* the public form caps roles at 36 characters */
    await page.fill('#fl-role', p.role);
    await page.waitForTimeout(1200);
    /* never save a flyer without the sponsor credit (Powered by MojoPay, Tickets exclusively on MojoLife) */
    await page.waitForFunction(() => window.DMC_SPONSOR_PLACEMENTS && window.DMC_SPONSOR_PLACEMENTS.length === 2, null, { timeout: 15000 });
    const data = await page.evaluate(() => document.getElementById('dmc26-flyer').toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, `DMC2026-${p.kind === 'host' ? 'Host' : 'Speaker'}-${p.slug}.png`), Buffer.from(data.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, `DMC2026-${p.kind === 'host' ? 'Host' : 'Speaker'}-${p.slug}-caption.txt`), caption(p));
    console.log('made: ' + p.name);
    made++;
    await page.context().close();
  }
  await browser.close();
  server.close();
  console.log(`${made} flyer(s) in ${OUT}`);
})();
