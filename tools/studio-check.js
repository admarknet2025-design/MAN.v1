#!/usr/bin/env node
/* Keeps DMC Studio's gold to "a touch". Akan Gold (#C9A24A) is allowed only as an accent, the way the public flyer uses it.
 *   node tools/studio-check.js
 * 1) checks the gold hex appears only in lib/studio/render.js (not in the page, the API routes or the data);
 * 2) renders every template at every size, with no photos or uploaded logos, and fails if gold-like pixels cover more
 *    than MAX_GOLD of any image. Photos are other people's pictures, so they are left out of the scan.
 * Exits 1 if anything is found. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { render, SIZES } = require(path.join(ROOT, 'lib/studio/render'));

const MAX_GOLD = 0.03;
let bad = 0;
['lib/studio/app.html', 'api/studio.js', 'api/studio-render.js', 'api/studio-links.js', 'api/studio-library.js', 'api/t.js', 'lib/studio/data.json'].forEach((f) => {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (/c9a24a|rgba?\(\s*201\s*,\s*162/i.test(src)) { console.log('source: ' + f + ' uses the gold colour; it belongs in render.js only'); bad++; }
});

const jobs = [
  ['speaker', { name: 'Test Person', title: 'Title', company: 'Company', role: 'Speaker', session: 'Build Yourself: Presentation', time: '10:35–10:45', movement: 'Build Yourself' }],
  ['speaker', { name: 'Test Person', movement: 'Build Your Team' }],
  ['speaker', { name: 'Test Person', movement: 'Build Your Work' }],
  ['attending', { name: 'Test Person', title: 'Title', company: 'Company', building: 'something' }],
  ['sponsor', { name: 'Test Partner', tier: 'Silver Sponsor', role: 'Role' }],
  ['quote', { quote: 'A quote.', name: 'Test Person', title: 'Title', company: 'Company', movement: 'Build Your Work' }],
  ['countdown', {}],
  ['earlybird', { price: 'GH₵100', priceAfter: 'GH₵150', deadline: '2026-10-31' }],
  ['session', { title: 'Session title', time: '10:45–11:15', movement: 'Build Your Team', speakers: 'Nobody Known · Another Person' }]
];
(async () => {
  let scanned = 0, worst = 0;
  for (const [template, fields] of jobs) {
    for (const size of Object.keys(SIZES)) {
      const { createCanvas, loadImage } = require('@napi-rs/canvas');
      const png = await render({ template, size, fields, qrUrl: size === 'story' ? 'https://mangh.org/t/abcdefg' : '' });
      const img = await loadImage(png);
      const c = createCanvas(img.width, img.height), x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 201) < 30 && Math.abs(d[i + 1] - 162) < 30 && Math.abs(d[i + 2] - 74) < 36) n++;
      scanned++;
      const share = n / (img.width * img.height);
      worst = Math.max(worst, share);
      if (share > MAX_GOLD) { console.log('pixels: ' + template + ' ' + size + ' is ' + (share * 100).toFixed(2) + '% gold-like (limit ' + MAX_GOLD * 100 + '%)'); bad++; }
    }
  }
  console.log(scanned + ' images scanned; most gold in any image: ' + (worst * 100).toFixed(2) + '%; ' + (bad ? bad + ' problem(s)' : 'within limits'));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
