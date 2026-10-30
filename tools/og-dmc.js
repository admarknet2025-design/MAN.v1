/* Makes the DMC 2026 link-preview images (Open Graph / Twitter, 1200x630), drawn here from scratch with the same header as every other DMC 2026 asset:
   "BUILT TO" in cream, "SCALE" in the website's gold gradient, "Powered by MojoPay" (the shared lockup, assets/sponsor/) beside the title block,
   and the line "Tickets exclusively on MojoLife" in the footer row. The M·A·N logo is not in the header; "Organised by M·A·N" is in the footer row.
     node tools/og-dmc.js            writes assets/og-dmc-2026.png (dmc-2026 and press pages) and assets/og-home-dmc-2026.png (the home page)
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
GlobalFonts.registerFromPath(path.join(FD, 'ArchivoExpanded-Black.ttf'), 'DMCArchivoXK');
const font = (px, weight) => px + 'px ' + (weight >= 700 ? 'DMCArchivoB' : 'DMCArchivoSB');

const C = { ob: '#1C1C1C', cr: '#F4EFE6', te: '#2A7B74', co: '#D95F45', go: '#C9A24A' };
const W = 1200, H = 630;
async function sponsorImages() {
  const imgs = {};
  for (const k of Object.keys(SP.config.LOGOS)) {
    const f = SP.config.LOGOS[k].file;
    imgs[k] = f ? await loadImage(Buffer.from(SP.sizedSvg(fs.readFileSync(path.join(ROOT, f), 'utf8')))) : null;
  }
  return imgs;
}

function tracked(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
  return cx - x - spacing;
}

async function make(out, opts, dir) {
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = C.ob; ctx.fillRect(0, 0, W, H);

  /* corner triangles (coral behind, teal in front, a thin gold wedge below), the slim gold bar on the left, the kente strip along the bottom */
  const tri = (col, a, b, cc) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(cc[0], cc[1]); ctx.closePath(); ctx.fill(); };
  tri(C.co, [W, 0], [W, 300], [W - 300, 0]);
  tri(C.te, [W, 0], [W, 162], [W - 162, 0]);
  tri(C.go, [W, 300], [W, 348], [W - 48, 300]);
  ctx.fillStyle = C.go; ctx.fillRect(72, 70, 5, 430);
  const seg = [[C.go, 18], [C.ob, 2], [C.te, 18], [C.ob, 2], [C.co, 18], [C.ob, 2], [C.cr, 18], [C.ob, 2]];
  for (let x = 0, i = 0; x < W; x += seg[i % seg.length][1], i++) { ctx.fillStyle = seg[i % seg.length][0]; ctx.fillRect(x, H - 14, Math.min(seg[i % seg.length][1], W - x), 14); }

  /* header: kicker, then the title block with "Powered by MojoPay" beside it */
  const lx = 113;
  ctx.fillStyle = 'rgba(244,239,230,.62)'; ctx.font = font(19, 700);
  tracked(ctx, 'DIGITAL MARKETERS’ CONFERENCE 2026', lx, 104, 4.2);
  const px = 108, cap = Math.round(px * 0.7), lh = Math.round(px * 0.92), top = 138;
  ctx.font = px + 'px DMCArchivoXK';
  const b1 = top + cap, b2 = b1 + lh;
  const tw = ctx.measureText('BUILT TO').width, sw = ctx.measureText('SCALE').width;
  ctx.fillStyle = C.cr; ctx.fillText('BUILT TO', lx, b1);
  const g = ctx.createLinearGradient(lx, 0, lx + sw, 0);
  g.addColorStop(0, C.go); g.addColorStop(0.62, '#F5D87A'); g.addColorStop(1, '#E6C566');
  ctx.fillStyle = g; ctx.fillText('SCALE', lx, b2);

  const tileW = Math.max(SP.minTileW(W, false), 204);
  const imgs = await sponsorImages();
  const o = { variant: 'stacked', tileW, images: imgs, font };
  const a = SP.measure(ctx, Object.assign({ kind: 'mojopay' }, o));
  const gapX = Math.max(40, Math.ceil(SP.clearSpace(tileW) * 1.6));
  const rx = Math.round(lx + tw + gapX), blockH = b2 - top;
  ctx.fillStyle = 'rgba(244,239,230,.28)'; ctx.fillRect(rx, top + 6, 2, blockH - 12);
  const pl = [SP.draw(ctx, Object.assign({ kind: 'mojopay', x: rx + 2 + gapX, y: Math.round(top + (blockH - a.h) / 2) }, o))];

  /* footer row: date and venue, the organiser, the ticket line, the address */
  ctx.fillStyle = C.cr; ctx.font = '42px DMCArchivoXK'; ctx.fillText('21 NOV 2026', lx, 520);
  ctx.fillStyle = 'rgba(244,239,230,.85)'; ctx.font = font(22, 700); ctx.fillText('Saturday  ·  10AM–3PM  ·  British Council, Accra', lx, 558);
  const logo = await loadImage(fs.readFileSync(path.join(ROOT, 'assets', 'man-logo.png')));
  const ox = 700, lgH = 46, lgW = Math.round(lgH * logo.width / logo.height);
  ctx.fillStyle = 'rgba(244,239,230,.62)'; ctx.font = font(13, 700); tracked(ctx, 'ORGANISED BY', ox, 503, 2.6);
  ctx.drawImage(logo, ox, 514, lgW, lgH);
  pl.push(SP.drawTicketLine(ctx, { x: 1128, y: 480, tileW, variant: 'horizontal', font, align: 'right' }));
  ctx.fillStyle = 'rgba(244,239,230,.8)'; ctx.font = font(24, 700); ctx.textAlign = 'right'; ctx.fillText('mangh.org/dmc-2026', 1128, 566); ctx.textAlign = 'left';

  fs.writeFileSync(path.join(dir || path.join(ROOT, 'assets'), out), c.toBuffer('image/png'));
  return { out, placements: pl, problems: SP.check(pl, W, H, false) };
}

module.exports = { make, W, H };
if (require.main === module) {
  (async () => {
    const r = [
      await make('og-dmc-2026.png'),
      await make('og-home-dmc-2026.png')
    ];
    r.forEach((x) => console.log(x.out, x.placements.map((p) => p.kind + ' ' + Math.round((p.tile || p).w) + 'x' + Math.round((p.tile || p).h)).join(' | '), x.problems.length ? 'PROBLEMS ' + x.problems : 'ok'));
  })().catch((e) => { console.error(e); process.exit(1); });
}
