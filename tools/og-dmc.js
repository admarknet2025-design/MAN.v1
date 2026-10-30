/* Makes the DMC 2026 link-preview images (Open Graph / Twitter, 1200x630) with the contracted sponsor credit.
     node tools/og-dmc.js            writes assets/og-dmc-2026.png (dmc-2026 and press pages) and assets/og-home-dmc-2026.png (the home page)
   The artwork underneath is the existing image, kept in tools/og/ (base-og-*.png); this adds "Powered by MojoPay" and "Tickets on MojoLife"
   with the same shared lockup as every other DMC 2026 asset (assets/sponsor/), at the contract minimum size or larger.
   assets/og-image.png is shared with other pages (MAN Sessions, privacy, partners) and is not touched. */
'use strict';
const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const SP = require('../assets/sponsor/lockup.js');

const ROOT = path.join(__dirname, '..');
const FD = path.join(ROOT, 'lib', 'studio', 'fonts');
GlobalFonts.registerFromPath(path.join(FD, 'Archivo-SemiBold.ttf'), 'DMCArchivoSB');
GlobalFonts.registerFromPath(path.join(FD, 'Archivo-Bold.ttf'), 'DMCArchivoB');
const font = (px, weight) => px + 'px ' + (weight >= 700 ? 'DMCArchivoB' : 'DMCArchivoSB');

const W = 1200, H = 630;
async function sponsorImages() {
  const imgs = {};
  for (const k of Object.keys(SP.config.LOGOS)) {
    const f = SP.config.LOGOS[k].file;
    imgs[k] = f ? await loadImage(Buffer.from(SP.sizedSvg(fs.readFileSync(path.join(ROOT, f), 'utf8')))) : null;
  }
  return imgs;
}

async function make(base, out, opts, dir) {
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.drawImage(await loadImage(fs.readFileSync(path.join(__dirname, 'og', base))), 0, 0, W, H);
  if (opts.ticketLine) {
    /* the old plain URL line becomes the ticket line */
    ctx.fillStyle = '#1C1C1C';
    ctx.fillRect(opts.clear[0], opts.clear[1], opts.clear[2], opts.clear[3]);
    ctx.font = font(24, 600); ctx.fillStyle = 'rgba(244,239,230,.78)'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(SP.config.TICKET_LINE, 1128, 555);
  }
  const tileW = Math.max(SP.minTileW(W, false), 204);
  const imgs = await sponsorImages();
  const o = { variant: 'stacked', tileW, images: imgs, font };
  const b = SP.measure(ctx, Object.assign({ kind: 'mojolife' }, o));
  const a = SP.measure(ctx, Object.assign({ kind: 'mojopay' }, o));
  const y = 410, gap = 30;
  const pl = [SP.draw(ctx, Object.assign({ kind: 'mojopay', x: 1128 - b.w - gap - a.w, y }, o)), SP.draw(ctx, Object.assign({ kind: 'mojolife', x: 1128 - b.w, y }, o))];
  fs.writeFileSync(path.join(dir || path.join(ROOT, 'assets'), out), c.toBuffer('image/png'));
  return { out, placements: pl, problems: SP.check(pl, W, H, false) };
}

module.exports = { make, W, H };
if (require.main === module) {
  (async () => {
    const r = [
      await make('base-og-dmc-2026.png', 'og-dmc-2026.png', { ticketLine: true, clear: [840, 520, 330, 50] }),
      await make('base-og-home.png', 'og-home-dmc-2026.png', {})
    ];
    r.forEach((x) => console.log(x.out, x.placements.map((p) => p.kind + ' ' + Math.round(p.tile.w) + 'x' + Math.round(p.tile.h)).join(' | '), x.problems.length ? 'PROBLEMS ' + x.problems : 'ok'));
  })().catch((e) => { console.error(e); process.exit(1); });
}
