/* Makes the DMC 2026 link-preview images (Open Graph / Twitter, 1200x630) in the flyers' look (see make() below). Earlier header notes:
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

/* Restyled 14 Nov 2026: drawn with the participant flyers' renderer (assets/flyer/flyer-render.js on @napi-rs/canvas, via
   lib/studio/render.js), so the link previews share the flyers' and DMC Studio's look: ink ground, the hero planes on the right,
   the pill and eyebrow, BUILT TO SCALE with the gold-foil italic SCALE, and the flat partner band (POWERED BY MojoPay on the white
   tile, ORGANIZED BY M·A·N, the seven partners) with the ticket line above it. */
async function make(out, opts, dir) {
  const { FLY } = require('../lib/studio/render.js');
  await FLY.load();
  const I = FLY._internal, K = I.C;
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  const stripH = 92, kenteH = 12, bandY = H - stripH, kenteY = bandY - kenteH;
  ctx.fillStyle = K.INK; ctx.fillRect(0, 0, W, H);
  I.heroGeo(ctx, Math.round(W * 0.58), 0, Math.round(W * 0.42), kenteY);
  const x = 56;
  I.pill(ctx, x, 40, 42, 18, 9, 20);
  const T = (str, X, top, LH, o) => I.drawText(ctx, str, X, top, LH, o);
  const ey = { pin: 'B', size: 14, weight: 700, track: 0.28, fill: 'rgba(244,239,230,.6)' };
  T('DIGITAL MARKETERS’ CONFERENCE', x, 102, 20, Object.assign({ id: 'eyebrow' }, ey));
  const hs = 96, LH = hs * 0.85, hy = 134;
  T('BUILT TO', x, hy, LH, { pin: 'D', size: hs, weight: 900, track: -0.02, fill: K.CREAM, id: 'BUILT TO' });
  const sw = I.measureW(ctx, 'SCALE', 'DI', hs, 900, -0.02);
  T('SCALE', x, hy + LH, LH, { pin: 'DI', size: hs, weight: 900, track: -0.02, fill: I.foil(ctx, x, sw + 0.08 * hs), id: 'SCALE' });
  T('Sat 21 Nov 2026 · 10AM–3PM · British Council, Accra', x, hy + 2 * LH + 26, 28, { pin: 'B', size: 22, weight: 700, fill: K.CREAM, id: 'facts' });
  T('mangh.org/dmc-2026', x, hy + 2 * LH + 62, 28, { pin: 'B', size: 22, weight: 600, fill: K.SOFT, id: 'url' });
  /* the date, large on the planes */
  T('21 NOV', W - 56, 318, 80, { pin: 'D', size: 82, weight: 900, track: -0.02, fill: K.CREAM, align: 'right', id: 'date1' });
  T('2026', W - 56, 392, 60, { pin: 'D', size: 60, weight: 900, track: -0.02, fill: 'rgba(244,239,230,.82)', align: 'right', id: 'date2' });
  /* the ticket line (contract) above the band, then the kente and the band */
  const tl = I.ticketLine(ctx, x, kenteY - 46, 560, Math.max(17, Math.ceil(W * SP.config.MIN_TICKET_TEXT_PCT) / 100 + 1));
  ctx.fillStyle = '#000'; ctx.save(); ctx.translate(0, kenteY); const k = FLY.assets.img.kente;
  if (k) { const sc = kenteH / 24; ctx.scale(sc, sc); ctx.fillStyle = I.tilePattern(ctx, k, 0, 0); ctx.fillRect(0, 0, W / sc + 24, 24); }
  ctx.restore();
  const b = I.bandRow(ctx, { x: 0, y: bandY, w: W, h: stripH, mojoW: SP.minTileW(W, false) + 4, labelSize: 10, padX: 30 });
  const pl = [{ kind: 'mojopay', x: b.mojo.x, y: b.mojo.y, w: b.mojo.w, h: b.mojo.h, tile: b.mojo, colour: b.mojo.colour }, tl];
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
