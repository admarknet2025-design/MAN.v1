#!/usr/bin/env node
/* DMC Studio artwork checks. Renders every Artwork-set template at every size (normal and long-name/long-title stress cases) with
   lib/studio/render.js, which draws with the participant flyers' renderer, and writes a contact sheet.
     node tools/studio-check.js [outdir]          (default ./studio-out)
   Fails (exit 1) when:
     - an export is not its exact size;
     - any text box is wider than its limit or leaves the canvas (long names, long titles, empty fields);
     - a pinned Archivo file did not load (that would mean a fallback font);
     - on 9:16, anything but the strap and hardware sits in the top 250px, or anything but the hashtags and weave in the bottom 340px;
     - a band does not draw all seven partner tiles (Jobberman included), or the shared list does not have seven;
     - the countdown is wrong on its edge cases: "1 DAY TO GO", "TODAY" on 21 Nov, and disabled (an error, no image) after the event;
     - Akan Gold covers more than MAX_GOLD of an image, or a Ghanaian letter is missing from the fonts (glyph check, needs fontTools). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'studio-out'));
fs.mkdirSync(OUT, { recursive: true });
const { renderMeta, SIZES, TEMPLATES, countdownWords, DATA } = require(path.join(ROOT, 'lib/studio/render'));
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const PARTNERS = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/partners26/partners.json'), 'utf8')).partners;

const MAX_GOLD = 0.04;
let bad = 0, passes = 0;
const fail = (m) => { bad++; console.log('FAIL ' + m); };
const ok = (m) => { passes++; console.log('ok   ' + m); };

/* ---- glyph coverage (as before): letters in Ghanaian and Nigerian names, in the Studio's fallback fonts ---- */
(function glyphCoverage() {
  const { execFileSync } = require('child_process');
  const need = 'ɔɛɖʋƆƐƉƲŊŋƒƑẹọṣẸỌṢéèêëáàâãíìîóòôõúùûñçÉÈÀÓÚ’“”–·&';
  const code = "import sys\nfrom fontTools.ttLib import TTFont\nneed=sys.argv[1]\nfor k in sys.argv[2:]:\n    x=k.split('|'); cm=[TTFont(p).getBestCmap() for p in x]\n    miss=[c for c in need if not any(ord(c) in m for m in cm)]\n    print(x[0]+' '+''.join(miss))";
  const B = 'assets/flyer/fonts/', N = 'lib/studio/fonts/';
  const sets = [[B + 'archivo-b500.woff2', N + 'NotoSans-M-subset.ttf'], [B + 'archivo-b600.woff2', N + 'NotoSans-SB-subset.ttf'],
    [B + 'archivo-b700.woff2', N + 'NotoSans-B-subset.ttf'], [B + 'archivo-b800.woff2', N + 'NotoSans-XB-subset.ttf']];
  try {
    const out = execFileSync('python3', ['-I', '-c', code, need].concat(sets.map((p) => p.join('|'))), { cwd: ROOT }).toString().trim().split('\n');
    let miss = 0;
    out.forEach((l) => { const [f, ...m] = l.split(' '); if (m.join('')) { fail('glyphs: ' + f + ' (+ Noto fallback) is missing ' + m.join('')); miss++; } });
    if (!miss) ok('glyph coverage: ' + need.length + ' letters at ' + sets.length + ' weights');
  } catch (e) { console.log('skip glyph coverage (needs python3 with fontTools and brotli): ' + e.message.split('\n')[0]); }
})();

const sp = DATA.people.find((p) => p.photo) || { name: 'Test Person' };
const LONG = 'Nana Akosua Adjoa Ɔsɛi-Bonsu Mensah-Bonney';
const CASES = {
  countdown: [{}],
  speaker: [
    { fields: { name: sp.name, title: sp.title, company: sp.company, role: 'Panelist', session: 'Build Your Team: Panel Discussion', time: '11:40–12:10', movement: 'Build Your Team' }, sitePhoto: sp.photo },
    { fields: { name: LONG, title: 'Group Head of Brand, Marketing Communications and Partnerships', company: 'The Very Long Company Name Limited', role: 'Moderator', session: 'Build Your Work: A Very Long Session Title That Will Need To Wrap Across More Than Two Lines', time: '13:45–14:30', movement: 'Build Your Work' }, tag: 'long' }
  ],
  attending: [
    { fields: { name: 'Abena Mensah', title: 'Brand Manager', company: 'Kasapreko', level: 'team' } },
    { fields: { name: LONG, title: 'Senior Digital Marketing and Communications Manager', company: 'Very Long Organisation Name Ghana', level: 'yourself' }, tag: 'long' },
    { fields: {}, tag: 'empty' }
  ],
  session: [
    { fields: { title: 'Build Your Team: Panel Discussion', time: '11:40–12:10', movement: 'Build Your Team', speakers: 'Richard Sena Quashie · Simon Alangdee · Florentia Teye' } },
    { fields: { title: 'Build Yourself: Positioning, Pricing and Personal Brand for Marketing Professionals in a Market That Rewards Visibility', time: '10:35–10:45', movement: 'Build Yourself', speakers: 'Isaac Newton Acquah · Alex Offei Lartey · Ronald Tagoe · Emelia Dede Quist · ' + LONG + ' · Kwaku Ofosuhene' }, tag: 'long' }
  ],
  sponsor: [
    { fields: { name: 'Jobberman', tier: 'Cedar Sponsor', role: 'DMC 2026 sponsor' }, partner: 'jobberman' },
    { fields: { name: 'MojoPay', tier: 'Gold / Headline Sponsor', role: 'Title sponsor and official ticketing platform' }, partner: 'mojopay', tag: 'gold' },
    { fields: { name: 'A Partner With A Very Long Registered Company Name', tier: 'Silver Sponsor', role: 'Partner presentation, 12:25, and a longer role line' }, tag: 'long' }
  ],
  quote: [
    { fields: { quote: 'The organisations scaling in Ghana aren’t waiting. They’re building.', name: sp.name, title: sp.title, company: sp.company, movement: 'Build Yourself' }, sitePhoto: sp.photo },
    { fields: { quote: 'A'.repeat(0) + 'Marketing in Ghana is changing faster than the briefs we write for it. The teams that win are the ones that test, learn, publish and repeat, every single week, and who measure what matters to the business rather than what is easy to count. Build that habit.', name: LONG, title: 'Chief Marketing Officer', company: 'Long Company Name', movement: 'Build Your Work' }, tag: 'long' }
  ]
};
const NOW = Date.parse('2026-11-14T10:00:00Z');

(async () => {
  /* shared partner list */
  if (PARTNERS.length === 7 && PARTNERS.some((p) => p.id === 'jobberman')) ok('assets/partners26/partners.json has seven partners, Jobberman included');
  else fail('the shared partner list should have seven entries including Jobberman (has ' + PARTNERS.map((p) => p.id).join(', ') + ')');

  const order = ['countdown', 'speaker', 'attending', 'session', 'sponsor', 'quote'].filter((t) => TEMPLATES.includes(t));
  if (order.length !== TEMPLATES.length) fail('templates not covered: ' + TEMPLATES.filter((t) => !order.includes(t)).join(', '));
  const sizes = Object.keys(SIZES), sheetRows = [];
  let renders = 0, worstGold = 0, fontsChecked = false;
  for (const t of order) {
    for (const c of CASES[t]) {
      const row = { label: t + (c.tag ? ' (' + c.tag + ')' : ''), imgs: [] };
      for (const s of sizes) {
        const name = t + (c.tag ? '-' + c.tag : '') + '-' + s;
        const m = await renderMeta(Object.assign({ template: t, size: s, now: NOW, debug: true, qrUrl: s === 'story' ? 'https://mangh.org/t/abcdefg' : '' }, c));
        renders++;
        fs.writeFileSync(path.join(OUT, name + '.png'), m.png);
        row.imgs.push(m.png);
        const z = SIZES[s];
        if (m.w !== z.w || m.h !== z.h) fail(name + ': exported ' + m.w + '×' + m.h + ', expected ' + z.w + '×' + z.h);
        if (!fontsChecked) {
          const missing = Object.keys(m.fontsOk).filter((k) => m.fontsOk[k] !== true);
          missing.length ? fail('fonts not loaded (a fallback would draw instead): ' + missing.join(', ')) : ok('all ' + Object.keys(m.fontsOk).length + ' pinned Archivo files loaded on the server (no fallback fonts)');
          fontsChecked = true;
        }
        /* text boxes */
        for (const e of m.log) {
          if (e.tile) continue;
          if (e.limit != null && e.w > e.limit + 0.5) fail(name + ': "' + e.id + '" is ' + e.w.toFixed(1) + 'px wide, limit ' + e.limit);
          if (e.x < -0.5 || e.x + e.w > m.w + 0.5 || e.y < -0.5 || e.y + e.h > m.h + 0.5) fail(name + ': "' + e.id + '" leaves the canvas');
        }
        /* Jobberman and the six others in the band */
        const tiles = m.log.filter((e) => e.tile).map((e) => e.id.replace('tile:', ''));
        const missing = PARTNERS.map((p) => p.id).filter((id) => !tiles.includes(id));
        if (missing.length) fail(name + ': band is missing ' + missing.join(', '));
        /* 9:16 safe zones (text boxes; the strap and hardware are images, the planes are the ground) */
        if (s === 'story') {
          m.log.filter((e) => !e.tile && e.y < 250).forEach((e) => fail(name + ': "' + e.id + '" is inside the top 250px'));
          m.log.filter((e) => !e.tile && e.y + e.h > 1920 - 340 && e.id !== 'hashtags').forEach((e) => fail(name + ': "' + e.id + '" is inside the bottom 340px'));
        }
        /* gold share */
        const img = await loadImage(m.png), cv = createCanvas(img.width, img.height), x = cv.getContext('2d');
        x.drawImage(img, 0, 0);
        /* photos and logos are other people's pictures; the Team level's badge block is the flyer's own gold fill (MY TEAM), so those
           images are left out of the gold cap. Everything else keeps gold to an accent. */
        const teamBlock = (t === 'attending' || t === 'speaker') && ((c.fields || {}).level === 'team' || (c.fields || {}).movement === 'Build Your Team');
        if (!c.sitePhoto && !c.partner && !teamBlock) {
          const d = x.getImageData(0, 0, img.width, img.height).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 201) < 30 && Math.abs(d[i + 1] - 162) < 30 && Math.abs(d[i + 2] - 74) < 36) n++;
          const share = n / (img.width * img.height);
          worstGold = Math.max(worstGold, share);
          if (share > MAX_GOLD) fail(name + ': ' + (share * 100).toFixed(2) + '% gold-like pixels (limit ' + MAX_GOLD * 100 + '%)');
        }
      }
      sheetRows.push(row);
    }
  }
  if (!bad) ok(renders + ' renders: exact sizes, no text over its box or off the canvas, 7 partner tiles (Jobberman included) in every band, 9:16 safe zones clear');
  console.log('most gold in any image: ' + (worstGold * 100).toFixed(2) + '%');

  /* countdown edge cases */
  const cases = [['2026-11-20T09:00:00Z', 'DAY TO GO', '1'], ['2026-11-21T09:00:00Z', null, 'TODAY'], ['2026-11-19T09:00:00Z', 'DAYS TO GO', '2']];
  for (const [when, unit, big] of cases) {
    const w = countdownWords(require(path.join(ROOT, 'lib/studio/render')).daysToGo(Date.parse(when)));
    if (w && w.big === big && (unit == null || w.unit === unit)) ok('countdown on ' + when.slice(0, 10) + ': "' + w.big + (unit ? ' ' + w.unit : '') + '"');
    else fail('countdown on ' + when.slice(0, 10) + ' gave ' + JSON.stringify(w));
    for (const s of sizes) {
      const m = await renderMeta({ template: 'countdown', size: s, now: Date.parse(when), debug: true });
      const num = m.log.find((e) => e.id === 'countdown-number'), un = m.log.find((e) => e.id === 'countdown-unit');
      if (!num || !un) fail('countdown ' + when.slice(0, 10) + ' ' + s + ': number or unit not drawn');
      fs.writeFileSync(path.join(OUT, 'countdown-' + when.slice(0, 10) + '-' + s + '.png'), m.png);
      if (when.startsWith('2026-11-21') && s === 'ig-feed') sheetRows.push({ label: 'countdown (21 Nov)', imgs: [] });
      if (when.startsWith('2026-11-21')) sheetRows[sheetRows.length - 1].imgs.push(m.png);
      if (when.startsWith('2026-11-20') && s === 'ig-feed') sheetRows.push({ label: 'countdown (20 Nov)', imgs: [] });
      if (when.startsWith('2026-11-20')) sheetRows[sheetRows.length - 1].imgs.push(m.png);
    }
  }
  try { await renderMeta({ template: 'countdown', size: 'ig-feed', now: Date.parse('2026-11-22T09:00:00Z') }); fail('countdown rendered after the event (should be disabled)'); }
  catch (e) { /^unavailable/.test(e.message) ? ok('countdown after the event is disabled: "' + e.message + '"') : fail('countdown after the event threw the wrong error: ' + e.message); }

  /* contact sheet: every template and case (rows) at every size (columns) */
  const cellH = 360, gap = 16, colW = sizes.map((s) => Math.round(cellH * SIZES[s].w / SIZES[s].h));
  const width = 230 + colW.reduce((a, b) => a + b + gap, 0), height = 70 + sheetRows.length * (cellH + 46);
  const sheet = createCanvas(width, height), sx = sheet.getContext('2d');
  sx.fillStyle = '#262626'; sx.fillRect(0, 0, width, height);
  sx.fillStyle = '#F4EFE6'; sx.font = 'bold 22px "DMC Archivo B"';
  let cx = 230;
  sizes.forEach((s, j) => { sx.fillText(s + '  ' + SIZES[s].w + '×' + SIZES[s].h, cx, 44); cx += colW[j] + gap; });
  for (const [i, r] of sheetRows.entries()) {
    const y = 70 + i * (cellH + 46);
    sx.fillStyle = '#F4EFE6'; sx.font = 'bold 20px "DMC Archivo B"'; sx.fillText(r.label, 16, y + 28);
    cx = 230;
    for (const [j, png] of r.imgs.entries()) { const img = await loadImage(png); sx.drawImage(img, cx, y, colW[j], cellH); cx += colW[j] + gap; }
  }
  fs.writeFileSync(path.join(OUT, 'contact-sheet.png'), sheet.toBuffer('image/png'));
  console.log('\n' + passes + ' checks passed, ' + bad + ' failed. Contact sheet: ' + path.join(OUT, 'contact-sheet.png'));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
