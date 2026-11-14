#!/usr/bin/env node
/* Card-sized copies of the partner logos and the M·A·N logo for the quote card bundle (a partner tile on a card is about 130px wide,
   so the site's full-size files would only add weight to a bundle phones download). Source: assets/partners26/partners.json.
     node tools/live-cards/make-logos.js   (then node tools/build-live-cards.js) */
'use strict';
const fs = require('fs'), path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, 'logos');
const PJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/partners26/partners.json'), 'utf8'));
const jobs = PJ.partners.map((p) => [path.join(ROOT, 'assets/partners26', p.logo), p.logo.replace(/\.\w+$/, '.webp'), 300])
  .concat([[path.join(ROOT, 'assets/man-logo.png'), 'man-logo.webp', 480]]);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [src, name, max] of jobs) {
    const im = await loadImage(fs.readFileSync(src)), k = Math.min(1, max / Math.max(im.width, im.height));
    const c = createCanvas(Math.round(im.width * k), Math.round(im.height * k)), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
    const buf = await c.encode('webp', 90);
    fs.writeFileSync(path.join(OUT, name), buf);
    console.log(name, c.width + 'x' + c.height, buf.length + ' bytes');
  }
})();
