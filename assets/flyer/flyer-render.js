/* DMC 2026 participant flyers: one renderer for the Badge and the Brief (design handoff PORT-SPEC round 2).
 *
 *   DMCFlyer.load()                  → Promise: pinned fonts, tiles, hardware, logos (never rejects)
 *   DMCFlyer.renderFlyer(ctx, state) → draws onto ctx.canvas, resized to exactly 1080×1350 (4:5) or 1080×1920 (9:16)
 *
 * state: { template: 'badge'|'brief', format: '4:5'|'9:16', level: 'yourself'|'team'|'work',
 *          participantRole: 'attending'|'speaking'|'volunteering'|'partner', name, role, sessionLine,
 *          qrUrl, ticketPrice, photo (ImageBitmap | canvas | image), cutout (optional), gloss: 'off'|'soft'|'standard'|'high' }
 *
 * Units are px on a 1080-wide canvas. Text y is the top of the CSS line box; the canvas baseline is
 * y + LH/2 + (A − D)/2 with A and D the font's bounding-box ascent and descent. Type is Archivo only, in four pinned
 * settings that are static woff2 files (assets/flyer/fonts/), so no browser has to support canvas font-stretch.
 * The photo is only ever drawn onto the canvas: nothing in this file touches the network except the site's own assets.
 *
 * One renderer, two runtimes: in the browser it is a <script> (window.DMCFlyer); on the server (DMC Studio) it is required as a
 * CommonJS module and DMCFlyer.useNode(require('@napi-rs/canvas'), { root }) swaps the loaders (fonts from the same pinned woff2
 * files, images from disk) and the canvas factory. Every drawing call is the same Canvas 2D code in both, so Studio artwork and the
 * public flyer share one look. The partner row comes from assets/partners26/partners.json (the one partner list). */
(function (root) {
'use strict';

var TICKET_PRICE = 150;                                         /* GH₵, the one constant the Brief's BUDGET row reads */
var DEFAULT_QR = 'https://mangh.org/dmc-2026?ref=flyer-qr';     /* encoded in the QR; the printed label drops the query */
var HAS_DOC = typeof document !== 'undefined';
var SCRIPT_SRC = (HAS_DOC && document.currentScript && document.currentScript.src) || '';
var BASE = SCRIPT_SRC ? SCRIPT_SRC.split('?')[0].replace(/[^/]*$/, '') : '/assets/flyer/';
var SITE = BASE.replace(/flyer\/$/, '');                        /* the site's /assets/ folder */

/* ---------- constants ---------- */
var CREAM = '#F4EFE6', INK = '#0D0D0D', OB = '#1C1C1C', GOLD = '#C9A24A', TEAL = '#2A7B74', CORAL = '#D95F45',
    SOFT = '#B9B4AB', MUTE = '#5A5650', DARK2 = '#3A3A3A';
var LEVELS = {
  yourself: { fill: '#2A7B74', ink: '#F4EFE6', text: '#5C9890', word: 'MYSELF',  obj: 'Build myself' },
  team:     { fill: '#C9A24A', ink: '#1C1C1C', text: '#C9A24A', word: 'MY TEAM', obj: 'Build my team' },
  work:     { fill: '#D95F45', ink: '#1C1C1C', text: '#D95F45', word: 'MY WORK', obj: 'Build my work' }
};
var CHIPS = { attending: 'ATTENDING', speaking: 'SPEAKING', volunteering: 'VOLUNTEERING', partner: 'PARTNER' };
/* multipliers = globalAlpha on each layer group; the base alphas in the layers are the "high" values */
var GLOSS = {
  off:      { sheen: 0,    edge: 0,    shadow: 0 },
  soft:     { sheen: 0.45, edge: 0.45, shadow: 0.6 },
  standard: { sheen: 0.7,  edge: 0.75, shadow: 0.85 },
  high:     { sheen: 1,    edge: 1,    shadow: 1 }
};
/* The partner row: the shared list (assets/partners26/partners.json), each entry switchable. Filled by load(), in place, so
   DMCFlyer.PARTNERS keeps its identity. Tile width follows the enabled count (148 for six, 125 for seven). */
var PARTNERS = [];
function setPartners(json) {
  PARTNERS.length = 0;
  ((json && json.partners) || []).forEach(function (p) {
    PARTNERS.push({ id: p.id, name: p.name, src: SITE + 'partners26/' + p.logo, fit: p.fit || 'contain', pad: p.pad || [8, 12], enabled: p.enabled !== false,
                    slug: p.slug, tier: p.tier, role: p.role, logo: p.logo, siteName: p.siteName || p.name });
  });
}
var LOGO_SRC = { mojopay: SITE + 'partners26/mojopay-logo-blue.svg', man: SITE + 'man-logo.png' };
var FONT_FILES = [
  ['DMC Archivo D',    'archivo-d.woff2',      '900', 'normal'],
  ['DMC Archivo DI',   'archivo-di.woff2',     '900', 'normal'],   /* the true italic face; the family is named DI so the browser never slants the roman */
  ['DMC Archivo B',    'archivo-b500.woff2',   '500', 'normal'],
  ['DMC Archivo B',    'archivo-b600.woff2',   '600', 'normal'],
  ['DMC Archivo B',    'archivo-b700.woff2',   '700', 'normal'],
  ['DMC Archivo B',    'archivo-b800.woff2',   '800', 'normal'],
  ['DMC Archivo BI',   'archivo-bi500.woff2',  '500', 'normal'],
  ['DMC Archivo Cedi', 'archivo-cedi600.woff2', '600', 'normal']    /* the ₵ sign, as the glyph fallback of pin B */
];
var FAM = { D: '"DMC Archivo D"', DI: '"DMC Archivo DI"', B: '"DMC Archivo B", "DMC Archivo Cedi"', BI: '"DMC Archivo BI"' };
var ASCENT = 0.878, DESCENT = 0.21;                              /* hhea of Archivo; used only if the browser has no fontBoundingBox */

/* ---------- environment (browser defaults; DMCFlyer.useNode replaces them on the server) ---------- */
var ENV = {
  makeCanvas: function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
  Path2D: root.Path2D, DOMMatrix: root.DOMMatrix,
  qrcode: function () { return root.qrcode; },
  loadImage: null, loadFonts: null,
  loadJSON: function (url) { return root.fetch ? root.fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null); }
};
function ctx2d() { return ENV.makeCanvas(8, 8).getContext('2d'); }

/* ---------- assets ---------- */
var A = { img: {}, logos: {}, fontsOk: {}, ready: null };
function loadImage(url) {
  if (ENV.loadImage) return ENV.loadImage(url);
  return new Promise(function (res) {
    var i = new Image();
    i.onload = function () { res(i); };
    i.onerror = function () { res(null); };
    i.src = url;
  });
}
function loadFonts() {
  if (ENV.loadFonts) return ENV.loadFonts(FONT_FILES, A.fontsOk);
  if (!root.FontFace || !HAS_DOC || !document.fonts) return Promise.resolve();
  return Promise.all(FONT_FILES.map(function (f) {
    var ff = new root.FontFace(f[0], 'url(' + BASE + 'fonts/' + f[1] + ')', { weight: f[2], style: f[3] });
    return ff.load().then(function () { document.fonts.add(ff); A.fontsOk[f[1]] = true; }, function () { A.fontsOk[f[1]] = false; });
  }));
}
function load() {
  if (A.ready) return A.ready;
  var imgs = { strap: 'weave-strap-tile.png', field: 'weave-field-tile.png', kente: 'kente-strip-tile.png', hw: 'lanyard-hardware.svg', hws: 'hardware-specular.svg' };
  var jobs = [loadFonts()];
  Object.keys(imgs).forEach(function (k) { jobs.push(loadImage(BASE + imgs[k]).then(function (i) { A.img[k] = i; })); });
  Object.keys(LOGO_SRC).forEach(function (k) { jobs.push(loadImage(LOGO_SRC[k]).then(function (i) { A.logos[k] = i; })); });
  jobs.push(ENV.loadJSON(SITE + 'partners26/partners.json').then(function (j) {
    setPartners(j);
    return Promise.all(PARTNERS.map(function (p) { return loadImage(p.src).then(function (i) { A.logos[p.id] = i; }); }));
  }));
  A.ready = Promise.all(jobs).then(function () { detect(); probe(); return A; });
  return A.ready;
}

/* ---------- text ---------- */
var HAS_LS = false;
var HAS_TR = false;              /* ctx.textRendering = 'optimizeLegibility' makes Blink shape across spaces like the DOM does (kerning "Y T") */
function detect() {
  try { var c = ctx2d(); HAS_LS = 'letterSpacing' in c; HAS_TR = 'textRendering' in c; } catch (e) { HAS_LS = HAS_TR = false; }
}
if (HAS_DOC) detect();
var NEED_KERN = false;           /* set by the probe in load(): true where the canvas still ignores kerning across a space */
var forceNoLS = false;           /* QA hook: DMCFlyer._noLetterSpacing(true) exercises the glyph-by-glyph path used where ctx.letterSpacing is missing */
var _mx = {};
function fontOf(pin, size, weight) { return (pin === 'DI' || pin === 'D' ? '' : '') + (weight || (pin === 'D' || pin === 'DI' ? 900 : pin === 'BI' ? 500 : 600)) + ' ' + size + 'px ' + FAM[pin]; }
function vmetrics(ctx, font) {
  var k = font;
  if (_mx[k]) return _mx[k];
  ctx.font = font;
  var m = ctx.measureText('Hg'), a = m.fontBoundingBoxAscent, d = m.fontBoundingBoxDescent;
  var size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)[1]);
  if (!(a > 0)) { a = ASCENT * size; d = DESCENT * size; }
  return (_mx[k] = { A: a, D: d });
}
function useLS(ctx) { return HAS_LS && !forceNoLS && ('letterSpacing' in ctx); }
/* Advance of a string, tracking included on every glyph (as the DOM does; the last glyph's tracking is part of the box). */
function setup(ctx) { if (HAS_TR) ctx.textRendering = 'optimizeLegibility'; }
function measureW(ctx, str, pin, size, weight, trackEm, kern) {
  var font = fontOf(pin, size, weight), tr = (trackEm || 0) * size;
  if (!NEED_KERN) kern = null;
  ctx.save(); setup(ctx); ctx.font = font;
  var w;
  if (useLS(ctx)) { ctx.letterSpacing = tr + 'px'; w = ctx.measureText(str).width; }
  else w = ctx.measureText(str).width + str.length * tr;
  ctx.restore();
  if (kern) w += kernSum(str, kern, size);
  return w;
}
function kernSum(str, kern, size) {   /* pair adjustments (em) that Blink's canvas does not apply across a space */
  var s = 0;
  for (var i = 0; i < str.length - 1; i++) { var v = kern[str.substr(i, 2)]; if (v) s += v * size; }
  return s;
}
/* top = top of the line box, LH = its height. align 'left' | 'right' | 'center' (x is the anchor). Returns the width. */
function drawText(ctx, str, x, top, LH, o) {
  var font = fontOf(o.pin, o.size, o.weight), tr = (o.track || 0) * o.size;
  if (!NEED_KERN) o = Object.assign({}, o, { kern: null });
  var m = vmetrics(ctx, font), mA = Math.round(m.A), mD = Math.round(m.D);
  /* PORT-SPEC: baseline = y + LH/2 + (A − D)/2. Blink lays the DOM out with whole-pixel ascent/descent, a floored half-leading and a
     snapped baseline, so to land on the reference's pixels the same three roundings are applied (never more than 1px from the formula). */
  var base = Math.round(top + Math.floor((LH - (mA + mD)) / 2) + mA);
  var w = measureW(ctx, str, o.pin, o.size, o.weight, o.track, o.kern);
  var x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
  ctx.save(); setup(ctx);
  ctx.font = font; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = o.fill;
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  var plain = !(o.kern) && (tr === 0 || useLS(ctx));
  if (plain) {
    if (useLS(ctx)) ctx.letterSpacing = tr + 'px';
    ctx.fillText(str, x0, base);
  } else {                         /* glyph by glyph: prefix advances keep kerning, tracking and pair adjustments are added per glyph */
    for (var i = 0; i < str.length; i++) {
      var adv = ctx.measureText(str.slice(0, i + 1)).width - ctx.measureText(str[i]).width + i * tr + (o.kern ? kernSum(str.slice(0, i + 1), o.kern, o.size) : 0);
      if (str[i] !== ' ') ctx.fillText(str[i], x0 + adv, base);
    }
  }
  ctx.restore();
  if (LOG) LOG.push({ id: o.id || str, x: x0, y: top, w: w, h: LH, limit: o.limit == null ? null : o.limit, size: o.size });
  return w;
}
var LOG = null;

/* Does this canvas kern across a space ("Y T")? Blink's default canvas shaping does not; textRendering fixes it; if a browser still
   does not, drawText/measureW add the pair adjustment by hand (the table is in the level-word call). */
function probe() {
  try {
    var c = ctx2d(); setup(c); c.font = '900 100px ' + FAM.D;
    var j = c.measureText('Y T').width, sum = c.measureText('Y').width + c.measureText(' ').width + c.measureText('T').width;
    NEED_KERN = Math.abs(j - sum) < 0.5 && A.fontsOk['archivo-d.woff2'] === true;
  } catch (e) { NEED_KERN = false; }
}

/* ---------- shapes ---------- */
function rrPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
function fillRR(ctx, x, y, w, h, r, fill) { rrPath(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
function white(a) { return 'rgba(255,255,255,' + a + ')'; }
function black(a) { return 'rgba(0,0,0,' + a + ')'; }
function cover(ctx, img, x, y, w, h, fx, fy) {
  var iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
  if (!iw || !ih) return;
  var s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
  ctx.restore();
}
function contain(ctx, img, x, y, w, h, ax, ay) {
  var iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
  if (!iw || !ih) return;
  var s = Math.min(w / iw, h / ih), dw = iw * s, dh = ih * s;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x + (w - dw) * (ax == null ? 0.5 : ax), y + (h - dh) * (ay == null ? 0.5 : ay), dw, dh);
  ctx.restore();
}
function tilePattern(ctx, img, ox, oy) {
  var p = ctx.createPattern(img, 'repeat');
  if (p && p.setTransform && ENV.DOMMatrix) p.setTransform(new ENV.DOMMatrix().translate(ox, oy));
  return p;
}
/* 135° clear-coat band + hairline streak in box-local coordinates; t = (x + y) / (W + H), as in CSS linear-gradient(135deg) */
function sheenGrad(ctx, ox, oy, W, H, bw, Hb, peak) {
  var s0 = 20 + 0.8 * bw + 64 + 0.6 * Hb + 80, T = W + H, g = ctx.createLinearGradient(ox, oy, ox + T / 2, oy + T / 2);
  [[s0, 0], [s0 + 120, peak], [s0 + 240, 0], [s0 + 296, 0], [s0 + 300, peak], [s0 + 304, 0]].forEach(function (s) { g.addColorStop(Math.min(1, s[0] / T), white(s[1])); });
  return g;
}

/* ---------- the hero element: planes g1 and g2, then the fade (g3 and g4 are dropped, PORT-SPEC D1) ---------- */
function heroGeo(ctx, x, y, w, h) {
  var P = function (pts) { var p = new ENV.Path2D(); pts.forEach(function (q, i) { var X = x + q[0] / 100 * w, Y = y + q[1] / 100 * h; if (i) p.lineTo(X, Y); else p.moveTo(X, Y); }); p.closePath(); return p; };
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalAlpha = 0.85; ctx.fillStyle = TEAL; ctx.fill(P([[35, 0], [100, 0], [100, 55], [10, 0]]));
  ctx.globalAlpha = 0.80; ctx.fillStyle = CORAL; ctx.fill(P([[20, 0], [100, 40], [100, 75], [0, 95]]));
  ctx.globalAlpha = 1;
  var g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, INK); g.addColorStop(0.5, 'rgba(13,13,13,.6)'); g.addColorStop(1, 'rgba(13,13,13,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
}
/* the foil: one static frame of the site's shimmer; span = advance + 0.08em covers the italic overhang */
function foil(ctx, tx, span) {
  var g = ctx.createLinearGradient(tx, 0, tx + span, 0);
  g.addColorStop(0, GOLD); g.addColorStop(0.30, '#F5D87A'); g.addColorStop(0.55, GOLD); g.addColorStop(0.78, '#9E7520'); g.addColorStop(1, GOLD);
  return g;
}

/* ---------- state ---------- */
function fitName(ctx, text, base, maxW) {
  var min = Math.round(base * 0.7), W = function (t, s) { return measureW(ctx, t, 'B', s, 800, 0); };
  var w = W(text, base);
  if (w <= maxW) return { size: base, lines: [text] };
  var s1 = Math.floor(base * maxW / w);
  if (s1 >= min) return { size: s1, lines: [text] };
  var best = null;
  for (var i = 1; i < text.length; i++) {
    var a, b;
    if (text[i] === ' ') { a = text.slice(0, i); b = text.slice(i + 1); }
    else if (text[i - 1] === '-') { a = text.slice(0, i); b = text.slice(i); }
    else continue;
    var m = Math.max(W(a, min), W(b, min));
    if (!best || m < best.m) best = { a: a, b: b, m: m };
  }
  if (!best) return { size: s1, lines: [text] };
  return { size: best.m > maxW ? Math.floor(min * maxW / best.m) : min, lines: [best.a, best.b] };
}
function fitLine(ctx, text, base, floor, maxW) {
  var w = measureW(ctx, text, 'B', base, 600, 0);
  return w <= maxW ? base : Math.max(floor, Math.floor(base * maxW / w));
}
/* greedy wrap into at most maxLines; the last line ends in an ellipsis when text is left over (CSS line-clamp) */
function wrap(ctx, text, maxW, maxLines, size, weight) {
  var words = text.split(/\s+/).filter(Boolean), lines = [], cur = '';
  var W = function (t) { return measureW(ctx, t, 'B', size, weight, 0); };
  for (var i = 0; i < words.length; i++) {
    var t = cur ? cur + ' ' + words[i] : words[i];
    if (W(t) <= maxW || !cur) cur = t; else { lines.push(cur); cur = words[i]; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    var rest = lines.slice(0, maxLines);
    var last = rest[maxLines - 1] + ' ' + lines.slice(maxLines).join(' ');
    while (last.length > 1 && W(last + '…') > maxW) last = last.slice(0, -1);
    rest[maxLines - 1] = last.replace(/[\s&,·–-]+$/, '') + '…';
    lines = rest;
  }
  return lines;
}
function normalize(ctx, S) {
  var fmt = S.format === '9:16' ? '9:16' : '4:5';
  var lv = LEVELS[S.level] || LEVELS.yourself, G = GLOSS[S.gloss] || GLOSS.standard;
  var rawName = String(S.name == null ? '' : S.name).slice(0, 30).trim();
  var role = String(S.role == null ? '' : S.role).trim(), roleEmpty = !role;
  if (role.length > 38) role = role.slice(0, 38).replace(/\s+\S*$/, '').replace(/[\s&,·–-]+$/, '') + '…';
  var pr = CHIPS[S.participantRole] ? S.participantRole : 'attending';
  var session = String(S.sessionLine == null ? '' : S.sessionLine).slice(0, 40).trim();
  var qrUrl = S.qrUrl || DEFAULT_QR;
  return {
    fmt: fmt, tpl: S.template === 'brief' ? 'brief' : 'badge', lv: lv, G: G, story: fmt === '9:16',
    rawName: rawName, name: rawName || 'Your Name', roleEmpty: roleEmpty, roleShown: roleEmpty ? 'Your role' : role,
    pr: pr, chip: CHIPS[pr], session: session, showSession: pr === 'speaking' && !!session,
    photo: S.photo || null, cutout: S.cutout || null,
    price: S.ticketPrice == null ? TICKET_PRICE : S.ticketPrice,
    qrUrl: qrUrl, qrLabel: qrUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, ''),
    kS: G.sheen, kE: G.edge, kH: G.shadow
  };
}

/* ---------- QR (qrcode-generator, ECC M); modules are snapped to whole pixels so there are no seams ---------- */
function drawQR(ctx, url, x, y, size) {
  var q;
  try { q = ENV.qrcode()(0, 'M'); q.addData(url); q.make(); } catch (e) { return false; }
  var n = q.getModuleCount();
  ctx.fillStyle = OB;
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      if (!q.isDark(r, c)) continue;
      var x0 = Math.round(x + c * size / n), x1 = Math.round(x + (c + 1) * size / n), y0 = Math.round(y + r * size / n), y1 = Math.round(y + (r + 1) * size / n);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  return true;
}

/* ---------- shared pieces ---------- */
function pill(ctx, x, y, h, padX, gap, size) {
  var txt = 'DMC 2026 · ACCRA', tw = measureW(ctx, txt, 'B', size, 600, 0.16), dot = 12, w = 4 + 2 * padX + dot + gap + tw;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(x + 2 + padX + dot / 2, y + h / 2, dot / 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  drawText(ctx, txt, x + 2 + padX + dot + gap, y, h, { pin: 'B', size: size, weight: 600, track: 0.16, fill: 'rgba(244,239,230,.72)', id: 'pill' });
  return w;
}
function chipTag(ctx, x, y, h, padL, padR, label, fillSq) {   /* black pill, level-colour square, cream label */
  var tw = measureW(ctx, label, 'B', 20, 700, 0.14), w = padL + 10 + 10 + tw + padR;
  fillRR(ctx, x, y, w, h, h / 2, OB);
  ctx.fillStyle = fillSq; ctx.fillRect(x + padL, y + (h - 10) / 2, 10, 10);
  drawText(ctx, label, x + padL + 20, y, h, { pin: 'B', size: 20, weight: 700, track: 0.14, fill: CREAM, id: 'chip' });
  return w;
}
function band(ctx, f, N) {
  /* f: { kenteY, bandY, bandH, contentY, row1H, gap, tileH, tileY, lblY, manW, manH, mojoPadV, tilesLabelY } */
  var k = A.img.kente;
  if (k) { ctx.fillStyle = tilePattern(ctx, k, 0, f.kenteY); ctx.fillRect(0, f.kenteY, 1080, 24); }
  ctx.fillStyle = OB; ctx.fillRect(0, f.bandY, 1080, f.bandH);
  var cy = f.contentY, rh = f.row1H;
  var lbl = function (t, x, rowTop, rowH) { drawText(ctx, t, x, rowTop + (rowH - 20) / 2, 20, { pin: 'B', size: 20, weight: 700, track: 0.14, fill: SOFT, id: t }); };
  lbl('POWERED BY', 64, cy, rh);
  fillRR(ctx, 252, cy, 300, rh, 8, '#FFFFFF');                       /* the MojoPay lockup: blue on white, 300 wide */
  if (A.logos.mojopay) contain(ctx, A.logos.mojopay, 252 + 30, cy + f.mojoPadV, 240, rh - 2 * f.mojoPadV);
  else drawText(ctx, 'MojoPay', 252 + 150, cy, rh, { pin: 'B', size: 28, weight: 700, fill: '#0500CC', align: 'center', id: 'MojoPay' });
  lbl('ORGANIZED BY', 628, cy, rh);
  var mx = 844, my = cy + (rh - f.manH) / 2;
  if (A.logos.man) contain(ctx, A.logos.man, mx, my, f.manW, f.manH);
  else drawText(ctx, 'M·A·N', mx, my, f.manH, { pin: 'D', size: 38, weight: 900, fill: CREAM, id: 'M·A·N' });
  drawText(ctx, 'IN PARTNERSHIP WITH', 64, f.tilesLabelY, 20, { pin: 'B', size: 20, weight: 700, track: 0.14, fill: SOFT, id: 'IN PARTNERSHIP WITH' });
  var on = PARTNERS.filter(function (p) { return p.enabled; }), n = on.length;
  var info = { mojo: { x: 252, y: cy, w: 300, h: rh, colour: '#FFFFFF' }, tiles: on.map(function (p) { return p.id; }) };
  if (!n) return info;
  var tw = Math.floor((952 - (n - 1) * 12) / n);
  on.forEach(function (p, i) {
    var x = 64 + i * (tw + 12), y = f.tileY, img = A.logos[p.id];
    if (LOG) LOG.push({ id: 'tile:' + p.id, x: x, y: y, w: tw, h: f.tileH, limit: null, size: f.tileH, tile: true });
    fillRR(ctx, x, y, tw, f.tileH, 6, '#FFFFFF');
    if (img) {
      var px = p.pad[1], py = p.pad[0];
      if (p.fit === 'cover') cover(ctx, img, x + px, y + py, tw - 2 * px, f.tileH - 2 * py, 0.5, 0.5);
      else contain(ctx, img, x + px, y + py, tw - 2 * px, f.tileH - 2 * py);
    } else {
      var size = 18;
      while (size > 9 && measureW(ctx, p.name, 'B', size, 700, 0) > tw - 16) size--;
      drawText(ctx, p.name, x + tw / 2, y, f.tileH, { pin: 'B', size: size, weight: 700, fill: OB, align: 'center', limit: tw - 16, id: 'tile:' + p.id });
    }
  });
  return info;
}

/* One flat row for DMC Studio's square and landscape sizes: POWERED BY + the MojoPay tile (the largest logo), ORGANIZED BY + M·A·N,
   IN PARTNERSHIP WITH + every enabled partner tile. o: { x, y, w, h, mojoW, labelSize }. Same tiles, labels and spelling as band(). */
function bandRow(ctx, o) {
  var x = o.x, y = o.y, w = o.w, h = o.h, ls = o.labelSize || 16, th = Math.round(h * 0.64), ty = y + Math.round((h - th) / 2);
  var lbl = function (t, lx, top, rowH) { return drawText(ctx, t, lx, top + (rowH - ls) / 2, ls, { pin: 'B', size: ls, weight: 700, track: 0.14, fill: SOFT, id: t }); };
  ctx.fillStyle = OB; ctx.fillRect(x, y, w, h);
  var cx = x + (o.padX || 40);
  cx += lbl('POWERED BY', cx, y, h) + Math.round(ls * 0.9);
  var mw = o.mojoW, mh = Math.round(mw / 3.4), my = y + Math.round((h - mh) / 2);
  fillRR(ctx, cx, my, mw, mh, 6, '#FFFFFF');
  if (A.logos.mojopay) contain(ctx, A.logos.mojopay, cx + mw * 0.1, my + mh * 0.22, mw * 0.8, mh * 0.56);
  var mojo = { x: cx, y: my, w: mw, h: mh, colour: '#FFFFFF' };
  cx += mw + Math.round(ls * 1.6);
  cx += lbl('ORGANIZED BY', cx, y, h) + Math.round(ls * 0.9);
  var manH = Math.round(th * 0.9), manW = Math.round(manH * 3.07);
  if (A.logos.man) contain(ctx, A.logos.man, cx, y + (h - manH) / 2, manW, manH, 0, 0.5);
  cx += manW + Math.round(ls * 1.6);
  cx += lbl('IN PARTNERSHIP WITH', cx, y, h) + Math.round(ls * 0.9);
  var on = PARTNERS.filter(function (p) { return p.enabled; }), n = on.length, right = x + w - (o.padX || 40), gap = Math.max(6, Math.round(ls * 0.5));
  var tw = n ? Math.floor((right - cx - (n - 1) * gap) / n) : 0;
  on.forEach(function (p, i) {
    var tx = cx + i * (tw + gap), img = A.logos[p.id];
    fillRR(ctx, tx, ty, tw, th, 5, '#FFFFFF');
    var k = th / 58, px = Math.min(p.pad[1] * k, tw * 0.1), py = p.pad[0] * k;
    if (img) contain(ctx, img, tx + px, ty + py, tw - 2 * px, th - 2 * py);
    else drawText(ctx, p.name, tx + tw / 2, ty, th, { pin: 'B', size: Math.round(th * 0.3), weight: 700, fill: OB, align: 'center', limit: tw - 8, id: 'tile:' + p.id });
    if (LOG) LOG.push({ id: 'tile:' + p.id, x: tx, y: ty, w: tw, h: th, limit: null, size: th, tile: true });
  });
  return { mojo: mojo, tiles: on.map(function (p) { return p.id; }), tileW: tw };
}

/* ---------- the Badge ---------- */
/* Split so DMC Studio can reuse the object: badgeLayout (geometry), badgeLeft (pill, eyebrow, headline, tiles, QR), badgeObject (strap,
   card, photo block, hardware, nameplate) and the band. The 4:5 and 9:16 flyers draw exactly what they drew before (the strap is
   painted after the left column now; the two never overlap). */
function badgeLayout(ctx, N) {
  var st = N.story, W = 1080;
  var F = st ? {
    H: 1920, planes: [540, 0, 540, 1356], strap: { x: 672, h: 200, sL: 679, sR: 807, sH: 192, crimpY: 128 },
    pill: { y: 250, h: 56, padX: 24, gap: 12, size: 28 }, eyeY: 334, headY: 420, headSize: 86, tagY: 672, iamY: 812, wordY: 842, wordSize: 52,
    tileY: [926, 996, 1066], tileW: 376, qrY: 1166, scanX: 216, scanY: 1178, urlX: 216, urlY: 1256,
    card: { x: 472, y: 300, w: 544, h: 1040 }, slot: { x: 684, y: 320 }, blockX: 492, blockW: 504, hw: { x: 664, y: 189 },
    plate: { x: 500, w: 488 }, mono: 200, kenteY: 1356, shadowPlate: { x: 704, y: 327 }, clipStart: 380,
    band: { kenteY: 1356, bandY: 1380, bandH: 540, contentY: 1396, row1H: 68, manW: 166, manH: 54, mojoPadV: 15, tilesLabelY: 1476, tileY: 1508, tileH: 54 },
    sessGap: 12
  } : {
    H: 1350, planes: [540, 0, 540, 1110], strap: { x: 644, h: 244, sL: 651, sR: 779, sH: 236, crimpY: 172 },
    pill: { y: 48, h: 58, padX: 28, gap: 14, size: 30 }, eyeY: 130, headY: 214, headSize: 76, tagY: 0, iamY: 444, wordY: 474, wordSize: 46,
    tileY: [552, 622, 692], tileW: 320, qrY: 788, scanX: 216, scanY: 800, urlX: 64, urlY: 940,
    card: { x: 416, y: 344, w: 600, h: 736 }, slot: { x: 656, y: 364 }, blockX: 436, blockW: 560, hw: { x: 636, y: 233 },
    plate: { x: 444, w: 544 }, mono: 180, kenteY: 1110, shadowPlate: { x: 676, y: 371 }, clipStart: 420,
    band: { kenteY: 1110, bandY: 1134, bandH: 216, contentY: 1152, row1H: 72, manW: 172, manH: 56, mojoPadV: 16, tilesLabelY: 1238, tileY: 1272, tileH: 58 },
    sessGap: 10
  };
  var C = F.card, S = F.strap;
  var f = fitName(ctx, N.name, 80, F.plate.w);
  var roleW = F.plate.w;
  var roleLines = measureW(ctx, N.roleShown, 'B', 34, 500, 0) > roleW ? 2 : 1;
  var nameH = Math.round(f.lines.length * f.size * 1.02);
  var plateH = 24 + 40 + 16 + nameH + 10 + (roleLines === 2 ? 80 : 40) + (N.showSession ? 44 : 0) + 28;
  var Hb = C.h - 64 - plateH, blockY = C.y + 64, plateY = blockY + Hb + 24;
  var bx = F.blockX, bw = F.blockW;
  var pop = !!N.cutout;

  return { F: F, C: C, S: S, f: f, roleW: roleW, nameH: nameH, plateH: plateH, Hb: Hb, blockY: blockY, plateY: plateY, bx: bx, bw: bw, pop: pop, W: W, st: st };
}
function drawBadge(ctx, N) {
  var K = badgeLayout(ctx, N), F = K.F, W = K.W, st = N.story;
  /* ground, planes, fade */
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, F.H);
  heroGeo(ctx, F.planes[0], F.planes[1], F.planes[2], F.planes[3]);

  badgeStrap(ctx, N, K);
  badgeLeft(ctx, N, F);
  badgeCard(ctx, N, K);
  var bandInfo = band(ctx, F.band, N);
  if (st) {
    drawText(ctx, '#DMC2026 · #BuiltToScale', 64, 1604, 28, { pin: 'B', size: 28, weight: 600, fill: SOFT, id: 'hashtags' });
    if (A.img.field) { ctx.save(); ctx.beginPath(); ctx.rect(0, 1660, 1080, 260); ctx.clip(); ctx.globalAlpha = 0.6; ctx.fillStyle = tilePattern(ctx, A.img.field, 0, 1440); ctx.fillRect(0, 1660, 1080, 260); ctx.restore(); }
  }
  return { plateH: K.plateH, Hb: K.Hb, name: K.f, band: bandInfo };
}
function badgeLeft(ctx, N, F) {
  var st = N.story, lv = N.lv;
  /* left column */
  pill(ctx, 64, F.pill.y, F.pill.h, F.pill.padX, F.pill.gap, F.pill.size);
  var eo = { pin: 'B', size: 20, weight: 700, track: 0.28, fill: 'rgba(244,239,230,.6)' };
  drawText(ctx, 'DIGITAL MARKETERS’', 64, F.eyeY, 28, Object.assign({ id: 'eyebrow1', limit: 320 }, eo));
  drawText(ctx, 'CONFERENCE', 64, F.eyeY + 28, 28, Object.assign({ id: 'eyebrow2', limit: 320 }, eo));
  headline(ctx, 64, F.headY, F.headSize, 'badge');
  if (st) {
    var tl = ['“The organisations scaling', 'in Ghana aren’t waiting.', 'They’re building.”'];   /* the reference sets this with text-wrap:pretty; fixed copy, so the pretty breaks are fixed */
    ctx.save(); tl.forEach(function (ln, i) { drawText(ctx, ln, 64, F.tagY + i * 34, 34, { pin: 'BI', size: 26, weight: 500, fill: 'rgba(244,239,230,.72)', id: 'tagline' + i, limit: 376 }); }); ctx.restore();
  }
  var lw = st ? 376 : 320;
  if (N.left) leftTitle(ctx, N.left, 64, F, lw, lv);
  else {
    drawText(ctx, 'I’M BUILDING', 64, F.iamY, 28, { pin: 'B', size: 24, weight: 800, track: 0.06, fill: lv.text, id: 'iam' });
    drawText(ctx, lv.word, 64, F.wordY, F.wordSize, { pin: 'D', size: F.wordSize, weight: 900, fill: lv.text, id: 'levelword', limit: lw, kern: { 'Y ': -0.11 } });
  }
  [['DATE', 'Sat 21 November 2026'], ['TIME', '10AM – 3PM'], ['VENUE', 'British Council']].forEach(function (t, i) {
    var y = F.tileY[i];
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(64, y, F.tileW, 68);
    ctx.fillStyle = 'rgba(201,162,74,.18)'; ctx.fillRect(64, y, F.tileW, 2);
    drawText(ctx, t[0], 82, y + 11.5, 15, { pin: 'B', size: 15, weight: 700, track: 0.2, fill: 'rgba(244,239,230,.65)', id: 'tl-' + t[0] });
    drawText(ctx, t[1], 82, y + 32.5, 26, { pin: 'B', size: 24, weight: 800, fill: CREAM, id: 'tv-' + t[0], limit: F.tileW - 36 });
  });
  fillRR(ctx, 64, F.qrY, 132, 132, 8, CREAM);
  drawQR(ctx, N.qrUrl, 74, F.qrY + 10, 112);
  ['SCAN TO', 'REGISTER'].forEach(function (t, i) { drawText(ctx, t, F.scanX, F.scanY + i * 24, 24, { pin: 'B', size: 18, weight: 700, track: 0.14, fill: SOFT, id: 'scan' + i }); });
  drawText(ctx, N.qrLabel, F.urlX, F.urlY, 22, { pin: 'B', size: 22, weight: 600, fill: CREAM, id: 'url', limit: st ? 840 : 220 });
  if (!st) ['#DMC2026', '#BuiltToScale'].forEach(function (t, i) { drawText(ctx, t, 64, 980 + i * 28, 28, { pin: 'B', size: 22, weight: 600, fill: SOFT, id: 'tag' + i }); });

}
/* a session kicker and title where the flyer says I'M BUILDING + the level word (Studio's Speaker / panelist) */
function leftTitle(ctx, L, x, F, lw, lv) {
  drawText(ctx, L.kicker, x, F.iamY, 28, { pin: 'B', size: 24, weight: 800, track: 0.06, fill: lv.text, id: 'iam', limit: lw });
  var room = (F.tileY[0] - 14) - (F.wordY - 6), size = 38, lines;
  for (; size >= 24; size -= 2) { lines = wrap(ctx, L.title, lw, 2, size, 800); if (lines.length * size * 1.08 <= room && lines.every(function (t) { return measureW(ctx, t, 'B', size, 800, 0) <= lw; })) break; }
  if (size < 24) { size = 24; lines = wrap(ctx, L.title, lw, 2, size, 800); }
  lines.forEach(function (t, i) { drawText(ctx, t, x, F.wordY - 6 + i * size * 1.08, size * 1.08, { pin: 'B', size: size, weight: 800, fill: '#F4EFE6', id: 'lefttitle' + i, limit: lw }); });
}
function badgeObject(ctx, N, K) { badgeStrap(ctx, N, K); badgeCard(ctx, N, K); }
function badgeStrap(ctx, N, K) {
  var G = N.G, S = K.S;
  /* strap + shading [E] + crimp sheen [S] + stitches */
  if (A.img.strap) { ctx.fillStyle = tilePattern(ctx, A.img.strap, S.x, 0); ctx.fillRect(S.x, 0, 144, S.h); }
  ctx.save(); ctx.globalAlpha = G.edge; ctx.beginPath(); ctx.rect(S.x, 0, 144, S.h); ctx.clip();
  var sg = ctx.createLinearGradient(S.x, 0, S.x + 144, 0);
  sg.addColorStop(0, black(0.42)); sg.addColorStop(0.22, black(0)); sg.addColorStop(0.42, white(0.12)); sg.addColorStop(0.60, white(0)); sg.addColorStop(0.76, black(0)); sg.addColorStop(1, black(0.46));
  ctx.fillStyle = sg; ctx.fillRect(S.x, 0, 144, S.h); ctx.restore();
  ctx.save(); ctx.globalAlpha = G.sheen; var cg = ctx.createLinearGradient(0, S.crimpY, 0, S.crimpY + 72);
  cg.addColorStop(0, white(0)); cg.addColorStop(1, white(0.18)); ctx.fillStyle = cg; ctx.fillRect(S.x, S.crimpY, 144, 72); ctx.restore();
  ctx.save(); ctx.strokeStyle = CREAM; ctx.lineWidth = 2; ctx.globalAlpha = 0.55; ctx.setLineDash([6, 4]);
  [S.sL, S.sR].forEach(function (sx) { ctx.beginPath(); ctx.moveTo(sx + 1, 0); ctx.lineTo(sx + 1, S.sH); ctx.stroke(); });
  ctx.restore();

}
function badgeCard(ctx, N, K) {
  var st = N.story, G = N.G, lv = N.lv, F = K.F, C = K.C, f = K.f, roleW = K.roleW, nameH = K.nameH, plateH = K.plateH,
      Hb = K.Hb, blockY = K.blockY, plateY = K.plateY, bx = K.bx, bw = K.bw, pop = K.pop;
  /* card cast shadow [H], card, cream sheen [S] */
  ctx.save(); ctx.globalAlpha = G.shadow;
  ctx.shadowColor = black(0.58); ctx.shadowBlur = 56; ctx.shadowOffsetY = 32; fillRR(ctx, C.x, C.y, C.w, C.h, 28, CREAM);
  ctx.shadowColor = black(0.36); ctx.shadowBlur = 10; ctx.shadowOffsetY = 6; fillRR(ctx, C.x, C.y, C.w, C.h, 28, CREAM);
  ctx.restore();
  fillRR(ctx, C.x, C.y, C.w, C.h, 28, CREAM);
  ctx.save(); ctx.globalAlpha = G.sheen; rrPath(ctx, C.x, C.y, C.w, C.h, 28); ctx.clip();
  ctx.fillStyle = sheenGrad(ctx, C.x, C.y, C.w, C.h, bw, Hb, 0.20); ctx.fillRect(C.x, C.y, C.w, C.h); ctx.restore();

  /* slot + inner shadow [E] + lip [E] */
  var sl = F.slot;
  fillRR(ctx, sl.x, sl.y, 120, 18, 9, OB);
  ctx.save(); ctx.globalAlpha = G.edge; rrPath(ctx, sl.x, sl.y, 120, 18, 9); ctx.clip();
  var ig = ctx.createLinearGradient(0, sl.y, 0, sl.y + 7); ig.addColorStop(0, black(0.7)); ig.addColorStop(1, black(0));
  ctx.fillStyle = ig; ctx.fillRect(sl.x, sl.y, 120, 7); ctx.restore();
  ctx.save(); ctx.globalAlpha = G.edge; var lg = ctx.createLinearGradient(sl.x + 10, 0, sl.x + 110, 0);
  lg.addColorStop(0, white(0)); lg.addColorStop(0.5, white(0.9)); lg.addColorStop(1, white(0)); ctx.fillStyle = lg; ctx.fillRect(sl.x + 10, sl.y + 18, 100, 2); ctx.restore();

  /* colour block, photo or monogram, photo sheen [S], corner glare [S], hi/lo lines [E] */
  fillRR(ctx, bx, blockY, bw, Hb, 18, lv.fill);
  ctx.save(); rrPath(ctx, bx, blockY, bw, Hb, 18); ctx.clip();
  if (N.photo && !pop) cover(ctx, N.photo, bx, blockY, bw, Hb, 0.5, 0.3);
  else if (!N.photo && !pop) {
    var ini = N.name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
    drawText(ctx, ini, bx + bw / 2, blockY + Hb / 2 - F.mono / 2, F.mono, { pin: 'D', size: F.mono, weight: 900, fill: lv.ink, align: 'center', id: 'monogram', limit: bw - 40 });
  }
  ctx.save(); ctx.globalAlpha = G.sheen;
  ctx.fillStyle = sheenGrad(ctx, C.x, C.y, C.w, C.h, bw, Hb, 0.12); ctx.fillRect(bx, blockY, bw, Hb);
  var gl = 0.2 * bw, rg = ctx.createRadialGradient(bx, blockY, 0, bx, blockY, gl); rg.addColorStop(0, white(0.12)); rg.addColorStop(1, white(0));
  ctx.fillStyle = rg; ctx.fillRect(bx, blockY, gl, gl); ctx.restore();
  ctx.save(); ctx.globalAlpha = G.edge; ctx.fillStyle = white(0.4); ctx.fillRect(bx, blockY, bw, 1); ctx.fillStyle = black(0.32); ctx.fillRect(bx, blockY + Hb - 1, bw, 1); ctx.restore();
  ctx.restore();

  /* rim + top-edge specular [E] */
  ctx.save(); ctx.globalAlpha = G.edge;
  var rim = ctx.createLinearGradient(C.x, C.y, C.x + C.w, C.y + C.h);
  rim.addColorStop(0, white(0.6)); rim.addColorStop(0.38, white(0)); rim.addColorStop(0.62, black(0)); rim.addColorStop(1, black(0.22));
  rrPath(ctx, C.x + 1, C.y + 1, C.w - 2, C.h - 2, 27); ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.stroke();
  var sp = ctx.createLinearGradient(C.x + 1.5, 0, C.x + F.clipStart, 0);
  sp.addColorStop(0, white(0.9)); sp.addColorStop(0.55, white(0.35)); sp.addColorStop(1, white(0));
  ctx.beginPath(); ctx.moveTo(C.x + 1.5, C.y + 28); ctx.arc(C.x + 28, C.y + 28, 26.5, Math.PI, Math.PI * 1.5); ctx.lineTo(C.x + F.clipStart, C.y + 1.5);
  ctx.strokeStyle = sp; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();

  /* cut-out with shadow [H] */
  if (pop) {
    ctx.save(); ctx.beginPath(); ctx.rect(bx, blockY - 96 - 0, bw, Hb + 96); ctx.clip();
    ctx.shadowColor = black(0.4 * G.shadow); ctx.shadowBlur = 12; ctx.shadowOffsetY = 12;
    contain(ctx, N.cutout, bx, blockY - 96, bw, Hb + 96, 0.5, 1);
    ctx.restore();
  }
  /* clip contact shadow [H], hardware, hardware specular [E] */
  ctx.save(); ctx.globalAlpha = G.shadow; var sp2 = F.shadowPlate;
  ctx.beginPath(); ctx.rect(sp2.x, sp2.y, 80, 18); ctx.clip(); ctx.translate(sp2.x + 40, sp2.y + 9); ctx.scale(1, 12.73 / 56.57);
  var eg = ctx.createRadialGradient(0, 0, 0, 0, 0, 56.57); eg.addColorStop(0, black(0.45)); eg.addColorStop(0.7, black(0));
  ctx.fillStyle = eg; ctx.fillRect(-60, -60, 120, 120); ctx.restore();
  if (A.img.hw) ctx.drawImage(A.img.hw, F.hw.x, F.hw.y, 160, 150);
  if (A.img.hws) { ctx.save(); ctx.globalAlpha = G.edge; ctx.drawImage(A.img.hws, F.hw.x, F.hw.y, 160, 150); ctx.restore(); }

  /* nameplate: chip, name, role, session */
  var px = F.plate.x, ny;
  chipTag(ctx, px, plateY, 40, 14, 18, N.chip, lv.fill);
  ny = plateY + 40 + 16;
  var nsz = f.size, nLH = nsz * 1.02, nameA = N.rawName ? 1 : 0.32;
  f.lines.forEach(function (ln, i) { drawText(ctx, ln, px, ny + i * nLH, nLH, { pin: 'B', size: nsz, weight: 800, fill: OB, alpha: nameA, id: 'name' + i, limit: F.plate.w }); });
  var ry = ny + nameH + 10, rl = wrap(ctx, N.roleShown, roleW, 2, 34, 500);
  rl.forEach(function (ln, i) { drawText(ctx, ln, px, ry + i * 40, 40, { pin: 'B', size: 34, weight: 500, fill: DARK2, alpha: N.roleEmpty ? 0.45 : 1, id: 'role' + i, limit: roleW }); });
  if (N.showSession) {
    var sy = ry + rl.length * 40 + F.sessGap;
    var ssz = fitLine(ctx, N.session, 28, 24, F.plate.w - 14), sh = ssz * 1.2;
    ctx.fillStyle = lv.fill; ctx.fillRect(px, sy + (Math.max(22, sh) - 22) / 2, 4, 22);
    drawText(ctx, N.session, px + 14, sy, sh, { pin: 'B', size: ssz, weight: 600, fill: OB, id: 'session', limit: F.plate.w - 14 });
  }

}

/* ---------- the Brief ---------- */
function rot(ctx, cx, cy, deg, fn) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(deg * Math.PI / 180); ctx.translate(-cx, -cy); fn(); ctx.restore(); }
function strokeRR(ctx, x, y, w, h, r, bw, color) {                 /* a CSS border: stroke centred in the border box, inset by half the width */
  rrPath(ctx, x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2)); ctx.lineWidth = bw; ctx.strokeStyle = color; ctx.stroke();
}
function topLeftArc(ctx, x, y, w, h, r, bw, color, alpha) {         /* border-color: white white-0 white-0 white: the top and left borders of a capsule */
  var i = bw / 2, rr = r - i, L = x + i, T = y + i, Rt = x + w - i, Bt = y + h - i;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = bw; ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(L + rr, Bt - rr, rr, Math.PI * 0.75, Math.PI);
  ctx.lineTo(L, T + rr); ctx.arc(L + rr, T + rr, rr, Math.PI, Math.PI * 1.5);
  ctx.lineTo(Rt - rr, T); ctx.arc(Rt - rr, T + rr, rr, Math.PI * 1.5, Math.PI * 1.75);
  ctx.stroke(); ctx.restore();
}
function grad135(ctx, ox, oy, W, H, stops) {
  var T = W + H, g = ctx.createLinearGradient(ox, oy, ox + T / 2, oy + T / 2);
  stops.forEach(function (s) { g.addColorStop(s[0], white(s[1])); });
  return g;
}
function drawBrief(ctx, N) {
  var st = N.story, G = N.G, lv = N.lv, hasPhoto = !!N.photo;
  var P = st ? { H: 1920, x0: 88, y0: 404, bw: 904, lab: 196, vw: hasPhoto ? 504 : 692, qrY: 1196, scanY: 1216, urlY: 1248,
                 band: { kenteY: 1356, bandY: 1380, bandH: 540, contentY: 1396, row1H: 68, manW: 166, manH: 54, mojoPadV: 15, tilesLabelY: 1476, tileY: 1508, tileH: 54 } }
             : { H: 1350, x0: 64, y0: 196, bw: 952, lab: 220, vw: hasPhoto ? 528 : 716, qrY: 988, scanY: 996, urlY: 1026,
                 band: { kenteY: 1110, bandY: 1134, bandH: 216, contentY: 1152, row1H: 72, manW: 172, manH: 56, mojoPadV: 16, tilesLabelY: 1238, tileY: 1272, tileH: 58 } };
  var x0 = P.x0, y0 = P.y0, vx = x0 + P.lab + 16, right = x0 + P.bw, Vw = P.vw;

  /* layout (PORT-SPEC §4): client row height Hc, then five rows of rowH inside 574px */
  var f = fitName(ctx, N.name, 80, Vw), nameH = f.lines.length * f.size * 1.02;
  var roleLines = measureW(ctx, N.roleShown, 'B', 34, 500, 0) > Vw ? 2 : 1;
  var hc = function (rl) { return Math.max(hasPhoto ? 240 : 0, 20 + 36 + 14 + Math.round(f.lines.length * f.size * 1.02) + 8 + rl * 40 + (N.showSession ? 44 : 0) + 20); };
  if (roleLines === 2 && hc(2) + 5 * 52 > 574) roleLines = 1;
  var Hc = hc(roleLines), rowH = Math.max(52, Math.min(64, Math.floor((574 - Hc) / 5)));
  var rows0 = y0 + 210;                                              /* 406 / 614 */

  /* ground, header band and planes */
  if (st) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, 1080, 1920);
    heroGeo(ctx, 540, 0, 540, 1356);
    pill(ctx, 64, 250, 58, 28, 14, 30);
    drawText(ctx, 'CREATIVE BRIEF', 64, 332, 40, { pin: 'D', size: 40, weight: 900, fill: CREAM, id: 'CREATIVE BRIEF' });
    /* sheet: cast shadow [H], paper, sheen [S], edges [E] */
    ctx.save(); ctx.globalAlpha = G.shadow; ctx.shadowColor = black(0.52); ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; fillRR(ctx, 40, 404, 1000, 932, 6, CREAM); ctx.restore();
    fillRR(ctx, 40, 404, 1000, 932, 6, CREAM);
    ctx.save(); ctx.globalAlpha = G.sheen; rrPath(ctx, 40, 404, 1000, 932, 6); ctx.clip();
    ctx.fillStyle = grad135(ctx, 40, 404, 1000, 932, [[0.06, 0], [0.22, 0.14], [0.38, 0]]); ctx.fillRect(40, 404, 1000, 932); ctx.restore();
    ctx.save(); ctx.globalAlpha = G.edge; rrPath(ctx, 40, 404, 1000, 932, 6); ctx.clip();
    ctx.fillStyle = white(0.8); ctx.fillRect(40, 404, 1000, 1); ctx.fillStyle = white(0.5); ctx.fillRect(40, 404, 1, 932); ctx.restore();
  } else {
    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = INK; ctx.fillRect(0, 0, 1080, 196);
    heroGeo(ctx, 576, 0, 504, 196);
    pill(ctx, 64, 40, 58, 28, 14, 30);
    drawText(ctx, 'CREATIVE BRIEF', 64, 122, 40, { pin: 'D', size: 40, weight: 900, fill: CREAM, id: 'CREATIVE BRIEF' });
    ctx.save(); ctx.globalAlpha = G.sheen; ctx.beginPath(); ctx.rect(0, 196, 1080, 914); ctx.clip();
    ctx.fillStyle = grad135(ctx, 0, 196, 1080, 914, [[0.06, 0], [0.22, 0.14], [0.38, 0]]); ctx.fillRect(0, 196, 1080, 914); ctx.restore();
    ctx.save(); ctx.globalAlpha = G.edge; ctx.fillStyle = white(0.8); ctx.fillRect(0, 196, 1080, 1); ctx.restore();
  }

  /* masthead */
  var mo = { pin: 'B', size: 18, weight: 700, fill: MUTE };
  drawText(ctx, 'DIGITAL MARKETERS’ CONFERENCE', x0, y0 + 30, 18, Object.assign({ track: 0.28, id: 'eyebrow', limit: 476.5 }, mo));
  drawText(ctx, 'JOB NO. DMC-2026', right, y0 + 30, 18, Object.assign({ track: 0.14, align: 'right', id: 'jobno' }, mo));
  var hy = y0 + 66, hLH = 72 * 0.85, w1 = drawText(ctx, 'BUILT TO ', x0, hy, hLH, { pin: 'D', size: 72, weight: 900, track: -0.02, fill: OB, id: 'brief-h1a' });
  drawText(ctx, 'SCALE', x0 + w1, hy, hLH, { pin: 'DI', size: 72, weight: 900, track: -0.02, fill: OB, id: 'brief-h1b' });
  drawText(ctx, 'DMC 2026', x0, hy + hLH, hLH, { pin: 'D', size: 72, weight: 900, track: -0.02, fill: CORAL, id: 'brief-h2' });
  ctx.fillStyle = GOLD; ctx.fillRect(x0, y0 + 208, P.bw, 2);

  /* rows */
  var rule = function (yBottom) { ctx.fillStyle = GOLD; ctx.fillRect(x0, yBottom - 1, P.bw, 1); };   /* a 1.5px CSS border paints as 1 whole pixel */
  var label = function (t, cy) { drawText(ctx, t, x0, cy - 10, 20, { pin: 'B', size: 20, weight: 700, track: 0.14, fill: TEAL, id: 'lbl-' + t }); };
  var lbl2 = function (t, top) { drawText(ctx, t, x0, top, 20, { pin: 'B', size: 20, weight: 700, track: 0.14, fill: TEAL, id: 'lbl-' + t }); };

  /* CLIENT */
  lbl2('CLIENT', rows0 + 28);
  var cy0 = rows0 + 20, chipW = chipTag(ctx, vx, cy0, 36, 12, 16, N.chip, lv.fill);
  var ny = cy0 + 36 + 14, nsz = f.size, nLH = nsz * 1.02, nameA = N.rawName ? 1 : 0.32;
  f.lines.forEach(function (ln, i) { drawText(ctx, ln, vx, ny + i * nLH, nLH, { pin: 'B', size: nsz, weight: 800, fill: OB, alpha: nameA, id: 'name' + i, limit: Vw }); });
  var ry = ny + nameH + 8, rl = wrap(ctx, N.roleShown, Vw, roleLines, 34, 500);
  rl.forEach(function (ln, i) { drawText(ctx, ln, vx, ry + i * 40, 40, { pin: 'B', size: 34, weight: 500, fill: DARK2, alpha: N.roleEmpty ? 0.45 : 1, id: 'role' + i, limit: Vw }); });
  if (N.showSession) {
    var sy = ry + rl.length * 40 + 10, ssz = fitLine(ctx, N.session, 28, 24, Vw - 14), sh = ssz * 1.2;
    ctx.fillStyle = TEAL; ctx.fillRect(vx, sy + (Math.max(22, sh) - 22) / 2, 4, 22);
    drawText(ctx, N.session, vx + 14, sy, sh, { pin: 'B', size: ssz, weight: 600, fill: OB, id: 'session', limit: Vw - 14 });
  }
  rule(rows0 + Hc);

  var ry0 = rows0 + Hc, mid = function (i) { return ry0 + i * rowH + (rowH - 1) / 2; };   /* 1.5px CSS borders are floored to 1px, so a row's content box is rowH − 1 */
  var val = function (t, x, i, id) { return drawText(ctx, t, x, mid(i) - 20, 40, { pin: 'B', size: 32, weight: 600, fill: OB, id: id || t }); };
  /* OBJECTIVE */
  label('OBJECTIVE', mid(0));
  var ow = measureW(ctx, lv.obj, 'B', 26, 700, 0) + 32;
  ctx.fillStyle = lv.fill; ctx.fillRect(vx, Math.round(mid(0) - 22), ow, 44);
  drawText(ctx, lv.obj, vx + 16, mid(0) - 13, 26, { pin: 'B', size: 26, weight: 700, fill: lv.ink, id: 'objective' });
  rule(ry0 + rowH);
  /* CHANNEL */
  label('CHANNEL', mid(1));
  var cw = measureW(ctx, 'IN PERSON', 'B', 16, 700, 0.14) + 26, cyc = mid(1);
  strokeRR(ctx, vx, Math.round(cyc - 17), cw, 34, 0, 1, OB);
  drawText(ctx, 'IN PERSON', vx + 13, cyc - 8, 16, { pin: 'B', size: 16, weight: 700, track: 0.14, fill: OB, id: 'in-person' });
  val('British Council, Accra', vx + cw + 14, 1);
  rule(ry0 + 2 * rowH);
  /* BUDGET + stamp */
  label('BUDGET', mid(2));
  val('GH₵' + N.price + ', approved', vx, 2, 'budget');
  rule(ry0 + 3 * rowH);
  /* DEADLINE, TURNAROUND */
  label('DEADLINE', mid(3)); val('Sat 21 Nov 2026, 10:00 AM', vx, 3, 'deadline'); rule(ry0 + 4 * rowH);
  label('TURNAROUND', mid(4)); val('5 hours. No extensions.', vx, 4, 'turnaround'); rule(ry0 + 5 * rowH);

  /* headshot, clip: the photo's own shadow [H], print sheen [S], top line [E] */
  if (hasPhoto) {
    var fx = right - 8 - 160, fy = rows0 + 20;
    rot(ctx, fx + 80, fy + 96, 3, function () {
      ctx.save(); ctx.globalAlpha = G.shadow; ctx.shadowColor = 'rgba(28,28,28,0.26)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(fx, fy, 160, 192); ctx.restore();
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(fx, fy, 160, 192);
      ctx.save(); ctx.beginPath(); ctx.rect(fx + 8, fy + 8, 144, 176); ctx.clip();
      cover(ctx, N.photo, fx + 8, fy + 8, 144, 176, 0.5, 0.3);
      ctx.globalAlpha = G.sheen; ctx.fillStyle = grad135(ctx, fx + 8, fy + 8, 144, 176, [[0.70, 0], [0.77, 0.20], [0.84, 0]]); ctx.fillRect(fx + 8, fy + 8, 144, 176);
      ctx.globalAlpha = G.edge; ctx.fillStyle = white(0.5); ctx.fillRect(fx + 8, fy + 8, 144, 1);
      ctx.restore();
    });
    var o = { x: right - 104 - 26, y: rows0 + 2 }, n = { x: right - 111 - 12, y: rows0 + 18 };
    rot(ctx, o.x + 13, o.y + 42, 3, function () { strokeRR(ctx, o.x, o.y, 26, 84, 13, 5, '#8E8A84'); });
    rot(ctx, n.x + 6, n.y + 27, 3, function () { strokeRR(ctx, n.x, n.y, 12, 54, 6, 4, '#8E8A84'); });
    var h1 = { x: right - 105 - 24, y: rows0 + 3 }, h2 = { x: right - 112 - 10, y: rows0 + 19 };
    ctx.save(); ctx.globalAlpha = G.edge;
    rot(ctx, h1.x + 12, h1.y + 41, 3, function () { topLeftArc(ctx, h1.x, h1.y, 24, 82, 12, 1, '#FFFFFF', 0.75); });
    rot(ctx, h2.x + 5, h2.y + 26, 3, function () { topLeftArc(ctx, h2.x, h2.y, 10, 52, 5, 1, '#FFFFFF', 0.70); });
    ctx.restore();
  }

  /* stamp: matte (no gloss), 200×80 about its own centre, right edge at body right + 4 */
  var sx = right + 4 - 200, sy2 = mid(2) - 40;
  rot(ctx, sx + 100, sy2 + 40, -6, function () {
    ctx.save(); ctx.globalAlpha = 0.92;
    strokeRR(ctx, sx, sy2, 200, 80, 8, 5, CORAL); strokeRR(ctx, sx + 8, sy2 + 8, 184, 64, 4, 1, CORAL);
    drawText(ctx, 'APPROVED', sx + 100, sy2 + 17, 24, { pin: 'D', size: 24, weight: 900, fill: CORAL, align: 'center', id: 'APPROVED' });
    drawText(ctx, 'DMC 2026 · 21.11.26', sx + 100, sy2 + 48, 13, { pin: 'B', size: 13, weight: 700, track: 0.14, fill: CORAL, align: 'center', id: 'stamp-sub' });
    ctx.restore();
  });

  /* footer: QR, labels, url, hashtags (4:5) */
  fillRR(ctx, x0, P.qrY, 112, 112, 8, CREAM); strokeRR(ctx, x0, P.qrY, 112, 112, 8, 2, OB);
  drawQR(ctx, N.qrUrl, x0 + 10, P.qrY + 10, 92);
  var lx = x0 + 136;
  drawText(ctx, 'SCAN TO REGISTER', lx, P.scanY, 18, { pin: 'B', size: 18, weight: 700, track: 0.14, fill: TEAL, id: 'scan' });
  drawText(ctx, N.qrLabel, lx, P.urlY, 26, { pin: 'B', size: 26, weight: 600, fill: OB, id: 'url' });
  if (!st) drawText(ctx, '#DMC2026 · #BuiltToScale', lx, 1070, 22, { pin: 'B', size: 22, weight: 600, fill: MUTE, id: 'hashtags' });

  band(ctx, P.band, N);
  if (st) {
    drawText(ctx, '#DMC2026 · #BuiltToScale', 64, 1604, 28, { pin: 'B', size: 28, weight: 600, fill: SOFT, id: 'hashtags' });
    if (A.img.field) { ctx.save(); ctx.beginPath(); ctx.rect(0, 1660, 1080, 260); ctx.clip(); ctx.globalAlpha = 0.6; ctx.fillStyle = tilePattern(ctx, A.img.field, 0, 1440); ctx.fillRect(0, 1660, 1080, 260); ctx.restore(); }
  }
  return { Hc: Hc, rowH: rowH, name: f, roleLines: roleLines };
}

/* BUILT / TO / SCALE: pins D and D + DI, LH 0.85, tracking −0.02em, SCALE in the foil */
function headline(ctx, x, y, size, kind) {
  var LH = size * 0.85, o = { pin: 'D', size: size, weight: 900, track: -0.02, fill: CREAM };
  if (kind === 'badge') {
    drawText(ctx, 'BUILT', x, y, LH, Object.assign({ id: 'BUILT' }, o));
    drawText(ctx, 'TO', x, y + LH, LH, Object.assign({ id: 'TO' }, o));
    var w = measureW(ctx, 'SCALE', 'DI', size, 900, -0.02);
    drawText(ctx, 'SCALE', x, y + 2 * LH, LH, { pin: 'DI', size: size, weight: 900, track: -0.02, fill: foil(ctx, x, w + 0.08 * size), id: 'SCALE' });
  }
}

/* ---------- photos: decoded on the device, never uploaded ---------- */
/* A File/Blob → an upright bitmap no larger than 2000px on its long side. createImageBitmap with imageOrientation 'from-image'
   applies the EXIF rotation; where that option throws (older Safari) an <img> decodes it, which applies the rotation by default. */
function decodePhoto(file, max) {
  max = max || 2000;
  var shrink = function (src, w, h) {
    var k = Math.min(1, max / Math.max(w, h));
    if (k === 1) return src;
    var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    var x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
    if (src.close) src.close();
    return c;
  };
  var viaImg = function () {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), i = new Image();
      i.onload = function () { URL.revokeObjectURL(u); var w = i.naturalWidth, h = i.naturalHeight; res(shrink(i, w, h)); };
      i.onerror = function () { URL.revokeObjectURL(u); rej(new Error('decode')); };
      i.src = u;
    });
  };
  if (!root.createImageBitmap) return viaImg();
  return root.createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (b) { return shrink(b, b.width, b.height); }, viaImg);
}

/* ---------- entry point ---------- */
function renderFlyer(ctx, state, opts) {
  var cv = ctx.canvas, N = normalize(ctx, state || {});
  var H = N.story ? 1920 : 1350;
  if (cv.width !== 1080 || cv.height !== H) { cv.width = 1080; cv.height = H; }
  LOG = opts && opts.debug ? [] : null;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
  ctx.clearRect(0, 0, 1080, H);
  var info = N.tpl === 'brief' ? drawBrief(ctx, N) : drawBadge(ctx, N);
  var log = LOG; LOG = null;
  return { log: log, info: info, state: N };
}

/* ---------- server: DMC Studio runs this same file under Node with @napi-rs/canvas (Skia) ---------- */
function useNode(napi, opts) {
  var fs = require('fs'), path = require('path'), ROOT = opts.root;
  var local = function (url) {
    var rel = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '').split('?')[0];
    var full = path.resolve(ROOT, rel);
    return full.indexOf(path.resolve(ROOT, 'assets')) === 0 ? full : null;
  };
  ENV.makeCanvas = function (w, h) { return napi.createCanvas(w, h); };
  ENV.Path2D = napi.Path2D; ENV.DOMMatrix = napi.DOMMatrix;
  var qr = require('qrcode-generator'); ENV.qrcode = function () { return qr; };
  ENV.loadImage = function (url) {
    var f = local(url);
    if (!f || !fs.existsSync(f)) return Promise.resolve(null);
    return napi.loadImage(fs.readFileSync(f)).catch(function () { return null; });
  };
  ENV.loadJSON = function (url) {
    var f = local(url);
    try { return Promise.resolve(f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null); } catch (e) { return Promise.resolve(null); }
  };
  ENV.loadFonts = function (files, ok) {
    files.forEach(function (f) {
      var fp = path.join(ROOT, 'assets', 'flyer', 'fonts', f[1]);
      try { ok[f[1]] = !!napi.GlobalFonts.registerFromPath(fp, f[0]); } catch (e) { ok[f[1]] = false; }
    });
    return Promise.resolve();
  };
  A.ready = null; _mx = {};
  detect();
  return root.DMCFlyer;
}

root.DMCFlyer = {
  TICKET_PRICE: TICKET_PRICE, DEFAULT_QR: DEFAULT_QR, GLOSS: GLOSS, LEVELS: LEVELS, CHIPS: CHIPS, PARTNERS: PARTNERS,
  load: load, renderFlyer: renderFlyer, decodePhoto: decodePhoto, assets: A, useNode: useNode, normalize: function (S) { return normalize(null, S); },
  _noLetterSpacing: function (v) { forceNoLS = !!v; _mx = {}; },
  _internal: { drawText: drawText, measureW: measureW, fitName: fitName, fitLine: fitLine, wrap: wrap, normalize: normalize, rrPath: rrPath, fillRR: fillRR, cover: cover, contain: contain,
               tilePattern: tilePattern, sheenGrad: sheenGrad, heroGeo: heroGeo, foil: foil, pill: pill, chipTag: chipTag, band: band, drawQR: drawQR, headline: headline,
               bandRow: bandRow, badgeLayout: badgeLayout, badgeLeft: badgeLeft, badgeObject: badgeObject, badgeStrap: badgeStrap, badgeCard: badgeCard, drawBadge: drawBadge, drawBrief: drawBrief,
               strokeRR: strokeRR, rot: rot, topLeftArc: topLeftArc, grad135: grad135, vmetrics: vmetrics, setLog: function (v) { LOG = v; },
               C: { CREAM: CREAM, INK: INK, OB: OB, GOLD: GOLD, TEAL: TEAL, CORAL: CORAL, SOFT: SOFT, MUTE: MUTE, DARK2: DARK2 },
               white: white, black: black, logBox: function () { return LOG; } }
};
if (typeof module === 'object' && module.exports) module.exports = root.DMCFlyer;
})(typeof window !== 'undefined' ? window : {});
