/* DMC Live quote card maker. Source for assets/live-cards.js (built by tools/build-live-cards.js); the phone page loads that file
   only when someone taps "Make a quote card". Everything is drawn on a canvas on the phone: no card is uploaded, except a small
   downscaled preview of a "My takeaway" card that goes to the operator's moderation queue.

   Two card types, never mixed up:
     official   a line the team verified and published from the current session (carries the speaker's name, title and photo)
     takeaway   an attendee's own words, attributed to them ("— Ama, at DMC 2026"); the session and speakers appear only as
                context ("From: ... Discussion with ..."), never as the author of the words
   Three layouts (Bold, Portrait, Night) in two sizes (1080x1350, 1080x1920) that read as one set.
   Look (restyle, 14 Nov 2026): the participant flyers' and DMC Studio's. Ink ground with the website hero's planes (g1, g2 and the
   fade), the "DMC 2026 · ACCRA" pill and BUILT TO SCALE with the gold-foil italic SCALE, the kente tile, a chip for the card type,
   and the flyers' flat band at the foot: POWERED BY the MojoPay logo on the white tile with "Tickets exclusively on MojoLife",
   ORGANIZED BY M·A·N, IN PARTNERSHIP WITH the seven partners of assets/partners26/partners.json. Layouts: Bold is the Brief (the
   words on a cream sheet with gold hairlines), Portrait the photo hero, Night the words on ink. Every image, font and logo is
   embedded, so a card still draws with no connection. Gold is an accent only (tools/live-cards-check.js: under 3% of any card). */
import qrcode from 'qrcode-generator';
import { compile, hits } from '../../lib/live/filter-core.js';
import BASE_LIST from '../../lib/live/blocklist.txt';
import F_BLACK from './fonts/ArchivoExpanded-Black.woff2';
import F_XBOLD from './fonts/ArchivoExpanded-ExtraBold.woff2';
import F_BOLD from './fonts/Archivo-Bold.woff2';
import F_MED from './fonts/Archivo-Medium.woff2';
import F_NB from './fonts/NotoSans-B-subset.woff2';
import F_NM from './fonts/NotoSans-M-subset.woff2';
import F_SB from './fonts/Archivo-SemiBold.woff2';
import SP from '../../assets/sponsor/lockup.js';
import MOJOPAY_SVG from '../../assets/partners26/mojopay-logo-blue.svg';
import F_DI from '../../assets/flyer/fonts/archivo-di.woff2';
import KENTE_PNG from '../../assets/flyer/kente-strip-tile.png';
import MAN_PNG from './logos/man-logo.webp';
import PARTNERS from '../../assets/partners26/partners.json';
import L_FIDO from './logos/fido.webp';
import L_MNOTIFY from './logos/mnotify.webp';
import L_GENGH from './logos/generation-ghana.webp';
import L_KASAD3 from './logos/kasad3.webp';
import L_TECHLABARI from './logos/tech-labari.webp';
import L_KOIN from './logos/mista-koin.webp';
import L_JOBBERMAN from './logos/jobberman.webp';
/* logos of the shared partner list, card-sized copies (tools/live-cards/make-logos.js), embedded by file name (a partner added to the list needs its import here too) */
const LOGO_FILES = { 'fido.webp': L_FIDO, 'mnotify.webp': L_MNOTIFY, 'generation-ghana.webp': L_GENGH, 'kasad3.webp': L_KASAD3, 'tech-labari.webp': L_TECHLABARI, 'mista-koin.webp': L_KOIN, 'jobberman.webp': L_JOBBERMAN };

const OB = '#1C1C1C', CR = '#F4EFE6', TE = '#2A7B74', CO = '#D95F45', GO = '#C9A24A', INK = '#0D0D0D', SOFT = '#B9B4AB', MUTE = '#5A5650';
const TEXT_AC = { '#2A7B74': '#5C9890', '#D95F45': '#D95F45', '#F4EFE6': '#F4EFE6' };   /* an accent as text on ink (the flyers' lighter teal) */
const W = 1080, M = 72, STRIP = 44;
const SIZES = { '4x5': 1350, '9x16': 1920 };
const LAYOUTS = [{ id: 'bold', name: 'Bold' }, { id: 'portrait', name: 'Portrait' }, { id: 'night', name: 'Night' }];
const MAX = { official: 220, takeaway: 140 };
/* plain text on cards: emoji are full-colour pictures that differ per phone and sit outside the brand palette, so they are left off */
const PICTURES = /(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/* ---- fonts: embedded, so cards look the same with no connection. The letters Twi, Ewe and Hausa need (ɔ ɛ ɖ ʋ ŋ) come from a small Noto subset ---- */
const FACES = [['DMCA', '600', F_SB], ['DMCX', '900', F_BLACK], ['DMCX', '800', F_XBOLD], ['DMCA', '700', F_BOLD], ['DMCA', '500', F_MED], ['DMCN', '700', F_NB], ['DMCN', '500', F_NM], ['DMCXI', '900', F_DI]];
const XI = (px) => '900 ' + px + 'px DMCXI, DMCX, "Arial Black", Arial, sans-serif';
const X = (w, px) => w + ' ' + px + 'px DMCX, DMCN, "Arial Black", Arial, sans-serif';
const A = (w, px) => w + ' ' + px + 'px DMCA, DMCN, Arial, sans-serif';
/* the sponsor credit (Powered by MojoPay, Tickets exclusively on MojoLife): shared lockup and ticket line from assets/sponsor/, the official MojoPay SVG is embedded so the maker works offline */
const SP_FONT = (px, weight) => A(weight >= 700 ? 700 : 600, px);
const spImgs = {};
function loadSponsor() {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => { spImgs.mojopay = img; res(); };
    img.onerror = () => res();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SP.sizedSvg(MOJOPAY_SVG));
  });
}
const bandImgs = { logos: {} };
function img(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
function loadBand() {
  const jobs = [img(KENTE_PNG).then((i) => { bandImgs.kente = i; }), img(MAN_PNG).then((i) => { bandImgs.man = i; })];
  (PARTNERS.partners || []).forEach((p) => { if (LOGO_FILES[p.logo]) jobs.push(img(LOGO_FILES[p.logo]).then((i) => { bandImgs.logos[p.id] = i; })); });
  return Promise.all(jobs);
}
let fontsP = null;
function loadFonts() {
  if (fontsP) return fontsP;
  if (typeof FontFace === 'undefined' || !document.fonts) return (fontsP = Promise.all([loadSponsor(), loadBand()]));
  fontsP = Promise.all([loadSponsor(), loadBand()].concat(FACES.map((f) => new FontFace(f[0], 'url(data:font/woff2;base64,' + f[2] + ')', { weight: f[1] }).load().then((ff) => { document.fonts.add(ff); }, () => {})))).then(() => {});
  return fontsP;
}

/* ---- text filter: the embedded list is the floor; the live list from the server (with the operator's additions) replaces it when it arrives ---- */
let LIST = { words: compile(BASE_LIST.split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)) };
function refreshList() {
  try {
    const c = JSON.parse(localStorage.getItem('dmc_live_filter') || 'null');
    if (c && Array.isArray(c.words) && c.words.length) LIST = { words: c.words };
    if (c && Date.now() - c.at < 600000) return;
  } catch (e) { /* ignore */ }
  fetch('/api/live-state?view=filter').then((r) => r.ok ? r.json() : null).then((j) => {
    if (j && Array.isArray(j.words) && j.words.length) { LIST = { words: j.words }; try { localStorage.setItem('dmc_live_filter', JSON.stringify({ at: Date.now(), words: j.words })); } catch (e) { /* ignore */ } }
  }).catch(() => {});
}
const blocked = (text) => !!hits(text, LIST);

/* ---- drawing helpers ---- */
function wrap(ctx, text, maxW) {
  const lines = []; let cur = '';
  const width = (s) => ctx.measureText(s).width;
  text.split(' ').forEach((w) => {
    const t = cur ? cur + ' ' + w : w;
    if (width(t) <= maxW) { cur = t; return; }
    if (cur) { lines.push(cur); cur = ''; }
    if (width(w) <= maxW) { cur = w; return; }
    let chunk = '';
    Array.from(w).forEach((ch) => { if (chunk && width(chunk + ch) > maxW) { lines.push(chunk); chunk = ch; } else chunk += ch; });
    cur = chunk;
  });
  if (cur) lines.push(cur);
  return lines;
}
/* the largest font size in [min, max] at which the wrapped text fits the box; at the minimum, anything left over is cut with an ellipsis */
function fit(ctx, text, font, box, min, max, lh) {
  let lo = min, hi = max, best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    ctx.font = font(mid);
    const lines = wrap(ctx, text, box.w);
    if (lines.length * mid * lh <= box.h) { best = { size: mid, lines }; lo = mid + 1; } else hi = mid - 1;
  }
  if (best) return best;
  ctx.font = font(min);
  let lines = wrap(ctx, text, box.w);
  const cap = Math.max(1, Math.floor(box.h / (min * lh)));
  if (lines.length > cap) {
    lines = lines.slice(0, cap);
    let last = lines[cap - 1];
    while (last && ctx.measureText(last + '…').width > box.w) last = last.slice(0, -1).trimEnd();
    lines[cap - 1] = last + '…';
  }
  return { size: min, lines, cut: true };
}
/* one line, shrunk to fit the width, then cut with an ellipsis */
function oneLine(ctx, text, font, w, max, min) {
  for (let s = max; s >= min; s -= 1) { ctx.font = font(s); if (ctx.measureText(text).width <= w) return { size: s, text }; }
  ctx.font = font(min);
  let t = text;
  while (t && ctx.measureText(t + '…').width > w) t = t.slice(0, -1).trimEnd();
  return { size: min, text: t + '…' };
}
function spaced(ctx, text, x, y, gap, align) {
  const chars = Array.from(text);
  const total = chars.reduce((n, c) => n + ctx.measureText(c).width + gap, -gap);
  let cx = align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  chars.forEach((c) => { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + gap; });
  return total;
}
function kente(ctx, x, y, w, h) {
  const k = bandImgs.kente;
  if (k) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); const s = h / k.height; for (let cx = x; cx < x + w; cx += k.width * s) ctx.drawImage(k, cx, y, k.width * s, h); ctx.restore(); return; }
  ctx.fillStyle = OB; ctx.fillRect(x, y, w, h);
  const cols = [GO, TE, CO, CR]; const bh = Math.round(h * 0.5); const by = y + Math.round((h - bh) / 2);
  for (let i = 0, cx = x + 6; cx < x + w; i++, cx += 60) { ctx.fillStyle = cols[i % 4]; ctx.fillRect(cx, by, Math.min(54, x + w - cx), bh); }
}
/* the website hero's planes: g1 (teal) and g2 (coral), then the fade to ink */
function planes(ctx, x, y, w, h) {
  const P = (pts) => { ctx.beginPath(); pts.forEach((q, i) => { const X2 = x + q[0] / 100 * w, Y2 = y + q[1] / 100 * h; if (i) ctx.lineTo(X2, Y2); else ctx.moveTo(X2, Y2); }); ctx.closePath(); };
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalAlpha = 0.85; ctx.fillStyle = TE; P([[35, 0], [100, 0], [100, 55], [10, 0]]); ctx.fill();
  ctx.globalAlpha = 0.80; ctx.fillStyle = CO; P([[20, 0], [100, 40], [100, 75], [0, 95]]); ctx.fill();
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, INK); g.addColorStop(0.5, 'rgba(13,13,13,.6)'); g.addColorStop(1, 'rgba(13,13,13,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function foil(ctx, x, w) { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, GO); g.addColorStop(0.3, '#F5D87A'); g.addColorStop(0.55, GO); g.addColorStop(0.78, '#9E7520'); g.addColorStop(1, GO); return g; }
/* the pill: border, gold dot, tracked label */
function pill(ctx, x, y, h) {
  ctx.font = A(600, Math.round(h * 0.42)); const tw = spacedW(ctx, 'DMC 2026 · ACCRA', 4), w = h * 0.5 + 12 + 14 + tw + h * 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = GO; circle(ctx, x + h * 0.5 + 6, y + h / 2, 6); ctx.fill();
  ctx.fillStyle = 'rgba(244,239,230,.72)'; spaced(ctx, 'DMC 2026 · ACCRA', x + h * 0.5 + 26, y + h / 2 + h * 0.15, 4);
  return w;
}
function spacedW(ctx, text, gap) { let w = 0; for (const c of text) w += ctx.measureText(c).width + gap; return w - gap; }
/* a black pill with a square in the movement colour and a cream label (the flyers' chip) */
function chip(ctx, x, y, h, label, sq) {
  ctx.font = X(800, Math.round(h * 0.4)); const tw = spacedW(ctx, label, 4), w = 18 + 12 + 12 + tw + 22;
  ctx.fillStyle = OB; rr(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = sq; ctx.fillRect(x + 18, y + (h - 12) / 2, 12, 12);
  ctx.fillStyle = CR; spaced(ctx, label, x + 42, y + h / 2 + h * 0.15, 4);
  return w;
}
function circle(ctx, cx, cy, r) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); }
function cover(ctx, img, x, y, w, h, focusY) {
  const r = Math.max(w / img.width, h / img.height); const sw = w / r, sh = h / r;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * (focusY == null ? 0.25 : focusY), sw, sh, x, y, w, h);
}
const initials = (n) => { const w = String(n || '').split(' ').filter(Boolean); return ((w[0] || '')[0] || '') + (w.length > 1 ? w[w.length - 1][0] : ''); };

/* ---- what goes on a card ---- */
function sponsorFree(speakers) { return (speakers || []).filter((p) => !p.sponsor).map((p) => p.name); }
function words(list) { return list.length <= 1 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
function describe(spec) {
  const s = spec.session || {};
  if (spec.type === 'official') {
    const sp = spec.speaker || {};
    return {
      label: 'OFFICIAL QUOTE',
      l1: sp.name || '',
      l2: [sp.title, sp.company].filter((x) => x && (x !== sp.title || !sp.company || sp.title.indexOf(sp.company) < 0)).join(', '),
      l3: [s.format, s.title].filter(Boolean).join(' · '),
      avatar: sp.name || ''
    };
  }
  /* speakers appear only as context for a takeaway, and a sponsor's representative is never named on one */
  const names = sponsorFree(s.speakers);
  return {
    label: 'MY TAKEAWAY',
    l1: '— ' + (spec.name || 'Someone') + ', at DMC 2026',
    l2: 'From: ' + [s.movement, s.format].filter(Boolean).join(' · ') + (names.length ? ' with ' + words(names) : ''),
    l3: s.title || '',
    avatar: spec.name || ''
  };
}

/* ---- the card ---- */
function render(canvas, spec) {
  const H = SIZES[spec.size] || SIZES['4x5'];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const d = describe(spec);
  const tall = H > 1500;
  const layout = spec.layout || 'bold';
  const accent = spec.accent || TE;
  const acText = TEXT_AC[accent] || CR;
  const sheet = layout === 'bold';                    /* Bold is the Brief: the words on a cream sheet */
  const placements = [];
  const out = { fits: true, lines: 0, size: 0, placements };
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

  /* ---- the band at the foot (the flyers'): kente, POWERED BY + MojoPay (white tile) + ticket line, ORGANIZED BY M·A·N, the partners ---- */
  const tileW = Math.max(SP.minTileW(W, tall), Math.round(W * (tall ? 0.23 : 0.17)));
  const sg = SP.geometry(tileW), lockH = Math.ceil(sg.tileH + sg.labelPx * 1.2 + sg.gapStacked);
  const qrRow = tall && spec.qr ? 172 : 0;
  const tilesH = tall ? 58 : 52, bandH = 22 + lockH + 22 + 20 + 10 + tilesH + (tall ? 40 : 30) + qrRow;
  const bandTop = H - bandH, kenteY = bandTop - 24;

  /* ---- ground, planes, header ---- */
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  planes(ctx, W * 0.42, 0, W * 0.58, kenteY);
  let top = 52;
  if (spec.rehearsal) {
    ctx.fillStyle = CO; ctx.fillRect(0, 0, W, 64);
    ctx.fillStyle = OB; ctx.font = X(900, 28); ctx.textAlign = 'center'; ctx.fillText('REHEARSAL · NOT A REAL ' + (spec.type === 'official' ? 'QUOTE' : 'CARD'), W / 2, 43); ctx.textAlign = 'left';
    top += 64;
  }
  const pw = pill(ctx, M, top, 52);
  ctx.font = X(900, 30); ctx.fillStyle = CR; const bt = 'BUILT TO '; ctx.fillText(bt, M + pw + 30, top + 37);
  const bw = ctx.measureText(bt).width; ctx.font = XI(30); const sw = ctx.measureText('SCALE').width;
  ctx.fillStyle = foil(ctx, M + pw + 30 + bw, sw); ctx.fillText('SCALE', M + pw + 30 + bw, top + 37);
  top += 52 + 34;

  /* ---- hero (Portrait): the photo for an official quote, a movement panel otherwise ---- */
  let heroH = 0;
  if (layout === 'portrait') {
    heroH = tall ? 700 : 360;
    const hy = top;
    ctx.save(); ctx.beginPath(); ctx.rect(M, hy, W - 2 * M, heroH); ctx.clip();
    if (spec.type === 'official' && spec.photo) cover(ctx, spec.photo, M, hy, W - 2 * M, heroH, 0.18);
    else {
      ctx.fillStyle = OB; ctx.fillRect(M, hy, W - 2 * M, heroH);
      ctx.fillStyle = spec.type === 'official' ? accent : 'rgba(201,162,74,.85)'; ctx.font = X(900, tall ? 420 : 300); ctx.textBaseline = 'top';
      ctx.fillText(spec.type === 'official' ? initials(d.avatar).toUpperCase() : '“', M + 30, hy - (spec.type === 'official' ? 10 : 50)); ctx.textBaseline = 'alphabetic';
      const mv = spec.session && spec.session.movement ? spec.session.movement.toUpperCase() : 'DMC 2026';
      const f = fit(ctx, mv, (p) => X(900, p), { w: W - 2 * M - 60, h: tall ? 190 : 130 }, 40, 88, 1.05);
      ctx.fillStyle = CR; ctx.font = X(900, f.size); f.lines.forEach((ln, i) => ctx.fillText(ln, M + 30, hy + heroH - 40 - (f.lines.length - 1 - i) * f.size * 1.05));
    }
    ctx.restore();
    /* print gloss on the photo: a soft 135° sheen and a light top edge */
    const g = ctx.createLinearGradient(M, hy, M + (W - 2 * M + heroH) / 2, hy + (W - 2 * M + heroH) / 2);
    g.addColorStop(0.62, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,.12)'); g.addColorStop(0.78, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(M, hy, W - 2 * M, heroH); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(M, hy, W - 2 * M, 1);
    top = hy + heroH + 34;
  }

  /* ---- the body: a cream sheet (Bold) or the ink itself (Portrait, Night) ---- */
  const sx = sheet ? 40 : 0, sy = top - (sheet ? 8 : 0), sW = sheet ? W - 80 : W, sH = kenteY - 36 - sy;
  if (sheet) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.52)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; ctx.fillStyle = CR; rr(ctx, sx, sy, sW, sH, 6); ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx, sx, sy, sW, sH, 6); ctx.clip();
    const g = ctx.createLinearGradient(sx, sy, sx + (sW + sH) / 2, sy + (sW + sH) / 2);
    g.addColorStop(0.06, 'rgba(255,255,255,0)'); g.addColorStop(0.22, 'rgba(255,255,255,.14)'); g.addColorStop(0.38, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(sx, sy, sW, sH); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(sx, sy, sW, 1); ctx.restore();
  }
  const fg = sheet ? OB : CR, sub = sheet ? '#3A3A3A' : 'rgba(244,239,230,.82)';
  const ix = sheet ? sx + 48 : M, iw = sheet ? sW - 96 : W - 2 * M;
  /* chip: the card type */
  const cy0 = sy + (sheet ? 40 : 0);
  chip(ctx, ix, cy0, 46, d.label, accent);

  /* attribution, anchored at the bottom of the body */
  const AV = 132, AH = 140;
  const ay = sy + sH - (sheet ? 36 : 4) - AH;
  const hasAvatar = layout !== 'portrait';
  const tx = ix + (hasAvatar ? AV + 30 : 0), tw = ix + iw - tx;
  if (hasAvatar) {
    const cx = ix + AV / 2, cy = ay + AH / 2;
    ctx.fillStyle = sheet ? CR : INK; circle(ctx, cx, cy, AV / 2 + 10); ctx.fill();
    ctx.fillStyle = GO; circle(ctx, cx, cy, AV / 2 + 6); ctx.fill();
    ctx.save(); circle(ctx, cx, cy, AV / 2); ctx.clip();
    if (spec.type === 'official' && spec.photo) cover(ctx, spec.photo, cx - AV / 2, cy - AV / 2, AV, AV, 0.15);
    else {
      ctx.fillStyle = OB; ctx.fillRect(cx - AV / 2, cy - AV / 2, AV, AV);
      ctx.fillStyle = CR; ctx.font = X(900, 54); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(initials(d.avatar).toUpperCase() || '·', cx, cy + 4); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }
  const n1 = oneLine(ctx, d.l1, (p) => A(700, p), tw, 38, 22);
  ctx.fillStyle = fg; ctx.font = X(900, Math.min(n1.size, 36)); const n1b = oneLine(ctx, d.l1, (p) => X(900, p), tw, 36, 20); ctx.font = X(900, n1b.size); ctx.fillText(n1b.text, tx, ay + 40);
  const n2 = oneLine(ctx, d.l2, (p) => A(700, p), tw, 28, 18);
  ctx.fillStyle = sheet ? TE : acText; ctx.font = A(700, n2.size); ctx.fillText(n2.text, tx, ay + 40 + 44);
  const n3 = oneLine(ctx, d.l3, (p) => A(500, p), tw, 26, 18);
  ctx.fillStyle = sub; ctx.font = A(500, n3.size); ctx.fillText(n3.text, tx, ay + 40 + 44 + 38);
  /* gold hairline above the attribution */
  ctx.fillStyle = GO; ctx.fillRect(ix, ay - 28, iw, 2);
  void n1;

  /* the words: quote mark (gold), then the text fitted to the room left */
  const qy = cy0 + 46 + 26;
  const qSize = layout === 'portrait' ? 0 : (tall ? 200 : 170);
  if (qSize) { ctx.font = X(900, qSize); ctx.textBaseline = 'top'; const qw = ctx.measureText('“').width; ctx.fillStyle = sheet ? GO : foil(ctx, ix - 6, qw); ctx.fillText('“', ix - 6, qy - qSize * 0.08); ctx.textBaseline = 'alphabetic'; }
  const barW = layout === 'night' ? 14 : 0;
  const bx = ix + (barW ? barW + 30 : 0);
  const ty = qy + (qSize ? qSize * 0.58 : 6);
  const box = { w: ix + iw - bx, h: ay - 28 - 30 - ty };
  const lim = layout === 'portrait' ? [32, tall ? 104 : 80] : [36, tall ? 150 : 128];   /* short lines grow to fill the sheet */
  const body = String(spec.text || '');
  const f = fit(ctx, body, (p) => X(800, p), box, lim[0], lim[1], 1.17);
  ctx.font = X(800, f.size);
  const lh = f.size * 1.17, textH = f.lines.length * lh;
  const y0 = ty + Math.max(0, Math.min(40, (box.h - textH) / 2 * 0.5));
  if (barW) { ctx.fillStyle = accent; ctx.fillRect(ix, y0 - 2, barW, textH + 8); }
  ctx.fillStyle = fg;
  f.lines.forEach((ln, i) => ctx.fillText(ln, bx, y0 + f.size * 0.95 + i * lh));
  out.size = f.size; out.lines = f.lines.length; out.fits = !f.cut; out.box = box;

  /* ---- the band ---- */
  kente(ctx, 0, kenteY, W, 24);
  ctx.fillStyle = OB; ctx.fillRect(0, bandTop, W, bandH);
  const ry = bandTop + 22;
  const spOpts = { variant: 'stacked', tileW, images: spImgs, font: SP_FONT, tileColour: '#FFFFFF' };
  const pay = SP.draw(ctx, Object.assign({ kind: 'mojopay', x: M, y: ry }, spOpts));
  placements.push(pay);
  const lb = SP.measureTicketLine(ctx, { tileW, font: SP_FONT });
  const manH = Math.round(sg.tileH * 0.82), manW = bandImgs.man ? Math.round(manH * bandImgs.man.width / bandImgs.man.height) : 0;
  const orgX = W - M - manW;
  /* ticket line between the MojoPay tile and the M·A·N block (stacked to two lines if the row is tight) */
  placements.push(SP.drawTicketLine(ctx, { x: M + pay.w + 34, y: ry, tileW, variant: 'stacked', font: SP_FONT, colour: CR, lines: (M + pay.w + 34 + lb.w + 30 < orgX - 160) ? 1 : 2 }));
  ctx.font = A(700, Math.round(sg.labelPx)); ctx.fillStyle = 'rgba(244,239,230,.62)'; spaced(ctx, 'ORGANIZED BY', orgX, ry + sg.labelPx * 0.95, Math.round(sg.labelPx * 0.18));
  if (bandImgs.man) ctx.drawImage(bandImgs.man, orgX, pay.tile.y + (sg.tileH - manH) / 2, manW, manH);
  /* IN PARTNERSHIP WITH + the tiles */
  const ly2 = ry + lockH + 22;
  ctx.font = A(700, 18); ctx.fillStyle = SOFT; spaced(ctx, 'IN PARTNERSHIP WITH', M, ly2 + 15, 3);
  const list = (PARTNERS.partners || []), n = list.length, gap = 12, tW = n ? Math.floor((W - 2 * M - (n - 1) * gap) / n) : 0, tY = ly2 + 30;
  list.forEach((p, i) => {
    const x = M + i * (tW + gap); ctx.fillStyle = '#FFFFFF'; rr(ctx, x, tY, tW, tilesH, 6); ctx.fill();
    const im = bandImgs.logos[p.id];
    if (im) { const k = tilesH / 58, px2 = Math.min(p.pad[1] * k, tW * 0.1), py2 = p.pad[0] * k, s2 = Math.min((tW - 2 * px2) / im.width, (tilesH - 2 * py2) / im.height); ctx.drawImage(im, x + (tW - im.width * s2) / 2, tY + (tilesH - im.height * s2) / 2, im.width * s2, im.height * s2); }
    else { ctx.fillStyle = OB; ctx.font = A(700, 14); ctx.textAlign = 'center'; ctx.fillText(p.name, x + tW / 2, tY + tilesH / 2 + 5); ctx.textAlign = 'left'; }
  });
  /* tall: the QR on its own row at the foot of the band, with the link (the caption carries it on the other size) */
  if (qrRow) {
    const q = qrcode(0, 'M'); q.addData(spec.qr); q.make();
    const nq = q.getModuleCount(); const cell = Math.max(3, Math.floor(140 / (nq + 4))), side = cell * (nq + 4);
    const qx = M, qyy = tY + tilesH + 24;
    ctx.fillStyle = CR; ctx.fillRect(qx, qyy, side, side); ctx.fillStyle = OB;
    for (let r = 0; r < nq; r++) for (let c = 0; c < nq; c++) if (q.isDark(r, c)) ctx.fillRect(qx + (c + 2) * cell, qyy + (r + 2) * cell, cell, cell);
    ctx.font = A(700, 20); ctx.fillStyle = SOFT; spaced(ctx, 'SCAN FOR TICKETS', qx + side + 28, qyy + 46, 3);
    ctx.font = A(700, 30); ctx.fillStyle = CR; ctx.fillText(String(spec.qr).replace(/^https?:\/\//, ''), qx + side + 28, qyy + 92);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  return out;
}

/* ---- captions ---- */
function captionFor(spec, link) {
  const tags = '#DMC2026 #BuiltToScale';
  const s = spec.session || {};
  if (spec.type === 'official') {
    const sp = spec.speaker || {};
    const who = sp.name + (sp.handle ? ' (' + (sp.handle.charAt(0) === '@' ? sp.handle : '@' + sp.handle) + ')' : '');
    return '“' + spec.text + '” — ' + who + (sp.title ? ', ' + sp.title : '') + ', at DMC 2026.\n\n' + tags + '\nTickets exclusively on MojoLife \u00b7 ' + link;
  }
  return 'My takeaway from DMC 2026' + (s.movement ? ' (' + s.movement + ')' : '') + ': “' + spec.text + '”\n\n' + tags + '\nTickets exclusively on MojoLife \u00b7 ' + link;
}

/* ---- the maker: a full-screen sheet on the phone page ---- */
const CSS = `
#dmcm{position:fixed;inset:0;z-index:50;background:#1C1C1C;color:#F4EFE6;overflow-y:auto;-webkit-overflow-scrolling:touch;font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#dmcm *{box-sizing:border-box}
#dmcm .in{max-width:560px;margin:0 auto;padding:0 16px 120px}
#dmcm .bar{position:sticky;top:0;z-index:2;background:#1C1C1C;display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:2px solid #F4EFE6;max-width:none}
#dmcm .bar h2{font:900 18px/1.2 "Archivo Black",system-ui,sans-serif;margin:0;flex:1}
#dmcm button,#dmcm select,#dmcm textarea,#dmcm input{font:inherit;color:inherit}
#dmcm .x{min-width:48px;min-height:48px;background:none;border:2px solid #F4EFE6;color:#F4EFE6;font-size:22px;cursor:pointer}
#dmcm .pv{margin:14px auto 6px;display:flex;justify-content:center}
#dmcm canvas{display:block;max-width:100%;max-height:44vh;width:auto;height:auto;border:2px solid rgba(244,239,230,.35);background:#000}
#dmcm label,#dmcm legend{display:block;font-weight:700;margin:14px 0 6px;font-size:15px;padding:0}
#dmcm fieldset{border:0;margin:0;padding:0;min-width:0}
#dmcm textarea,#dmcm select,#dmcm input[type=text]{width:100%;min-height:48px;padding:10px 12px;background:#262626;border:2px solid rgba(244,239,230,.5);border-radius:0}
#dmcm textarea{min-height:92px;resize:vertical}
#dmcm .seg{display:flex;flex-wrap:wrap;gap:8px}
#dmcm .seg label{margin:0;flex:1 1 90px;position:relative}
#dmcm .seg input{position:absolute;opacity:0;inset:0;width:100%;height:100%;margin:0;cursor:pointer}
#dmcm .seg span{display:flex;align-items:center;justify-content:center;min-height:48px;padding:6px 10px;border:2px solid rgba(244,239,230,.5);font-weight:700;text-align:center}
#dmcm .seg input:checked+span{background:#F4EFE6;color:#1C1C1C;border-color:#F4EFE6}
#dmcm .seg input:focus-visible+span{outline:3px solid #F4EFE6;outline-offset:2px}
#dmcm .hint{font-size:14px;opacity:.85;margin:6px 0}
#dmcm .quotes{list-style:none;margin:0;padding:0;display:grid;gap:8px}
#dmcm .quotes label{margin:0;display:block;position:relative}
#dmcm .quotes input{position:absolute;opacity:0;inset:0;width:100%;height:100%;margin:0;cursor:pointer}
#dmcm .quotes span{display:block;text-align:left;font-weight:500;padding:10px 12px;min-height:48px;border:2px solid rgba(244,239,230,.5)}
#dmcm .quotes small{display:block;opacity:.85;font-weight:700;margin-top:4px}
#dmcm .quotes input:checked+span{background:#F4EFE6;color:#1C1C1C;border-color:#F4EFE6}
#dmcm .quotes input:focus-visible+span{outline:3px solid #F4EFE6;outline-offset:2px}
#dmcm .acts{position:fixed;left:0;right:0;bottom:0;background:linear-gradient(transparent,#1C1C1C 30%);padding:18px 16px calc(12px + env(safe-area-inset-bottom));display:flex;gap:10px;justify-content:center;z-index:3}
#dmcm .acts button{flex:1;max-width:260px;min-height:52px;font-weight:800;border:2px solid #F4EFE6;background:#F4EFE6;color:#1C1C1C;cursor:pointer}
#dmcm .acts button.sec{background:#1C1C1C;color:#F4EFE6}
#dmcm .acts button:disabled{opacity:.45;cursor:default}
#dmcm .sm{min-height:48px;padding:8px 14px;border:2px solid #F4EFE6;background:none;font-weight:700;cursor:pointer;margin-top:8px}
#dmcm .msg{min-height:22px;font-weight:700;margin:8px 0}
#dmcm button:focus-visible,#dmcm textarea:focus-visible,#dmcm select:focus-visible,#dmcm input:focus-visible{outline:3px solid #F4EFE6;outline-offset:2px}
`;

function el(tag, attrs) {
  const e = document.createElement(tag);
  Object.keys(attrs || {}).forEach((k) => { if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]); else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]); });
  for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
  return e;
}
const imgCache = {};
function loadImg(url) {
  if (!url) return Promise.resolve(null);
  if (!imgCache[url]) imgCache[url] = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
  return imgCache[url];
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
};
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

function open(o) {
  if (document.getElementById('dmcm')) return;
  refreshList();
  const prev = document.activeElement;
  const st = o.state || {};
  let sessions = st.now ? [st.now] : [];
  let quotes = st.quotes || [];
  const first = o.quoteId ? quotes.find((q) => q.id === o.quoteId) : null;
  const S = { type: first ? 'official' : 'takeaway', layout: store.get('dmc_live_layout', 'bold'), size: store.get('dmc_live_size', '4x5'), session: (first && first.session) || (st.now && st.now.id) || '', quote: first ? first.id : '', text: '', name: o.name || '' };
  const links = store.get('dmc_live_links', {});
  const sent = store.get('dmc_live_tk', {});
  let linkWait = null, drawTimer = 0, seq = 0;

  const style = el('style', { text: CSS });
  const root = el('div', { id: 'dmcm', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dmcm-h' });
  const close = () => { document.removeEventListener('keydown', onKey); root.remove(); style.remove(); if (prev && prev.focus) prev.focus(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  const canvas = el('canvas', { role: 'img', 'aria-label': 'Preview of your quote card' });
  const tabs = el('fieldset', { class: 'seg-wrap' }, el('legend', { text: 'Card type' }));
  const segT = el('div', { class: 'seg' });
  [['takeaway', 'My takeaway'], ['official', 'Official quote']].forEach((t) => {
    const i = el('input', { type: 'radio', name: 'dmcm-type', value: t[0], checked: S.type === t[0] ? 'checked' : false });
    i.addEventListener('change', () => { S.type = t[0]; sync(); });
    segT.appendChild(el('label', null, i, el('span', { text: t[1] })));
  });
  tabs.appendChild(segT);

  const sel = el('select', { id: 'dmcm-s' });
  sel.addEventListener('change', () => { S.session = sel.value; S.quote = ''; sync(); });
  const nameIn = el('input', { type: 'text', id: 'dmcm-n', maxlength: 30, autocomplete: 'given-name', autocapitalize: 'words', value: S.name });
  nameIn.addEventListener('input', () => { S.name = nameIn.value.replace(/\s+/g, ' ').trim().split(' ')[0]; if (S.name) o.setName(S.name); draw(); });
  const ta = el('textarea', { id: 'dmcm-t', maxlength: MAX.takeaway, 'aria-describedby': 'dmcm-c', placeholder: 'The one thing you will take away…' });
  const cnt = el('div', { class: 'hint', id: 'dmcm-c', text: MAX.takeaway + ' characters left' });
  ta.addEventListener('input', () => { S.text = ta.value; cnt.textContent = (MAX.takeaway - ta.value.length) + ' characters left'; draw(); });
  const qlist = el('ul', { class: 'quotes', 'aria-label': 'Official quotes from this session' });
  const takeaway = el('div', null, el('label', { for: 'dmcm-t', text: 'Your takeaway' }), ta, cnt, el('label', { for: 'dmcm-n', text: 'Your first name' }), nameIn);
  const official = el('div', null, el('div', { class: 'hint', text: 'Quotes the DMC team has checked with the speaker.' }), qlist);

  const mk = (name, legend, items, cur, onpick) => {
    const seg = el('div', { class: 'seg' });
    items.forEach((it) => {
      const i = el('input', { type: 'radio', name, value: it.id, checked: cur === it.id ? 'checked' : false });
      i.addEventListener('change', () => onpick(it.id));
      seg.appendChild(el('label', null, i, el('span', { text: it.name })));
    });
    return el('fieldset', null, el('legend', { text: legend }), seg);
  };
  const styleSet = mk('dmcm-l', 'Style', LAYOUTS, S.layout, (v) => { S.layout = v; store.set('dmc_live_layout', v); draw(); });
  const sizeSet = mk('dmcm-z', 'Size', [{ id: '4x5', name: 'Post 4:5' }, { id: '9x16', name: 'Story 9:16' }], S.size, (v) => { S.size = v; store.set('dmc_live_size', v); draw(); });
  const msg = el('div', { class: 'msg', role: 'status', 'aria-live': 'polite' });
  const cap = el('textarea', { id: 'dmcm-cap', 'aria-label': 'Caption', rows: 4 });
  const bShare = el('button', { type: 'button', text: 'Share' });
  const bSave = el('button', { type: 'button', class: 'sec', text: 'Save image' });
  const bCopy = el('button', { type: 'button', class: 'sm', text: 'Copy caption' });
  root.append(
    el('div', { class: 'bar' }, el('h2', { id: 'dmcm-h', text: 'Quote card' }), el('button', { type: 'button', class: 'x', 'aria-label': 'Close the card maker', text: '✕', onclick: close })),
    el('div', { class: 'in' }, el('div', { class: 'pv' }, canvas), msg, tabs, el('label', { for: 'dmcm-s', text: 'Session' }), sel, takeaway, official, styleSet, sizeSet,
      el('label', { for: 'dmcm-cap', text: 'Caption (add or change anything)' }), cap, bCopy),
    el('div', { class: 'acts' }, bSave, bShare)
  );
  document.head.appendChild(style); document.body.appendChild(root);
  root.querySelector('.x').focus();

  const sessionObj = () => sessions.find((s) => s.id === S.session) || sessions[0] || null;
  const sessionQuotes = () => quotes.filter((q) => q.session === S.session);
  function fillSessions() {
    sel.textContent = '';
    sessions.forEach((s) => sel.appendChild(el('option', { value: s.id, text: (s.start ? s.start + ' · ' : '') + s.title })));
    if (!sessions.some((s) => s.id === S.session) && sessions[0]) S.session = sessions[0].id;
    sel.value = S.session;
  }
  function fillQuotes() {
    qlist.textContent = '';
    const qs = sessionQuotes();
    if (!qs.length) { qlist.appendChild(el('li', null, el('div', { class: 'hint', text: 'No official quotes for this session yet. The team posts them as they are confirmed. Try “My takeaway” in the meantime.' }))); S.quote = ''; return; }
    if (!qs.some((q) => q.id === S.quote)) S.quote = qs[0].id;
    qs.forEach((q) => {
      const i = el('input', { type: 'radio', name: 'dmcm-q', value: q.id, checked: S.quote === q.id ? 'checked' : false });
      i.addEventListener('change', () => { S.quote = q.id; draw(); });
      qlist.appendChild(el('li', null, el('label', null, i, el('span', { class: 'qq' }, '“' + q.text + '”', el('small', { text: q.speaker.name })))));
    });
  }
  function sync() {
    takeaway.hidden = S.type !== 'takeaway'; official.hidden = S.type !== 'official';
    if (S.type === 'official') fillQuotes();
    draw(); wantLink();
  }
  function spec() {
    const s = sessionObj();
    const base = { type: S.type, layout: S.layout, size: S.size, session: s, accent: s ? s.accent : TE, ink: s ? s.ink : '#FFFFFF', rehearsal: !!st.rehearsal, name: S.name };
    if (S.type === 'official') {
      const q = sessionQuotes().find((x) => x.id === S.quote);
      return Object.assign(base, { text: q ? q.text : '', speaker: q ? q.speaker : null, ok: !!q });
    }
    const t = S.text.replace(PICTURES, '').replace(/\s+/g, ' ').trim();
    return Object.assign(base, { text: t, ok: t.length >= 3 && !!S.name });
  }
  const linkKey = () => S.session + '|' + S.type;
  const fallbackLink = () => location.origin + '/dmc-2026';
  function wantLink() {
    const key = linkKey();
    if (links[key] || !S.session) return Promise.resolve(links[key] || fallbackLink());
    return o.post({ t: 'link', session: S.session, ct: S.type }, 3000).then((r) => {
      if (r.status === 200 && r.body && r.body.url) { links[key] = r.body.url; store.set('dmc_live_links', links); if (key === linkKey()) draw(); return r.body.url; }
      return fallbackLink();
    }).catch(() => fallbackLink());
  }
  let cur = null;
  function draw() {
    cancelAnimationFrame(drawTimer);
    const mine = ++seq;
    drawTimer = requestAnimationFrame(() => {
      const sp = spec();
      if (S.type === 'takeaway' && sp.text && blocked(sp.text + ' ' + (S.name || ''))) {
        msg.textContent = 'That wording can’t go on a card. Try different words.'; bShare.disabled = bSave.disabled = true; sp.text = ''; sp.ok = false;
      } else msg.textContent = '';
      const photoUrl = sp.type === 'official' && sp.speaker ? sp.speaker.photo : '';
      loadFonts().then(() => loadImg(photoUrl)).then((img) => {
        if (mine !== seq) return;
        sp.photo = img; sp.qr = links[linkKey()] || fallbackLink();
        const shown = sp.text ? sp : Object.assign({}, sp, { text: S.type === 'official' ? 'Pick a quote below.' : 'Type your takeaway and it appears here.' });
        render(canvas, shown);
        cur = sp;
        const empty = !sp.ok;
        bShare.disabled = bSave.disabled = empty;
        if (!empty) cap.value = captionFor(sp, links[linkKey()] || fallbackLink());
      });
    });
  }

  /* making a card: count it, and send a takeaway's small preview to the operator's queue (once per distinct card) */
  function made(kind) {
    const sp = cur; if (!sp || !sp.ok) return;
    const id = hash(sp.type + '|' + S.session + '|' + sp.text);
    if (sp.type === 'takeaway' && !sent[id]) {
      sent[id] = 1; store.set('dmc_live_tk', sent);
      const tiny = document.createElement('canvas'); tiny.width = 216; tiny.height = Math.round(216 * canvas.height / canvas.width);
      tiny.getContext('2d').drawImage(canvas, 0, 0, tiny.width, tiny.height);
      let q = 0.6, img = tiny.toDataURL('image/jpeg', q);
      while (img.length > 50000 && q > 0.2) { q -= 0.15; img = tiny.toDataURL('image/jpeg', q); }
      o.submit({ t: 'tk', session: S.session, text: sp.text, name: S.name, img: img.length <= 50000 ? img : undefined });
    } else if (sp.type === 'official' && !sent[id]) {
      sent[id] = 1; store.set('dmc_live_tk', sent);
      o.submit({ t: 'ev', e: 'made', session: S.session, ct: 'official' });
    }
    if (kind) o.submit({ t: 'ev', e: kind, session: S.session, ct: sp.type });
  }
  const png = () => new Promise((res) => canvas.toBlob(res, 'image/png'));
  const fname = () => 'dmc2026-' + (S.type === 'official' ? 'quote' : 'takeaway') + '-' + S.size + '.png';
  /* the tracked link must be in the card (QR) and caption before it leaves the phone, but never hold the phone up for long */
  const ready = () => wantLink().then(() => new Promise((res) => { draw(); setTimeout(res, 120); }));
  function download(blob) {
    const a = el('a', { href: URL.createObjectURL(blob), download: fname() });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  bSave.addEventListener('click', () => {
    bSave.disabled = true;
    ready().then(png).then((b) => { download(b); made('saved'); msg.textContent = 'Saved. Check your photos or downloads.'; }).catch(() => { msg.textContent = 'Could not save the image.'; }).then(() => { bSave.disabled = !cur || !cur.ok; });
  });
  bShare.addEventListener('click', () => {
    bShare.disabled = true;
    ready().then(png).then((b) => {
      const f = typeof File === 'function' ? new File([b], fname(), { type: 'image/png' }) : null;
      made(null);
      if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
        return navigator.share({ files: [f], text: cap.value, title: 'DMC 2026' }).then(() => { o.submit({ t: 'ev', e: 'shared', session: S.session, ct: cur.type }); msg.textContent = 'Shared. Your caption is below if you need it.'; })
          .catch((e) => { if (e && e.name === 'AbortError') return; download(b); o.submit({ t: 'ev', e: 'saved', session: S.session, ct: cur.type }); msg.textContent = 'Saved instead. Add the caption below when you post.'; });
      }
      download(b); o.submit({ t: 'ev', e: 'saved', session: S.session, ct: cur.type }); msg.textContent = 'Saved. Add the caption below when you post.';
    }).catch(() => { msg.textContent = 'Could not make the image. Try again.'; }).then(() => { bShare.disabled = !cur || !cur.ok; });
  });
  bCopy.addEventListener('click', () => {
    const done = () => { msg.textContent = 'Caption copied.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(cap.value).then(done, () => { cap.select(); });
    else { cap.select(); try { document.execCommand('copy'); done(); } catch (e) { /* selected for manual copy */ } }
  });

  fillSessions(); sync();
  if (S.type === 'official') takeaway.hidden = true; else official.hidden = true;
  /* the whole programme and every published quote, so a card can be made for any session (the phone's own state is the fallback offline) */
  fetch('/api/live-state?view=sessions').then((r) => r.ok ? r.json() : null).then((j) => {
    if (!j || !Array.isArray(j.sessions)) return;
    sessions = j.sessions; quotes = j.quotes || quotes; fillSessions(); sync();
  }).catch(() => {});
  if (S.type === 'takeaway') setTimeout(() => ta.focus(), 60);
}

window.DMCCards = { open, render, PICTURES, loadFonts, describe, fit, wrap, blocked, captionFor, LAYOUTS, SIZES, MAX };
