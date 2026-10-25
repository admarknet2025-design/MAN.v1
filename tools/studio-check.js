#!/usr/bin/env node
/* Guards DMC Studio's hard rule: no Akan Gold (#C9A24A), ever.
 *   node tools/studio-check.js
 * 1) greps the Studio source for the gold hex and the word "gold" in colour contexts;
 * 2) renders every template at every size with no photos or logos and scans every pixel for anything gold-like.
 * Photos and partner logos are other people's pictures, so they are left out of the pixel scan.
 * Exits 1 if anything is found. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { render, SIZES } = require(path.join(ROOT, 'lib/studio/render'));

let bad = 0;
['lib/studio/render.js', 'lib/studio/app.html', 'api/studio.js', 'api/studio-render.js', 'api/studio-links.js', 'api/studio-library.js', 'api/t.js'].forEach((f) => {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  [/c9a24a/i, /#c8a24a/i, /akan/i, /rgba?\(\s*201\s*,\s*162/i, /\bgold\b(?!\s*\/\s*headline)/i].forEach((re) => {
    const m = re.exec(src);
    /* the data file names the Gold / Headline *tier* (a fact about MojoPay); that is text, not a colour, so only code is scanned */
    if (m) { console.log('source: ' + f + ' matches ' + re); bad++; }
  });
});

const jobs = [
  ['speaker', { name: 'Test Person', title: 'Title', company: 'Company', role: 'Speaker', session: 'Build Yourself: Presentation', time: '10:35–10:45', movement: 'Build Yourself' }],
  ['speaker', { name: 'Test Person', movement: 'Build Your Team' }],
  ['speaker', { name: 'Test Person', movement: 'Build Your Work' }],
  ['attending', { name: 'Test Person', title: 'Title', company: 'Company', building: 'something' }],
  ['sponsor', { name: 'Test Partner', tier: 'Silver Sponsor', role: 'Role' }],
  ['quote', { quote: 'A quote.', name: 'Test Person', title: 'Title', company: 'Company', movement: 'Build Your Work' }],
  ['countdown', {}],
  ['session', { title: 'Session title', time: '10:45–11:15', movement: 'Build Your Team', speakers: 'Nobody Known · Another Person' }]
];
(async () => {
  let scanned = 0;
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
      if (n) { console.log('pixels: ' + template + ' ' + size + ' has ' + n + ' gold-like pixels'); bad++; }
    }
  }
  console.log(scanned + ' images scanned, ' + (bad ? bad + ' problem(s)' : 'no gold found'));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
