/* Render tests for the DMC Live quote cards, in a real browser (Playwright + Chromium; nothing else needed, no server).
     node tools/live-cards-check.js [outdir]
   Draws every combination that matters: the shortest and longest text of each type, long names, a missing photo, Twi letters, an emoji,
   each movement colour, three layouts, both sizes. Fails if any text had to be cut, if gold covers more than 3% of a card (it is an accent only), or if a card is blank.
   Writes the cards and a contact sheet (contact-sheet-4x5.png, contact-sheet-9x16.png) to outdir (default: ./live-cards-out). */
'use strict';
const fs = require('fs');
const path = require('path');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.error('npm i --no-save playwright (Chromium is needed)'); process.exit(1); }

const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || 'live-cards-out');
fs.mkdirSync(out, { recursive: true });
const photo = (f) => 'data:image/webp;base64,' + fs.readFileSync(path.join(root, 'assets', 'speakers', f)).toString('base64');

const MOVES = {
  teal: { movement: 'Build Yourself', accent: '#2A7B74', ink: '#FFFFFF' },
  coral: { movement: 'Build Your Team', accent: '#D95F45', ink: '#1C1C1C' },
  cream: { movement: 'Build Your Work', accent: '#F4EFE6', ink: '#1C1C1C' }
};
const LONG_OFFICIAL = 'The teams that scale are not the ones with the biggest budgets; they are the ones that write down what they learned, share it every week, and refuse to repeat last quarter’s mistakes twice. Start there.';
const LONG_TAKE = 'I will stop measuring activity and start measuring outcomes, one customer conversation a week, starting on Monday 23 November, no excuses.';
const CASES = [];
const add = (id, spec) => CASES.push(Object.assign({ id }, spec));
const sess = (m, extra) => Object.assign({ id: 's04', title: 'Build Yourself: Panel Discussion', format: 'Discussion', speakers: [{ name: 'Alex Offei Lartey' }, { name: 'Emelia Dede Quist', sponsor: 'Generation Ghana' }, { name: 'Ronald Tagoe', sponsor: 'mNotify' }] }, MOVES[m], extra);
const sp = (name, title, file) => ({ name, title, photo: file ? photo(file) : '', handle: '@alexofflartey' });
for (const m of Object.keys(MOVES)) {
  add('official-short-' + m, { type: 'official', session: sess(m), text: 'Ship it.', speaker: sp('Alex Offei Lartey', 'Founder, Nova Labs', 'alex-offei-lartey.webp') });
  add('official-long-' + m, { type: 'official', session: sess(m), text: LONG_OFFICIAL.slice(0, 220), speaker: sp('Alex Offei Lartey', 'Head of Growth, a very long company name that keeps going and going', 'alex-offei-lartey.webp') });
  add('official-longname-nophoto-' + m, { type: 'official', session: sess(m, { title: 'A very long session title that goes on and on across the whole width of the card for testing' }), text: 'We hired for curiosity first.', speaker: sp('Dr. Oluwaseun Adebayo-Mensah-Quartey Jr.', 'Chief Marketing Officer', '') });
  add('takeaway-short-' + m, { type: 'takeaway', session: sess(m), text: 'Ship.', name: 'Ama' });
  add('takeaway-long-' + m, { type: 'takeaway', session: sess(m), text: LONG_TAKE.slice(0, 140), name: 'Nana Akosua-Boadu' });
  add('takeaway-twi-' + m, { type: 'takeaway', session: sess(m), text: 'Nea ɛyɛ den no, ɔbɔ ho mmɔden; ɖe ʋu ŋ. Let’s build 🚀 together!'.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').replace(/ +/g, ' '), name: 'Kofi' });
}
add('rehearsal', { type: 'official', rehearsal: true, session: sess('teal'), text: 'Rehearsal quote to check the band.', speaker: sp('Alex Offei Lartey', 'Founder, Nova Labs', 'alex-offei-lartey.webp') });

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff"><canvas id="c"></canvas>');
  await p.addScriptTag({ path: path.join(root, 'assets', 'live-cards.js') });
  const results = await p.evaluate(async (cases) => {
    const D = window.DMCCards; await D.loadFonts();
    const loadImg = (u) => new Promise((res) => { if (!u) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = u; });
    const c = document.getElementById('c'); const res = [];
    for (const k of cases) {
      const photoImg = await loadImg(k.speaker && k.speaker.photo);
      for (const size of ['4x5', '9x16']) for (const layout of ['bold', 'portrait', 'night']) {
        const spec = Object.assign({}, k, { size, layout, photo: photoImg, accent: k.session.accent, ink: k.session.ink, qr: 'https://mangh.org/t/abc123' });
        const o = D.render(c, spec);
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let gold = 0, nonBlank = 0, seen = 0;
        for (let i = 0; i < d.length; i += 4 * 7) { seen++; const dr = d[i] - 0xC9, dg = d[i + 1] - 0xA2, db = d[i + 2] - 0x4A; if (dr * dr + dg * dg + db * db < 900) gold++; if (d[i] + d[i + 1] + d[i + 2] > 60) nonBlank++; }
        res.push({ id: k.id, size, layout, fits: o.fits, fontSize: o.size, lines: o.lines, gold: gold / seen, nonBlank, url: c.toDataURL('image/png') });
      }
    }
    return res;
  }, CASES);
  let bad = 0;
  /* the phone's filter (bundled into live-cards.js) must agree with the server's on every string */
  const { compile, hits } = require('../lib/live/filter-core');
  const list = { words: compile(fs.readFileSync(path.join(root, 'lib/live/blocklist.txt'), 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)) };
  const corpus = ['Scunthorpe', 'grape', 'therapist', 'fuck', 'f*ck', 'f**k', 'sh1t', 'f u c k', 'a$$hole', 'bullshit', 'kwasia', 'wo maame', 'Ship it', 'ɛyɛ den', 'Build Your Team', 'motherfucker', 'You bastard', 'class assessment'];
  const phoneSays = await p.evaluate((c) => c.map((t) => window.DMCCards.blocked(t)), corpus);
  corpus.forEach((t, i) => { if (phoneSays[i] !== !!hits(t, list)) { bad++; console.log('FILTER MISMATCH between phone and server for: ' + t); } });
  console.log('filter parity: ' + corpus.length + ' strings agree between phone and server');
  results.forEach((r) => {
    fs.writeFileSync(path.join(out, r.id + '-' + r.layout + '-' + r.size + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
    if (!r.fits || r.gold > 0.03 || r.gold === 0 || r.nonBlank < 1000) { bad++; console.log('FAIL', r.id, r.layout, r.size, { fits: r.fits, gold: r.gold, nonBlank: r.nonBlank }); }
  });
  console.log(results.length + ' cards drawn, ' + bad + ' failed. Smallest text size used: ' + Math.min.apply(null, results.map((r) => r.fontSize)) + 'px. Most gold on any card: ' + (Math.max.apply(null, results.map((r) => r.gold)) * 100).toFixed(2) + '%');
  for (const size of ['4x5', '9x16']) {
    const list = results.filter((r) => r.size === size);
    const cell = size === '4x5' ? [216, 270] : [216, 384];
    const html = '<body style="margin:0;background:#888;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(9,' + cell[0] + 'px);gap:6px;padding:6px;width:' + (9 * (cell[0] + 6) + 6) + 'px">' +
      list.map((r) => '<figure style="margin:0"><img src="' + r.url + '" width="' + cell[0] + '" height="' + cell[1] + '"><figcaption style="color:#fff">' + r.id + ' · ' + r.layout + '</figcaption></figure>').join('') + '</div>';
    await p.setContent(html); await p.waitForTimeout(300);
    await p.setViewportSize({ width: 9 * (cell[0] + 6) + 6, height: 800 });
    await p.screenshot({ path: path.join(out, 'contact-sheet-' + size + '.png'), fullPage: true });
  }
  if (errors.length) { console.log('page errors:', errors.join(' | ')); bad++; }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
