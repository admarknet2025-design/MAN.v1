/* DMC Studio renderer: every Artwork-set template at every size, drawn on the server with the participant flyers' own renderer
   (assets/flyer/flyer-render.js, loaded here through DMCFlyer.useNode on @napi-rs/canvas). So the Studio and the public flyer share
   one look and one code path: the website hero planes (g1, g2 and the fade), the expanded headline with the gold-foil italic SCALE,
   the "DMC 2026 · ACCRA" pill and eyebrow, the gloss layers on physical objects only (the Badge, the Brief sheet, the headshot
   print), the kente divider and the flat partner band (POWERED BY MojoPay on a white tile, ORGANIZED BY M·A·N, IN PARTNERSHIP WITH
   the seven tiles of assets/partners26/partners.json).

   Formats. 4:5 (ig-feed) and 9:16 (story) are the flyer's own geometry. The others are derived:
     square (1:1)        the planes top-right in the same proportions, a smaller headline stack, a compact single-row band;
     linkedin-link and x the planes on the right 40%, the headline on the left, the band as one thin strip at the bottom.
   Each template keeps its content module (Badge, Brief sheet, logo tile, countdown number) in every format.

   Sponsor credit (docs/sponsor-credit.md): the band carries the MojoPay tile (the largest logo, at or above the contract minimum
   width) and every image carries "Tickets exclusively on MojoLife"; both are reported as placements for tools/sponsor-check.js.
   QR: none on previews; Story and TikTok sizes get one when the set is created (opts.qrUrl). */
'use strict';

const fs = require('fs');
const path = require('path');
const napi = require('@napi-rs/canvas');
const { createCanvas, loadImage, GlobalFonts } = napi;
const DATA = require('./data.json');
const SP = require('../../assets/sponsor/lockup.js');

const ROOT = path.resolve(__dirname, '..', '..');
const FLY = require('../../assets/flyer/flyer-render.js').useNode(napi, { root: ROOT });
const I = FLY._internal;
const K = I.C;                                   /* CREAM INK OB GOLD TEAL CORAL SOFT MUTE DARK2: the flyer's tokens */
const C = { ob: K.OB, cr: K.CREAM, te: K.TEAL, co: K.CORAL, go: K.GOLD, ink: K.INK };

/* Archivo has no ɔ ɛ ɖ ʋ (Akan, Ewe, Ga and other Ghanaian names): on the server the matching Noto Sans subsets join the flyer's
   glyph-fallback family, so those letters draw in a sibling sans instead of a system font. Archivo's own glyphs are untouched. */
['R', 'M', 'SB', 'B', 'XB', 'XK'].forEach((k) => {
  try { GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'NotoSans-' + k + '-subset.ttf'), 'DMC Archivo Cedi'); } catch (e) { /* optional */ }
});

const SIZES = {
  'ig-feed':       { w: 1080, h: 1350, kind: 'portrait', fmt: '4:5' },
  'story':         { w: 1080, h: 1920, kind: 'tall', fmt: '9:16' },
  'square':        { w: 1080, h: 1080, kind: 'square', fmt: '1:1' },
  'linkedin-link': { w: 1200, h: 627,  kind: 'wide', fmt: 'land' },
  'x':             { w: 1600, h: 900,  kind: 'wide', fmt: 'land' }
};
const EVENT_DAY = '2026-11-21';
const LEVEL_OF = { 'Build Yourself': 'yourself', 'Build Your Team': 'team', 'Build Your Work': 'work' };
const levelOf = (movement, level) => (FLY.LEVELS[level] ? level : LEVEL_OF[movement] || 'yourself');

/* ---------- text helpers on the flyer's pins (D = expanded 900, DI = its italic, B = Archivo 500–800, BI = italic 500) ---------- */
const T = (ctx, str, x, top, LH, o) => I.drawText(ctx, str, x, top, LH, o);
const W = (ctx, str, pin, size, weight, track) => I.measureW(ctx, str, pin, size, weight, track || 0);
function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200);
}
/* greedy wrap for any pin; the last allowed line ends in an ellipsis when text is left over */
function wrapPin(ctx, text, pin, size, weight, maxW, maxLines) {
  const words = text.split(' ').filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (W(ctx, t, pin, size, weight) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    let last = lines.slice(maxLines - 1).join(' ');
    while (last.length > 1 && W(ctx, last + '…', pin, size, weight) > maxW) last = last.slice(0, -1);
    lines.length = maxLines - 1; lines.push(last.replace(/[\s&,·–-]+$/, '') + '…');
  }
  return lines.map((l) => { let t = l; while (t.length > 1 && W(ctx, t, pin, size, weight) > maxW) t = t.slice(0, -2) + '…'; return t; });
}
/* the largest size (down to min) at which text fits maxLines lines of maxW and a height budget */
function fitBlock(ctx, text, pin, weight, base, min, maxW, maxLines, maxH, lh) {
  for (let s = base; s >= min; s -= 2) {
    const lines = wrapPin(ctx, text, pin, s, weight, maxW, 99);
    if (lines.length <= maxLines && lines.length * s * lh <= maxH) return { size: s, lines };
  }
  return { size: min, lines: wrapPin(ctx, text, pin, min, weight, maxW, Math.max(1, Math.min(maxLines, Math.floor(maxH / (min * lh))))) };
}
function block(ctx, text, x, top, o) {         /* o: pin weight base min maxW maxLines maxH lh fill id align */
  const b = fitBlock(ctx, text, o.pin, o.weight, o.base, o.min, o.maxW, o.maxLines, o.maxH, o.lh || 1.08);
  const LH = Math.round(b.size * (o.lh || 1.08));
  b.lines.forEach((l, i) => T(ctx, l, x, top + i * LH, LH, { pin: o.pin, size: b.size, weight: o.weight, fill: o.fill, id: (o.id || 'block') + i, limit: o.maxW, align: o.align, track: o.track }));
  return { h: b.lines.length * LH, size: b.size, lines: b.lines.length };
}

/* ---------- shared scene pieces ---------- */
const ticketPx = (w) => Math.max(12, Math.ceil(w * SP.config.MIN_TICKET_TEXT_PCT) / 100 + 2);
function eyebrow(ctx, x, y, size, limit) {
  const o = { pin: 'B', size, weight: 700, track: 0.28, fill: 'rgba(244,239,230,.6)', limit };
  T(ctx, 'DIGITAL MARKETERS’', x, y, size * 1.4, Object.assign({ id: 'eyebrow1' }, o));
  T(ctx, 'CONFERENCE', x, y + size * 1.4, size * 1.4, Object.assign({ id: 'eyebrow2' }, o));
  return size * 2.8;
}
/* BUILT / TO / SCALE (stacked) or BUILT TO / SCALE, SCALE in the foil */
function headline(ctx, x, y, size, lines) {
  const LH = size * 0.85, o = { pin: 'D', size, weight: 900, track: -0.02, fill: C.cr };
  if (lines === 2) {
    T(ctx, 'BUILT TO', x, y, LH, Object.assign({ id: 'BUILT TO' }, o));
  } else {
    T(ctx, 'BUILT', x, y, LH, Object.assign({ id: 'BUILT' }, o));
    T(ctx, 'TO', x, y + LH, LH, Object.assign({ id: 'TO' }, o));
  }
  const sy = y + (lines === 2 ? 1 : 2) * LH, w = W(ctx, 'SCALE', 'DI', size, 900, -0.02);
  T(ctx, 'SCALE', x, sy, LH, { pin: 'DI', size, weight: 900, track: -0.02, fill: I.foil(ctx, x, w + 0.08 * size), id: 'SCALE' });
  return (lines === 2 ? 2 : 3) * LH;
}
function factsLine(ctx, x, y, size, limit, fill) {
  const t = 'Sat 21 Nov 2026 · 10AM–3PM · British Council';
  let s = size; while (s > 11 && W(ctx, t, 'B', s, 700) > limit) s -= 0.5;
  return T(ctx, t, x, y + (size - s) / 2, size * 1.3, { pin: 'B', size: s, weight: 700, fill: fill || C.cr, id: 'facts', limit });
}
function storyTail(ctx) {                        /* the 9:16 bottom 340px: hashtags and weave only */
  T(ctx, '#DMC2026 · #BuiltToScale', 64, 1604, 28, { pin: 'B', size: 28, weight: 600, fill: K.SOFT, id: 'hashtags' });
  const f = FLY.assets.img.field;
  if (f) { ctx.save(); ctx.beginPath(); ctx.rect(0, 1660, 1080, 260); ctx.clip(); ctx.globalAlpha = 0.6; ctx.fillStyle = I.tilePattern(ctx, f, 0, 1440); ctx.fillRect(0, 1660, 1080, 260); ctx.restore(); }
}
function kente(ctx, y, w, h) {
  const k = FLY.assets.img.kente;
  if (k) {
    ctx.save(); ctx.translate(0, y); const s = h / 24; ctx.scale(s, s);
    ctx.fillStyle = I.tilePattern(ctx, k, 0, 0); ctx.fillRect(0, 0, w / s + 24, 24); ctx.restore();
  }
}
/* the band: 4:5 and 9:16 use the flyer's own band; square and landscape use the single-row strip */
const BAND = {
  '4:5':  { kenteY: 1110, bandY: 1134, bandH: 216, contentY: 1152, row1H: 72, manW: 172, manH: 56, mojoPadV: 16, tilesLabelY: 1238, tileY: 1272, tileH: 58 },
  '9:16': { kenteY: 1356, bandY: 1380, bandH: 540, contentY: 1396, row1H: 68, manW: 166, manH: 54, mojoPadV: 15, tilesLabelY: 1476, tileY: 1508, tileH: 54 }
};
function stripGeo(L) {
  if (L.fmt === '1:1') return { h: 128, kente: 20, label: 13, padX: 40 };
  return L.w >= 1600 ? { h: 124, kente: 16, label: 13, padX: 48 } : { h: 92, kente: 12, label: 10, padX: 30 };
}
function drawBand(ctx, L) {
  if (L.fmt === '4:5' || L.fmt === '9:16') {
    const info = I.band(ctx, BAND[L.fmt], {});
    return { mojo: info.mojo, tiles: info.tiles };
  }
  const g = stripGeo(L), y = L.h - g.h;
  kente(ctx, y - g.kente, L.w, g.kente);
  const mojoW = SP.minTileW(L.w, false) + 4;
  return I.bandRow(ctx, { x: 0, y, w: L.w, h: g.h, mojoW, labelSize: g.label, padX: g.padX });
}
function ground(ctx, L) { ctx.fillStyle = C.ink; ctx.fillRect(0, 0, L.w, L.h); }
/* the planes: 4:5 and 9:16 as on the flyer (right half, down to the kente); square top-right at the same proportions;
   landscape on the right 40% */
function planes(ctx, L) {
  if (L.fmt === '4:5') return I.heroGeo(ctx, 540, 0, 540, 1110);
  if (L.fmt === '9:16') return I.heroGeo(ctx, 540, 0, 540, 1356);
  const top = L.h - stripGeo(L).h - stripGeo(L).kente;
  if (L.fmt === '1:1') return I.heroGeo(ctx, 540, 0, 540, Math.round(540 * 1110 / 540 * 0.82));
  return I.heroGeo(ctx, Math.round(L.w * 0.6), 0, Math.round(L.w * 0.4), top);
}
function drawQR(ctx, url, x, y, size, label, labelX) {
  I.fillRR(ctx, x, y, size, size, 8, C.cr);
  I.drawQR(ctx, url, x + size * 0.076, y + size * 0.076, size * 0.848);
  ['SCAN FOR', 'TICKETS'].forEach((t, i) => T(ctx, t, labelX, y + 12 + i * 24, 24, { pin: 'B', size: 18, weight: 700, track: 0.14, fill: K.SOFT, id: 'scan' + i }));
}

/* ---------- layout skeleton shared by the non-Badge templates ---------- */
function layout(sizeKey) {
  const s = SIZES[sizeKey];
  const L = Object.assign({ key: sizeKey }, s);
  L.story = s.fmt === '9:16';
  if (s.fmt === '4:5') Object.assign(L, { pad: 64, top: 48, pill: { h: 58, padX: 28, gap: 14, size: 30 }, eyeSize: 20, head: 76, bodyBottom: 1086 });
  else if (s.fmt === '9:16') Object.assign(L, { pad: 64, top: 250, pill: { h: 56, padX: 24, gap: 12, size: 28 }, eyeSize: 20, head: 86, bodyBottom: 1336 });
  else if (s.fmt === '1:1') Object.assign(L, { pad: 56, top: 44, pill: { h: 46, padX: 20, gap: 10, size: 23 }, eyeSize: 16, head: 60, bodyBottom: L.h - 128 - 20 - 28 });
  else {
    const k = L.w / 1600;
    Object.assign(L, { pad: Math.round(56 * k), top: Math.round(48 * k), pill: { h: Math.round(50 * k), padX: Math.round(22 * k), gap: Math.round(10 * k), size: Math.round(24 * k) },
      eyeSize: Math.round(17 * k), head: Math.round(74 * k), bodyBottom: L.h - stripGeo(L).h - stripGeo(L).kente - Math.round(22 * k) });
  }
  return L;
}
/* pill + eyebrow (+ optional headline) at the top left; returns the y below it */
function masthead(ctx, L, withHead, headLines) {
  let y = L.top;
  I.pill(ctx, L.pad, y, L.pill.h, L.pill.padX, L.pill.gap, L.pill.size);
  y += L.pill.h + Math.round(L.pill.h * 0.42);
  y += eyebrow(ctx, L.pad, y, L.eyeSize, 380) + Math.round(L.eyeSize * 1.4);
  if (withHead) y += headline(ctx, L.pad, y, L.head, headLines || 3) + Math.round(L.head * 0.3);
  return y;
}

/* =========================================================================================================================
   Templates. Each returns { placements } (MojoPay tile, ticket line) and draws everything, band included.
   ========================================================================================================================= */
const TPL = {};

/* ---- the Badge family: Speaker / panelist and I'm attending ---- */
function badgeState(t, f, a, L) {
  const S = {
    template: 'badge', format: L.fmt === '9:16' ? '9:16' : '4:5', level: levelOf(f.movement, f.level),
    participantRole: t === 'speaker' ? 'speaking' : 'attending',
    name: f.name, role: [f.title, f.company].filter(Boolean).join(', '),
    qrUrl: a.qrUrl || 'https://mangh.org/dmc-2026', photo: a.photo || null, gloss: 'standard'
  };
  const N = FLY.normalize(S);
  N.noQR = !a.qrUrl;
  if (t === 'speaker') {
    const role = clean(f.role || 'Speaker', 24).toUpperCase();
    N.left = { kicker: role + (f.time ? ' · ' + f.time.replace(/-/g, '–') : ''), title: f.session || 'Session to be announced' };
  }
  return N;
}
function badgeTemplate(t) {
  return (ctx, L, f, a) => {
    const N = badgeState(t, f, a, L);
    if (L.fmt === '4:5' || L.fmt === '9:16') {
      N.ticket = { px: ticketPx(L.w) + 4 };
      const info = I.drawBadge(ctx, N);
      const m = info.band.mojo;
      return [{ kind: 'mojopay', x: m.x, y: m.y, w: m.w, h: m.h, tile: m, colour: m.colour }, N.ticket.placement];
    }
    /* square / landscape: the same Badge object, scaled, beside a smaller headline stack */
    ground(ctx, L); planes(ctx, L);
    const KB = I.badgeLayout(ctx, Object.assign({}, N, { story: false, fmt: '4:5' }));
    const g = stripGeo(L), bottom = L.h - g.h - g.kente - (L.fmt === '1:1' ? 24 : 14);
    const k = bottom / 1080, right = L.w - (L.fmt === '1:1' ? 40 : Math.round(L.w * 0.035));
    const tx = right - 1016 * k;
    const log = I.logBox(), from = log ? log.length : 0;
    ctx.save(); ctx.translate(tx, 0); ctx.scale(k, k); I.badgeObject(ctx, Object.assign({}, N, { story: false }), KB); ctx.restore();
    /* the object's text boxes were logged in its own 1080 space: map them to the canvas for the overflow checks */
    if (log) for (let i = from; i < log.length; i++) { const e = log[i]; e.x = tx + e.x * k; e.y *= k; e.w *= k; e.h *= k; if (e.limit != null) e.limit *= k; }
    const colW = Math.floor(tx + 416 * k - L.pad - Math.round(L.w * 0.03));
    let y = masthead(ctx, L, true, L.fmt === '1:1' ? 3 : 2);
    const lv = N.lv;
    if (t === 'speaker') {
      T(ctx, N.left.kicker, L.pad, y, L.head * 0.36, { pin: 'B', size: Math.round(L.head * 0.3), weight: 800, track: 0.06, fill: lv.text, id: 'iam', limit: colW });
      y += L.head * 0.44;
      y += block(ctx, N.left.title, L.pad, y, { pin: 'B', weight: 800, base: Math.round(L.head * 0.5), min: Math.round(L.head * 0.3), maxW: colW, maxLines: 2, maxH: L.head * 1.1, fill: C.cr, id: 'lefttitle' }).h;
    } else {
      T(ctx, 'I’M BUILDING', L.pad, y, L.head * 0.36, { pin: 'B', size: Math.round(L.head * 0.3), weight: 800, track: 0.06, fill: lv.text, id: 'iam', limit: colW });
      y += L.head * 0.4;
      T(ctx, lv.word, L.pad, y, L.head * 0.62, { pin: 'D', size: Math.round(L.head * 0.62), weight: 900, fill: lv.text, id: 'levelword', limit: colW, kern: { 'Y ': -0.11 } });
      y += L.head * 0.7;
    }
    return landFooter(ctx, L, a, y, colW);
  };
}
/* square / landscape footer of the left column: facts, link and the ticket line */
function landFooter(ctx, L, a, y, colW) {
  const fs = Math.round(L.head * 0.3), bottom = L.bodyBottom;
  const tpx = ticketPx(L.w);
  const tlY = bottom - Math.round(tpx * 1.3);
  const linkY = tlY - Math.round(fs * 1.6);
  const factsY = linkY - Math.round(fs * 1.5);
  if (factsY > y) {
    factsLine(ctx, L.pad, factsY, fs, colW);
    T(ctx, 'mangh.org/dmc-2026', L.pad, linkY, fs * 1.3, { pin: 'B', size: fs, weight: 600, fill: K.SOFT, id: 'url', limit: colW });
  }
  const tl = I.ticketLine(ctx, L.pad, tlY, colW, tpx);
  const b = drawBand(ctx, L);
  return [{ kind: 'mojopay', x: b.mojo.x, y: b.mojo.y, w: b.mojo.w, h: b.mojo.h, tile: b.mojo, colour: b.mojo.colour }, tl];
}
TPL.speaker = badgeTemplate('speaker');
TPL.attending = badgeTemplate('attending');

/* ---- the Brief family: Session card and Quote card (cream sheet, gold hairline rules, chips, planes behind) ---- */
function sheet(ctx, x, y, w, h) {
  const G = FLY.GLOSS.standard;
  ctx.save(); ctx.globalAlpha = G.shadow; ctx.shadowColor = I.black(0.52); ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; I.fillRR(ctx, x, y, w, h, 6, C.cr); ctx.restore();
  I.fillRR(ctx, x, y, w, h, 6, C.cr);
  ctx.save(); ctx.globalAlpha = G.sheen; I.rrPath(ctx, x, y, w, h, 6); ctx.clip();
  ctx.fillStyle = I.grad135(ctx, x, y, w, h, [[0.06, 0], [0.22, 0.14], [0.38, 0]]); ctx.fillRect(x, y, w, h); ctx.restore();
  ctx.save(); ctx.globalAlpha = G.edge; I.rrPath(ctx, x, y, w, h, 6); ctx.clip();
  ctx.fillStyle = I.white(0.8); ctx.fillRect(x, y, w, 1); ctx.fillStyle = I.white(0.5); ctx.fillRect(x, y, 1, h); ctx.restore();
}
const rule = (ctx, x, y, w, px) => { ctx.fillStyle = C.go; ctx.fillRect(x, Math.round(y), w, px || 1); };
const label = (ctx, t, x, top, s) => T(ctx, t, x, top, s, { pin: 'B', size: s, weight: 700, track: 0.14, fill: C.te, id: 'lbl-' + t });
/* the sheet's masthead: eyebrow, job line, BUILT TO SCALE / DMC 2026, gold rule; returns y below */
function sheetHead(ctx, x, y, w, s, jobLine) {
  const mo = { pin: 'B', size: Math.round(18 * s), weight: 700, fill: K.MUTE };
  const jw = W(ctx, jobLine, 'B', mo.size, 700, 0.14);
  T(ctx, 'DIGITAL MARKETERS’ CONFERENCE', x, y, mo.size, Object.assign({ track: 0.28, id: 'eyebrow', limit: w - jw - 24 * s }, mo));
  T(ctx, jobLine, x + w, y, mo.size, Object.assign({ track: 0.14, align: 'right', id: 'jobno' }, mo));
  const hs = Math.round(64 * s), hLH = hs * 0.85, hy = y + Math.round(36 * s);
  const w1 = T(ctx, 'BUILT TO ', x, hy, hLH, { pin: 'D', size: hs, weight: 900, track: -0.02, fill: C.ob, id: 'brief-h1a' });
  T(ctx, 'SCALE', x + w1, hy, hLH, { pin: 'DI', size: hs, weight: 900, track: -0.02, fill: C.ob, id: 'brief-h1b' });
  T(ctx, 'DMC 2026', x, hy + hLH, hLH, { pin: 'D', size: hs, weight: 900, track: -0.02, fill: C.co, id: 'brief-h2' });
  const ry = hy + 2 * hLH + Math.round(18 * s);
  rule(ctx, x, ry, w, 2);
  return ry + 2;
}
function levelChip(ctx, x, y, movement, s) {
  const lv = FLY.LEVELS[levelOf(movement)];
  const txt = movement || 'DMC 2026', fs = Math.round(24 * s), w = W(ctx, txt, 'B', fs, 700) + 28 * s, h = Math.round(42 * s);
  ctx.fillStyle = lv.fill; ctx.fillRect(x, y, w, h);
  T(ctx, txt, x + 14 * s, y + (h - fs) / 2, fs, { pin: 'B', size: fs, weight: 700, fill: lv.ink, id: 'levelchip' });
  return h;
}
function outlineChip(ctx, x, y, txt, s) {
  const fs = Math.round(16 * s), w = W(ctx, txt, 'B', fs, 700, 0.14) + 26 * s, h = Math.round(34 * s);
  I.strokeRR(ctx, x, y, w, h, 0, 1, C.ob);
  T(ctx, txt, x + 13 * s, y + (h - fs) / 2, fs, { pin: 'B', size: fs, weight: 700, track: 0.14, fill: C.ob, id: 'chip-' + txt });
  return w;
}
/* headshot print: white frame, 3° turn, its own shadow, print sheen, top line (the Brief's) */
function print(ctx, img, x, y, w, h, deg) {
  const G = FLY.GLOSS.standard, m = Math.round(w * 0.05);
  I.rot(ctx, x + w / 2, y + h / 2, deg == null ? 3 : deg, () => {
    ctx.save(); ctx.globalAlpha = G.shadow; ctx.shadowColor = 'rgba(28,28,28,0.26)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.restore();
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(x + m, y + m, w - 2 * m, h - 2 * m); ctx.clip();
    I.cover(ctx, img, x + m, y + m, w - 2 * m, h - 2 * m, 0.5, 0.3);
    ctx.globalAlpha = G.sheen; ctx.fillStyle = I.grad135(ctx, x + m, y + m, w - 2 * m, h - 2 * m, [[0.70, 0], [0.77, 0.20], [0.84, 0]]); ctx.fillRect(x + m, y + m, w - 2 * m, h - 2 * m);
    ctx.globalAlpha = G.edge; ctx.fillStyle = I.white(0.5); ctx.fillRect(x + m, y + m, w - 2 * m, 1);
    ctx.restore();
  });
}
/* where the sheet sits and how big its type is, per format */
function sheetBox(ctx, L) {
  if (L.fmt === '4:5') {
    ground(ctx, L); planes(ctx, L);
    const y = masthead(ctx, L, false);
    return { x: 40, y: y + 6, w: 1000, h: 1086 - y - 6, s: 1, pad: 40 };
  }
  if (L.fmt === '9:16') {
    ground(ctx, L); planes(ctx, L);
    const y = masthead(ctx, L, false);
    return { x: 40, y: y + 10, w: 1000, h: 1336 - y - 10, s: 1.05, pad: 44 };
  }
  ground(ctx, L); planes(ctx, L);
  if (L.fmt === '1:1') {
    const y = masthead(ctx, L, false);
    return { x: 40, y: y + 4, w: 1000, h: L.bodyBottom - y - 4 + 20, s: 0.8, pad: 32 };
  }
  /* landscape: headline stack on the left, the sheet on the right over the planes */
  let y = masthead(ctx, L, true, 2);
  const sw = Math.round(L.w * 0.56), sx = L.w - sw - Math.round(L.w * 0.03), sy = Math.round(L.top * 0.9);
  return { x: sx, y: sy, w: sw, h: L.bodyBottom - sy + 8, s: L.w / 1600 * 0.78, pad: Math.round(32 * L.w / 1600), leftY: y, colW: sx - L.pad - Math.round(L.w * 0.03) };
}
function sheetFooter(ctx, L, B, a) {
  const tpx = ticketPx(L.w);
  if (L.fmt === 'land') {
    const b = drawBand(ctx, L), colW = B.colW;
    const fs = Math.round(L.head * 0.3), tlY = L.bodyBottom - Math.round(tpx * 1.3), linkY = tlY - Math.round(fs * 1.6), factsY = linkY - Math.round(fs * 1.5);
    if (factsY > B.leftY) { factsLine(ctx, L.pad, factsY, fs, colW); T(ctx, 'mangh.org/dmc-2026', L.pad, linkY, fs * 1.3, { pin: 'B', size: fs, weight: 600, fill: K.SOFT, id: 'url', limit: colW }); }
    const tl = I.ticketLine(ctx, L.pad, tlY, colW, tpx);
    return [{ kind: 'mojopay', x: b.mojo.x, y: b.mojo.y, w: b.mojo.w, h: b.mojo.h, tile: b.mojo, colour: b.mojo.colour }, tl];
  }
  /* inside the sheet's foot: optional QR (stories), facts, link, ticket line in obsidian */
  const s = B.s, x = B.x + B.pad, iw = B.w - 2 * B.pad, fs = Math.round(22 * s);
  const tlH = Math.round(tpx * 1.3), tlY = B.y + B.h - B.pad * 0.7 - tlH;
  let lx = x;
  if (a.qrUrl && L.fmt === '9:16') {
    const q = 132;
    I.fillRR(ctx, x, tlY + tlH - q, q, q, 8, C.cr); I.strokeRR(ctx, x, tlY + tlH - q, q, q, 8, 2, C.ob);
    I.drawQR(ctx, a.qrUrl, x + 10, tlY + tlH - q + 10, q - 20);
    T(ctx, 'SCAN FOR TICKETS', x + q + 24, tlY + tlH - q + 6, 18, { pin: 'B', size: 18, weight: 700, track: 0.14, fill: C.te, id: 'scan' });
    lx = x + q + 24;
  }
  const lw = x + iw - lx;
  const tl = I.ticketLine(ctx, lx, tlY, lw, tpx, C.ob);
  T(ctx, 'mangh.org/dmc-2026', lx, tlY - fs * 1.5, fs * 1.3, { pin: 'B', size: fs, weight: 600, fill: C.ob, id: 'url', limit: lw });
  factsLine(ctx, lx, tlY - fs * 3, fs, lw, K.MUTE);
  const b = drawBand(ctx, L);
  if (L.fmt === '9:16') storyTail(ctx);
  return [{ kind: 'mojopay', x: b.mojo.x, y: b.mojo.y, w: b.mojo.w, h: b.mojo.h, tile: b.mojo, colour: b.mojo.colour }, tl];
}
/* the bottom of the sheet that the footer reserves */
const footReserve = (L, B) => (L.fmt === 'land' ? B.pad : B.pad * 0.7 + Math.round(ticketPx(L.w) * 1.3) + Math.round(22 * B.s) * 3.2 + (L.fmt === '9:16' ? 40 : 10));

TPL.session = (ctx, L, f, a) => {
  const B = sheetBox(ctx, L);
  sheet(ctx, B.x, B.y, B.w, B.h);
  const s = B.s, x = B.x + B.pad, iw = B.w - 2 * B.pad, lab = Math.round(190 * s), vx = x + lab, vw = iw - lab;
  let y = sheetHead(ctx, x, B.y + B.pad * 0.9, iw, s, (f.time ? f.time.replace(/-/g, '–') : 'SAT 21.11.26'));
  const limit = B.y + B.h - footReserve(L, B);
  const rowPad = Math.round(16 * s), ls = Math.round(18 * s);
  /* THEME */
  const chipH = Math.round(42 * s);
  label(ctx, 'THEME', x, y + rowPad + (chipH - ls) / 2, ls);
  levelChip(ctx, vx, y + rowPad, f.movement, s);
  y += chipH + rowPad * 2; rule(ctx, x, y - 1, iw);
  /* SESSION */
  const names = (f.speakers || '').split(/\s*[·,]\s*/).map((n) => n.replace(/\s+—.*$/, '').trim()).filter(Boolean).slice(0, 6);
  const nameRows = Math.min(names.length, L.fmt === 'land' || L.fmt === '1:1' ? 3 : 6);
  const venueH = Math.round(34 * s) + rowPad * 2;
  const speakersH = names.length ? Math.round(nameRows * 34 * s * 1.2) + rowPad * 2 : 0;
  const titleRoom = limit - y - rowPad * 2 - venueH - speakersH;
  label(ctx, 'SESSION', x, y + rowPad + 6 * s, ls);
  const tb = block(ctx, f.title || 'Session title', vx, y + rowPad, { pin: 'B', weight: 800, base: Math.round(48 * s), min: Math.round(26 * s), maxW: vw, maxLines: 4, maxH: Math.max(40 * s, titleRoom), lh: 1.08, fill: C.ob, id: 'title' });
  y += tb.h + rowPad * 2; rule(ctx, x, y - 1, iw);
  /* SPEAKERS */
  if (names.length) {
    label(ctx, names.length > 1 ? 'SPEAKERS' : 'SPEAKER', x, y + rowPad + 6 * s, ls);
    const ns = Math.round(30 * s), nLH = Math.round(ns * 1.2 * 34 / 30);
    names.slice(0, nameRows).forEach((n, i) => {
      const more = i === nameRows - 1 && names.length > nameRows ? ' +' + (names.length - nameRows) : '';
      let t = n; while (t.length > 1 && W(ctx, t + more, 'B', ns, 600) > vw) t = t.slice(0, -2) + '…';
      T(ctx, t + more, vx, y + rowPad + i * nLH, nLH, { pin: 'B', size: ns, weight: 600, fill: C.ob, id: 'speaker' + i, limit: vw });
    });
    y += nameRows * nLH + rowPad * 2; rule(ctx, x, y - 1, iw);
  }
  /* VENUE */
  label(ctx, 'VENUE', x, y + rowPad + (34 * s - ls) / 2, ls);
  const cw = outlineChip(ctx, vx, y + rowPad, 'IN PERSON', s);
  T(ctx, 'British Council, Accra', vx + cw + 14 * s, y + rowPad, 34 * s, { pin: 'B', size: Math.round(26 * s), weight: 600, fill: C.ob, id: 'venue', limit: vw - cw - 14 * s });
  y += venueH; rule(ctx, x, y - 1, iw);
  return sheetFooter(ctx, L, B, a);
};

TPL.quote = (ctx, L, f, a) => {
  const B = sheetBox(ctx, L);
  sheet(ctx, B.x, B.y, B.w, B.h);
  const s = B.s, x = B.x + B.pad, iw = B.w - 2 * B.pad;
  let y = sheetHead(ctx, x, B.y + B.pad * 0.9, iw, s, 'IN THEIR WORDS');
  const limit = B.y + B.h - footReserve(L, B);
  /* attribution row at the bottom of the body: print, name, title, movement chip */
  const ph = a.photo ? Math.round((L.fmt === 'land' ? 150 : 200) * s) : 0, pw = Math.round(ph * 0.83);
  const attrH = Math.max(ph, Math.round(120 * s));
  const attrY = limit - attrH;
  /* the quote */
  const qm = Math.round(120 * s);
  T(ctx, '“', x - 4 * s, y + 10 * s, qm, { pin: 'D', size: qm, weight: 900, fill: C.go, id: 'quote-mark' });
  const qb = block(ctx, f.quote || 'Your quote goes here.', x, y + 10 * s + qm * 0.72, { pin: 'B', weight: 800, base: Math.round(56 * s), min: Math.round(26 * s), maxW: iw, maxLines: 8,
    maxH: attrY - (y + 10 * s + qm * 0.72) - 24 * s, lh: 1.14, fill: C.ob, id: 'quote' });
  rule(ctx, x, attrY - 14 * s, iw);
  let tx = x;
  if (a.photo) { print(ctx, a.photo, x + 6 * s, attrY + 4 * s, pw, ph - 8 * s, -3); tx = x + pw + 34 * s; }
  const tw = x + iw - tx;
  let ay = attrY + Math.max(0, (attrH - 120 * s) / 2);
  const ns = fitBlock(ctx, f.name || 'Speaker name', 'B', 800, Math.round(38 * s), Math.round(24 * s), tw, 1, 60 * s, 1.1).size;
  T(ctx, f.name || 'Speaker name', tx, ay, ns * 1.1, { pin: 'B', size: ns, weight: 800, fill: C.ob, id: 'qname', limit: tw });
  ay += ns * 1.1 + 4 * s;
  const sub = [f.title, f.company].filter(Boolean).join(', ');
  if (sub) ay += block(ctx, sub, tx, ay, { pin: 'B', weight: 500, base: Math.round(26 * s), min: Math.round(18 * s), maxW: tw, maxLines: 2, maxH: 64 * s, lh: 1.2, fill: K.DARK2, id: 'qtitle' }).h + 8 * s;
  if (f.movement && ay + 42 * s <= attrY + attrH) levelChip(ctx, tx, ay, f.movement, s * 0.8);
  return sheetFooter(ctx, L, B, a);
};

/* ---- Countdown: the number is the hero (expanded 900, Cream), DAYS TO GO in Coral, on the planes ---- */
function daysUntil(isoDate, now) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date(now || Date.now());
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())) / 86400000);
}
const daysToGo = (now) => daysUntil(EVENT_DAY, now);
function countdownWords(days) {
  if (days < 0) return null;
  if (days === 0) return { big: 'TODAY', unit: 'SAT 21 NOV · 10AM–3PM' };
  return { big: String(days), unit: days === 1 ? 'DAY TO GO' : 'DAYS TO GO' };
}
TPL.countdown = (ctx, L, f, a) => {
  const cw = countdownWords(daysToGo(a.now));
  ground(ctx, L); planes(ctx, L);
  const land = L.fmt === 'land', sq = L.fmt === '1:1';
  let y = masthead(ctx, L, false);
  const colW = land ? Math.round(L.w * 0.55) - L.pad : L.w - 2 * L.pad;
  const unitS = Math.round((land ? 64 : sq ? 70 : 84) * (land ? L.w / 1600 : 1));
  const tilesY = L.fmt === '9:16' ? 1004 : 846;
  const room = (land || sq ? L.bodyBottom - Math.round(L.head * 1.6) : tilesY - 36) - y - unitS * 1.25;
  let big = Math.round(room / 0.82);
  while (big > 60 && W(ctx, cw.big, 'D', big, 900, -0.02) > colW) big -= 4;
  const bLH = Math.round(big * 0.82);
  T(ctx, cw.big, L.pad - big * 0.03, y, bLH, { pin: 'D', size: big, weight: 900, track: -0.02, fill: C.cr, id: 'countdown-number', limit: colW });
  y += bLH + Math.round(unitS * 0.15);
  let us = unitS;
  while (us > 24 && W(ctx, cw.unit, 'D', us, 900, 0) > colW) us -= 2;
  T(ctx, cw.unit, L.pad, y, us * 1.05, { pin: 'D', size: us, weight: 900, fill: C.co, id: 'countdown-unit', limit: colW });
  y += us * 1.05 + Math.round(us * 0.4);
  if (land || sq) {
    const hs = Math.round(L.head * (sq ? 0.62 : 0.7));
    if (land) { headline(ctx, Math.round(L.w * 0.6) + L.pad * 0.5, L.top + L.pill.h + 10, Math.round(L.head * 0.9), 3); }
    else T(ctx, 'BUILT TO SCALE', L.pad, y, hs, { pin: 'D', size: hs * 0.85, weight: 900, fill: C.cr, id: 'bts', limit: colW });
    return landFooter(ctx, L, a, y + hs, colW);
  }
  /* 4:5 / 9:16: the date tiles of the flyer, the link (or QR on stories), the ticket line, the band */
  const tiles = [['DATE', 'Sat 21 Nov 2026'], ['TIME', '10AM – 3PM'], ['VENUE', 'British Council']];
  const ty = tilesY, tw = 300;
  tiles.forEach((t, i) => {
    const x = L.pad + i * (tw + 26);
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x, ty, tw, 68);
    ctx.fillStyle = 'rgba(201,162,74,.18)'; ctx.fillRect(x, ty, tw, 2);
    T(ctx, t[0], x + 18, ty + 11.5, 15, { pin: 'B', size: 15, weight: 700, track: 0.2, fill: 'rgba(244,239,230,.65)', id: 'tl-' + t[0] });
    T(ctx, t[1], x + 18, ty + 32.5, 26, { pin: 'B', size: 24, weight: 800, fill: C.cr, id: 'tv-' + t[0], limit: tw - 36 });
  });
  return pageFooter(ctx, L, a, ty + 68 + 30);
};
/* 4:5 / 9:16 footer for the non-Badge templates on obsidian: QR (stories with a link), url, ticket line, band */
function pageFooter(ctx, L, a, y) {
  const tpx = ticketPx(L.w) + 4, st = L.fmt === '9:16';
  let x = L.pad;
  if (a.qrUrl && st) {
    drawQR(ctx, a.qrUrl, L.pad, y, 132, 'SCAN', L.pad + 152);
    T(ctx, a.qrUrl.replace(/^https?:\/\//, ''), L.pad + 152, y + 72, 24, { pin: 'B', size: 22, weight: 600, fill: C.cr, id: 'url', limit: 760 });
    y += 132 + 20;
  } else {
    T(ctx, 'mangh.org/dmc-2026', x, y, 26, { pin: 'B', size: 24, weight: 700, fill: C.cr, id: 'url', limit: 600 });
    if (!st) T(ctx, '#DMC2026 · #BuiltToScale', x + 300, y + 2, 26, { pin: 'B', size: 22, weight: 600, fill: K.SOFT, id: 'tags', limit: 560 });
    y += 40;
  }
  const tl = I.ticketLine(ctx, L.pad, Math.min(y, (st ? 1356 : 1110) - 18 - Math.round(tpx * 1.3)), 600, tpx);
  const b = drawBand(ctx, L);
  if (st) storyTail(ctx);
  return [{ kind: 'mojopay', x: b.mojo.x, y: b.mojo.y, w: b.mojo.w, h: b.mojo.h, tile: b.mojo, colour: b.mojo.colour }, tl];
}

/* ---- Sponsor / partner: a flat white logo tile with a tier chip, on the planes. Facts only: name, logo, tier, role. ---- */
function tierChip(tier) {
  const t = String(tier || '');
  if (/gold|headline/i.test(t)) return { text: 'GOLD SPONSOR', sq: C.go };
  if (/silver/i.test(t)) return { text: 'SILVER SPONSOR', sq: K.SOFT };
  if (/cedar/i.test(t)) return { text: 'CEDAR SPONSOR', sq: C.te };
  return { text: (t || 'Partner').toUpperCase(), sq: C.co };
}
TPL.sponsor = (ctx, L, f, a) => {
  ground(ctx, L); planes(ctx, L);
  const land = L.fmt === 'land', sq = L.fmt === '1:1';
  let y = masthead(ctx, L, land, 2);
  const chip = tierChip(f.tier);
  /* tile geometry */
  let tx, ty, tw, th;
  if (land) { tw = Math.round(L.w * 0.4); th = Math.round(tw * 0.6); tx = L.w - tw - Math.round(L.w * 0.06); ty = Math.round((L.bodyBottom - th) / 2 + 10); }
  else if (sq) { tw = 560; th = 330; tx = L.w - tw - 56; ty = y - 30; }
  const chipH = land ? Math.round(36 * L.w / 1600) : 40;
  if (!land && !sq) { tw = 952; th = L.fmt === '9:16' ? 520 : 400; tx = 64; ty = y + chipH + 26; }
  if (sq) ty = Math.max(ty, L.top + chipH + 26);
  const cw = I.chipTag(ctx, tx, ty - chipH - 16, chipH, 14, 18, chip.text, chip.sq);
  void cw;
  I.fillRR(ctx, tx, ty, tw, th, 10, '#FFFFFF');
  if (a.logo) I.contain(ctx, a.logo, tx + tw * 0.12, ty + th * 0.16, tw * 0.76, th * 0.68);
  else block(ctx, f.name || 'Partner name', tx + tw / 2, ty + th / 2 - 40, { pin: 'D', weight: 900, base: 64, min: 28, maxW: tw * 0.8, maxLines: 2, maxH: 120, fill: C.ob, id: 'tile-name', align: 'center' });
  /* name, tier, role */
  const colX = land ? L.pad : (sq ? L.pad : 64), colW = land ? tx - L.pad - Math.round(L.w * 0.04) : (sq ? tx - L.pad - 30 : 952);
  let ny = land ? y : sq ? y + Math.max(0, 0) : ty + th + 40;
  if (sq) ny = y;
  const nb = block(ctx, f.name || 'Partner name', colX, ny, { pin: 'B', weight: 800, base: land ? Math.round(52 * L.w / 1600) : sq ? 44 : 64, min: 24, maxW: colW, maxLines: 2, maxH: sq ? 110 : 150, lh: 1.05, fill: C.cr, id: 'pname' });
  ny += nb.h + 10;
  if (f.tier) { ny += block(ctx, f.tier, colX, ny, { pin: 'B', weight: 700, base: land ? Math.round(28 * L.w / 1600) : sq ? 26 : 32, min: 16, maxW: colW, maxLines: 2, maxH: 80, lh: 1.2, fill: C.co, id: 'ptier' }).h + 6; }
  if (f.role) { ny += block(ctx, f.role, colX, ny, { pin: 'B', weight: 500, base: land ? Math.round(26 * L.w / 1600) : sq ? 24 : 30, min: 16, maxW: colW, maxLines: 2, maxH: 80, lh: 1.25, fill: 'rgba(244,239,230,.82)', id: 'prole' }).h; }
  if (land || sq) return landFooter(ctx, L, a, ny + 10, colW);
  return pageFooter(ctx, L, a, Math.max(ny + 26, L.fmt === '9:16' ? 1180 : 960));
};

/* ---------- entry point ---------- */
function dataUrlBuffer(s, maxBytes) {
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(s || '');
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  return buf.length && buf.length <= (maxBytes || 3 * 1024 * 1024) ? buf : null;
}
async function loadSiteImage(dir, file) {
  if (!/^[a-z0-9._-]+\.(webp|png|jpg|svg)$/i.test(file || '')) return null;
  const p = path.join(ROOT, 'assets', dir, file);
  if (!p.startsWith(path.join(ROOT, 'assets', dir)) || !fs.existsSync(p)) return null;
  return loadImage(fs.readFileSync(p));
}
const FIELD_LIMITS = { name: 60, title: 90, company: 70, role: 24, session: 90, time: 24, movement: 24, level: 12, quote: 260, tier: 60, partner: 40, speakers: 160, badge: 30 };
function normaliseFields(template, raw) {
  const f = {};
  Object.keys(FIELD_LIMITS).forEach((k) => { f[k] = clean(raw[k], FIELD_LIMITS[k]); });
  f.title = clean(raw.title, template === 'session' ? 120 : 90);
  f.role = clean(raw.role, template === 'sponsor' ? 90 : 24);
  if (!LEVEL_OF[f.movement]) f.movement = '';
  if (!FLY.LEVELS[f.level]) f.level = '';
  return f;
}

async function renderMeta(opts) {
  const template = opts.template;
  if (!TPL[template]) throw new Error('unknown template');
  const key = opts.size;
  if (!SIZES[key]) throw new Error('unknown size');
  if (template === 'countdown' && daysToGo(opts.now) < 0) throw new Error('unavailable: the countdown closed after DMC 2026 (21 November 2026)');
  const f = normaliseFields(template, opts.fields || {});
  const qrUrl = clean(opts.qrUrl, 120);
  if (qrUrl && !/^https:\/\/(www\.)?mangh\.org\/t\/[a-z0-9]{4,12}$/i.test(qrUrl) && !/^https?:\/\/localhost[:\d]*\/t\/[a-z0-9]{4,12}$/i.test(qrUrl) &&
      !/^https:\/\/[a-z0-9.-]+\.vercel\.app\/t\/[a-z0-9]{4,12}$/i.test(qrUrl)) throw new Error('bad qr url');
  await FLY.load();
  const L = layout(key);
  const canvas = createCanvas(L.w, L.h);
  const ctx = canvas.getContext('2d');
  const a = { now: opts.now, qrUrl };
  const pbuf = dataUrlBuffer(opts.photo);
  if (pbuf) a.photo = await loadImage(pbuf);
  else if (opts.sitePhoto) a.photo = await loadSiteImage('speakers', opts.sitePhoto);
  const lbuf = dataUrlBuffer(opts.logo);
  if (lbuf) a.logo = await loadImage(lbuf);
  else if (opts.partner) {
    const p = DATA.partners.find((x) => x.slug === opts.partner);
    if (p) a.logo = await loadSiteImage('partners26', p.logo);
  }
  const log = opts.debug ? [] : null;
  I.setLog(log);
  let placements;
  try { placements = await TPL[template](ctx, L, f, a); } finally { I.setLog(null); }
  return { png: canvas.toBuffer('image/png'), placements: placements.filter(Boolean), w: L.w, h: L.h, tall: L.fmt === '9:16', log, fontsOk: Object.assign({}, FLY.assets.fontsOk) };
}
async function render(opts) { return (await renderMeta(opts)).png; }

module.exports = { render, renderMeta, SIZES, TEMPLATES: Object.keys(TPL), daysToGo, countdownWords, DATA, C, FLY };
