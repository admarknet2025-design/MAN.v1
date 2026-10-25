/* DMC Studio renderer: draws the on-brand artwork for every template and size, on the server, with @napi-rs/canvas (Skia).
   The same code and the same embedded Archivo files run for everyone, so a PNG is identical whoever asks for it.

   Brand: Obsidian #1C1C1C, Signal Cream #F4EFE6, Build Teal #2A7B74, Pulse Coral #D95F45. Those four are the whole
   palette; nothing yellow or brown is drawn here, and tools/studio-check.js fails if any ever appears. The kente strip is
   therefore teal | coral | cream on obsidian, not the four-colour strip on the main site.

   Layout system: every template draws into the same frame (header, kente divider, footer, optional QR) and then fills a
   content rectangle. Sizes fall in four shapes: tall (story), portrait (feed), square and wide (link posts and X). */
'use strict';

const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const qrcode = require('qrcode-generator');
const DATA = require('./data.json');

const ROOT = path.resolve(__dirname, '..', '..');
const C = { ob: '#1C1C1C', ob2: '#232323', cr: '#F4EFE6', te: '#2A7B74', co: '#D95F45' };
const CR = (a) => 'rgba(244,239,230,' + a + ')';

/* ---- fonts: static instances of Archivo (OFL) cut from the site's variable font ---- */
const FONT_DIR = path.join(__dirname, 'fonts');
const FONTS = {
  R: 'Archivo-Regular.ttf', M: 'Archivo-Medium.ttf', SB: 'Archivo-SemiBold.ttf', B: 'Archivo-Bold.ttf',
  XB: 'ArchivoExpanded-ExtraBold.ttf', XK: 'ArchivoExpanded-Black.ttf'
};
const F = {};
Object.keys(FONTS).forEach((k) => {
  F[k] = 'DMCArchivo' + k;
  if (!GlobalFonts.has(F[k])) GlobalFonts.registerFromPath(path.join(FONT_DIR, FONTS[k]), F[k]);
});

/* ---- sizes ---- */
const SIZES = {
  'ig-feed':       { w: 1080, h: 1350, kind: 'portrait' },
  'story':         { w: 1080, h: 1920, kind: 'tall' },
  'square':        { w: 1080, h: 1080, kind: 'square' },
  'linkedin-link': { w: 1200, h: 627,  kind: 'wide' },
  'x':             { w: 1600, h: 900,  kind: 'wide' }
};

const MOVEMENT_ACCENT = { 'Build Yourself': C.te, 'Build Your Team': C.co, 'Build Your Work': C.cr };
const accentFor = (movement) => MOVEMENT_ACCENT[movement] || C.te;
/* text that sits on an accent fill */
const onAccent = (accent) => (accent === C.cr ? C.ob : '#FFFFFF');
/* an accent used as text or a thin line on obsidian: teal is too dark to read there, so it becomes cream */
const accentInk = (accent) => (accent === C.te ? C.cr : accent);

/* ---- small helpers ---- */
function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200);
}
function initials(name) {
  const w = clean(name).split(' ').filter(Boolean);
  return ((w[0] || '')[0] || '').toUpperCase() + (w.length > 1 ? (w[w.length - 1][0] || '').toUpperCase() : '');
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  words.forEach((w) => {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  return lines;
}
/* a single very long word is cut with an ellipsis rather than overflowing */
function clipLine(ctx, line, maxW) {
  if (ctx.measureText(line).width <= maxW) return line;
  let t = line;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/* tracked (letter-spaced) caps label; returns its width */
function trackedWidth(ctx, text, spacing) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return w - spacing;
}
function drawTracked(ctx, text, x, y, spacing, align) {
  const w = trackedWidth(ctx, text, spacing);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left';
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
  return w;
}

/* ---- layout ---- */
function layout(sizeKey, opts) {
  const s = SIZES[sizeKey];
  const w = s.w, h = s.h, kind = s.kind;
  const u = kind === 'wide' ? Math.min(w / 1330, h / 700) : w / 1080;
  const pad = Math.round((kind === 'wide' ? 56 : 64) * u);
  const safeTop = kind === 'tall' ? 200 : 0;      /* story UI covers the top of the frame */
  const safeBottom = kind === 'tall' ? 290 : 0;   /* and the reply bar covers the bottom */
  const headerY = safeTop + Math.round(46 * u);
  const logoH = Math.round(50 * u);
  const footerH = Math.round(124 * u);
  const footerTop = h - safeBottom - footerH - Math.round((kind === 'tall' ? 0 : 20) * u);
  const qr = opts && opts.qr ? Math.round(168 * u) : 0;
  const contentTop = headerY + logoH + Math.round(34 * u);
  const contentBottom = footerTop - Math.round(30 * u) - (qr ? qr + Math.round(48 * u) : 0);
  return {
    grow: { tall: 1.4, portrait: 1.2, square: 1.08, wide: 1 }[kind],
    w, h, kind, u, pad, safeTop, safeBottom, headerY, logoH, footerTop, footerH, qr,
    content: { x: pad, y: contentTop, w: w - pad * 2, h: contentBottom - contentTop }
  };
}

/* ---- frame ---- */
let logoImg = null;
async function getLogo() {
  if (!logoImg) logoImg = await loadImage(fs.readFileSync(path.join(ROOT, 'assets', 'man-logo.png')));
  return logoImg;
}

function kente(ctx, x, y, w, hh, u) {
  /* teal | coral | cream, each 18 wide with 2 of obsidian between */
  const seg = [[C.te, 18], [C.ob, 2], [C.co, 18], [C.ob, 2], [C.cr, 18], [C.ob, 2]];
  let cx = x;
  while (cx < x + w) {
    for (let i = 0; i < seg.length && cx < x + w; i++) {
      const sw = Math.min(seg[i][1] * u, x + w - cx);
      ctx.fillStyle = seg[i][0];
      ctx.fillRect(cx, y, sw, hh);
      cx += seg[i][1] * u;
    }
  }
}

function eventLine() { return 'Sat 21 Nov 2026  ·  10AM–3PM'; }

async function frame(ctx, L, accent, qrUrl) {
  const { w, h, u, pad } = L;
  ctx.fillStyle = C.ob;
  ctx.fillRect(0, 0, w, h);

  /* corner triangles, top right (coral behind, teal in front) */
  const t1 = Math.round((L.kind === 'wide' ? 250 : 270) * u), t2 = Math.round(t1 * 0.54);
  ctx.fillStyle = C.co;
  ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w, t1); ctx.lineTo(w - t1, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.te;
  ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w, t2); ctx.lineTo(w - t2, 0); ctx.closePath(); ctx.fill();

  /* header: M·A·N logo, a rule, then the event name and theme */
  const logo = await getLogo();
  const lw = Math.round(L.logoH * logo.width / logo.height);
  ctx.drawImage(logo, pad, L.headerY, lw, L.logoH);
  const hx = pad + lw + Math.round(22 * u);
  ctx.fillStyle = CR(0.28);
  ctx.fillRect(hx, L.headerY + Math.round(4 * u), Math.max(2, Math.round(2 * u)), L.logoH - Math.round(8 * u));
  ctx.fillStyle = C.cr;
  ctx.font = Math.round(24 * u) + 'px ' + F.XK;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('DMC 2026', hx + Math.round(22 * u), L.headerY + Math.round(22 * u));
  ctx.font = Math.round(15 * u) + 'px ' + F.B;
  ctx.fillStyle = CR(0.72);
  drawTracked(ctx, 'BUILT TO SCALE', hx + Math.round(22 * u), L.headerY + Math.round(46 * u), 3.2 * u, 'left');

  /* footer: kente divider, date, venue, site */
  kente(ctx, 0, L.footerTop, w, Math.round(14 * u), u);
  const fy = L.footerTop + Math.round(14 * u);
  ctx.fillStyle = C.cr;
  ctx.font = Math.round(36 * u) + 'px ' + F.XK;
  ctx.textAlign = 'left';
  ctx.fillText('21 NOV 2026', pad, fy + Math.round(52 * u));
  ctx.font = Math.round(19 * u) + 'px ' + F.B;
  ctx.fillStyle = CR(0.8);
  ctx.fillText('Saturday  ·  10AM–3PM  ·  British Council, Accra', pad, fy + Math.round(84 * u));
  ctx.font = Math.round(24 * u) + 'px ' + F.XB;
  ctx.fillStyle = C.cr;
  ctx.textAlign = 'right';
  ctx.fillText('mangh.org', w - pad, fy + Math.round(52 * u));
  ctx.font = Math.round(17 * u) + 'px ' + F.B;
  ctx.fillStyle = CR(0.7);
  ctx.fillText('#DMC2026  #BuiltToScale', w - pad, fy + Math.round(84 * u));
  ctx.textAlign = 'left';

  /* QR code (story and TikTok sizes, where a caption cannot hold a clickable link) */
  if (L.qr && qrUrl) {
    const q = qrcode(0, 'M');
    q.addData(qrUrl);
    q.make();
    const n = q.getModuleCount();
    const tile = L.qr + Math.round(28 * u);
    const qx = w - pad - tile, qy = L.footerTop - Math.round(30 * u) - tile;
    ctx.fillStyle = C.cr;
    ctx.fillRect(qx, qy, tile, tile);
    const cell = L.qr / n, off = (tile - L.qr) / 2;
    ctx.fillStyle = C.ob;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (q.isDark(r, c)) ctx.fillRect(Math.round(qx + off + c * cell), Math.round(qy + off + r * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = C.cr;
    ctx.font = Math.round(22 * u) + 'px ' + F.XB;
    ctx.fillText('SCAN TO', qx - Math.round(24 * u), qy + Math.round(tile / 2) - Math.round(4 * u));
    ctx.fillText('GET TICKETS', qx - Math.round(24 * u), qy + Math.round(tile / 2) + Math.round(26 * u));
    ctx.textAlign = 'left';
  }
}

/* ---- stacked text blocks that shrink to fit ---- */
/* an item is { measure(ctx, w, s) -> { h, paint(ctx, x, y, w, align) } }; s scales every size so a stack can be fitted */
function textItem(o) {
  return {
    measure(ctx, w, s) {
      const min = (o.min || o.size * 0.6) * s;
      let size = o.size * s;
      let lines;
      for (;;) {
        ctx.font = Math.round(size) + 'px ' + o.fam;
        const text = o.upper ? o.text.toUpperCase() : o.text;
        lines = wrap(ctx, text, w);
        if ((lines.length <= (o.maxLines || 1) && lines.every((l) => ctx.measureText(l).width <= w)) || size <= min) break;
        size -= 2;
      }
      const maxLines = o.maxLines || 1;
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = clipLine(ctx, lines[maxLines - 1].replace(/…$/, '') + '…', w);
      }
      lines = lines.map((l) => clipLine(ctx, l, w));
      const lh = size * (o.lineH || 1.12);
      const h = lines.length * lh;
      return {
        h,
        paint(c, x, y, bw, align) {
          c.font = Math.round(size) + 'px ' + o.fam;
          c.fillStyle = o.color;
          c.textBaseline = 'alphabetic';
          lines.forEach((l, i) => {
            const base = y + i * lh + size * 0.82 + (lh - size) / 2;
            const tx = align === 'center' ? x + bw / 2 : align === 'right' ? x + bw : x;
            if (o.track) drawTracked(c, l, tx, base, o.track * s, align);
            else { c.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'; c.fillText(l, tx, base); }
          });
          c.textAlign = 'left';
        }
      };
    }
  };
}
const gap = (px) => ({ measure: (ctx, w, s) => ({ h: px * s, paint() {} }) });

function chipItem(o) {
  return {
    measure(ctx, w, s) {
      const size = o.size * s;
      ctx.font = Math.round(size) + 'px ' + (o.fam || F.XB);
      const tw = trackedWidth(ctx, o.text, (o.track || 0) * s);
      const px = size * 0.9, h = size * 2.1;
      return {
        h,
        paint(c, x, y, bw, align) {
          const cw = Math.min(bw, tw + px * 2);
          const cx = align === 'center' ? x + (bw - cw) / 2 : align === 'right' ? x + bw - cw : x;
          c.fillStyle = o.fill;
          c.fillRect(cx, y, cw, h);
          c.fillStyle = o.color;
          c.font = Math.round(size) + 'px ' + (o.fam || F.XB);
          c.textBaseline = 'alphabetic';
          drawTracked(c, o.text, cx + px, y + h / 2 + size * 0.35, (o.track || 0) * s, 'left');
        }
      };
    }
  };
}

/* a block with an accent bar on its left; children are stacked inside it */
function barItem(o, children) {
  return {
    measure(ctx, w, s) {
      const bar = 8 * s, padL = 24 * s;
      const inner = measureStack(ctx, children, w - bar - padL, s);
      return {
        h: inner.h,
        paint(c, x, y, bw, align) {
          c.fillStyle = o.color;
          c.fillRect(x, y, bar, inner.h);
          inner.paint(c, x + bar + padL, y, 'left');
        }
      };
    }
  };
}

function measureStack(ctx, items, w, s) {
  const ms = items.map((it) => it.measure(ctx, w, s));
  const h = ms.reduce((a, m) => a + m.h, 0);
  return {
    h,
    paint(c, x, y, align) {
      let cy = y;
      ms.forEach((m) => { m.paint(c, x, cy, w, align); cy += m.h; });
    }
  };
}

/* fit a stack into a box by scaling it down until it fits (never above `grow`) */
function fitStack(ctx, items, box, grow) {
  let s = grow || 1, st;
  for (; s >= 0.5; s -= 0.04) {
    st = measureStack(ctx, items, box.w, s);
    if (st.h <= box.h) break;
  }
  return st;
}
function placeStack(ctx, items, box, align, vcenter, grow) {
  const st = fitStack(ctx, items, box, grow);
  const y = vcenter ? box.y + (box.h - Math.min(st.h, box.h)) / 2 : box.y;
  st.paint(ctx, box.x, y, align);
  return st.h;
}

/* ---- photo ---- */
function coverDraw(ctx, img, cx, cy, r, bias) {
  const iw = img.width, ih = img.height;
  const sq = Math.min(iw, ih);
  const sx = (iw - sq) / 2, sy = (ih - sq) * (bias == null ? 0.18 : bias);
  ctx.drawImage(img, sx, sy, sq, sq, cx - r, cy - r, r * 2, r * 2);
}

function drawPhoto(ctx, L, img, name, cx, cy, r, accent, bias) {
  const u = L.u;
  /* dashed outer ring (coral, or teal where the accent is coral) and a solid inner ring in the accent */
  ctx.save();
  ctx.strokeStyle = accent === C.co ? C.te : C.co;
  ctx.lineWidth = Math.max(3, 4 * u);
  ctx.setLineDash([14 * u, 10 * u]);
  ctx.beginPath(); ctx.arc(cx, cy, r + 30 * u, -0.3, Math.PI * 1.62); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = accent === C.te ? C.cr : accent;
  ctx.lineWidth = Math.max(4, 6 * u);
  ctx.beginPath(); ctx.arc(cx, cy, r + 12 * u, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (img) coverDraw(ctx, img, cx, cy, r, bias);
  else {
    ctx.fillStyle = C.te;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = C.cr;
    ctx.font = Math.round(r * 0.8) + 'px ' + F.XK;
    ctx.textAlign = 'center';
    ctx.fillText(initials(name), cx, cy + r * 0.28);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/* Photo beside or above a text stack. Tall and portrait stack them; square and wide use two columns. */
function profileLayout(ctx, L, o) {
  const R = L.content, u = L.u;
  if (L.kind === 'tall' || L.kind === 'portrait') {
    const d = Math.min(R.w * (L.kind === 'tall' ? 0.62 : 0.52), R.h * (L.kind === 'tall' ? 0.4 : 0.4));
    const r = d / 2 - 22 * u;
    const cy = R.y + 30 * u + d / 2;
    drawPhoto(ctx, L, o.img, o.name, L.w / 2, cy, r, o.accent, o.bias);
    const top = cy + d / 2 + 30 * u;
    placeStack(ctx, o.items(), { x: R.x, y: top, w: R.w, h: R.y + R.h - top }, 'center', false, L.grow);
  } else {
    const d = Math.min(R.h * 0.96, R.w * 0.36);
    const r = d / 2 - 22 * u;
    const cx = R.x + R.w - d / 2 - 8 * u, cy = R.y + R.h / 2;
    drawPhoto(ctx, L, o.img, o.name, cx, cy, r, o.accent, o.bias);
    placeStack(ctx, o.items(), { x: R.x, y: R.y, w: R.w - d - 56 * u, h: R.h }, 'left', true, L.grow);
  }
}

/* ---- templates ---- */
const T = {};

T.speaker = (ctx, L, f, a) => {
  const accent = accentFor(f.movement);
  const role = (f.role || 'Speaker').toUpperCase();
  profileLayout(ctx, L, {
    img: a.photo, name: f.name, accent,
    items: () => [
      chipItem({ text: role, size: 22 * L.u, fill: accent, color: onAccent(accent), track: 3 * L.u }),
      gap(22 * L.u),
      textItem({ text: f.name || 'Your Name', fam: F.XK, size: 76 * L.u, min: 36 * L.u, color: C.cr, maxLines: 2, upper: true, lineH: 1.06 }),
      gap(14 * L.u),
      textItem({ text: f.title || '', fam: F.B, size: 30 * L.u, min: 20 * L.u, color: C.cr, maxLines: 2 }),
      textItem({ text: f.company || '', fam: F.SB, size: 28 * L.u, min: 20 * L.u, color: CR(0.78), maxLines: 1 }),
      gap(f.session ? 30 * L.u : 0),
      f.session ? barItem({ color: accent }, [
        textItem({ text: 'SESSION', fam: F.B, size: 17 * L.u, color: accentInk(accent), track: 3 * L.u }),
        gap(6 * L.u),
        textItem({ text: f.session, fam: F.XB, size: 32 * L.u, min: 20 * L.u, color: C.cr, maxLines: 2, lineH: 1.1 }),
        f.time ? textItem({ text: f.time + '  ·  British Council Accra', fam: F.SB, size: 20 * L.u, color: CR(0.78), maxLines: 1 }) : gap(0)
      ]) : gap(0)
    ]
  });
};

T.attending = (ctx, L, f, a) => {
  const accent = C.te;
  const head = L.kind === 'tall' || L.kind === 'portrait';
  profileLayout(ctx, L, {
    img: a.photo, name: f.name, accent,
    items: () => [
      textItem({ text: "I'M ATTENDING", fam: F.XK, size: (head ? 92 : 78) * L.u, min: 40 * L.u, color: C.cr, maxLines: head ? 2 : 2, lineH: 1.02 }),
      gap(16 * L.u),
      textItem({ text: 'THE DIGITAL MARKETERS’ CONFERENCE', fam: F.B, size: 19 * L.u, color: C.co, track: 2.4 * L.u }),
      gap(26 * L.u),
      {
        measure(ctx2, w, s) {
          /* name badge, as on the public flyer: a teal block holding name and title */
          const a1 = textItem({ text: f.name || 'Your Name', fam: F.B, size: 32 * L.u, min: 20 * L.u, color: '#FFFFFF', maxLines: 1 }).measure(ctx2, w - 44 * s, s);
          const sub = [f.title, f.company].filter(Boolean).join(', ');
          const a2 = textItem({ text: sub, fam: F.R, size: 22 * L.u, min: 16 * L.u, color: 'rgba(255,255,255,0.92)', maxLines: 2 }).measure(ctx2, w - 44 * s, s);
          const h = a1.h + (sub ? a2.h + 6 * s : 0) + 36 * s;
          return {
            h,
            paint(c, x, y, bw, align) {
              c.fillStyle = C.te;
              c.fillRect(x, y, bw, h);
              c.fillStyle = C.cr;
              c.fillRect(x, y, 6 * s, h);
              a1.paint(c, x + 28 * s, y + 18 * s, bw - 44 * s, 'left');
              if (sub) a2.paint(c, x + 28 * s, y + 18 * s + a1.h + 6 * s, bw - 44 * s, 'left');
            }
          };
        }
      },
      f.building ? gap(26 * L.u) : gap(0),
      f.building ? barItem({ color: C.co }, [
        textItem({ text: 'I’M BUILDING', fam: F.B, size: 17 * L.u, color: C.co, track: 3 * L.u }),
        gap(6 * L.u),
        textItem({ text: f.building, fam: F.XB, size: 34 * L.u, min: 20 * L.u, color: C.cr, maxLines: 3, lineH: 1.12 })
      ]) : gap(0)
    ]
  });
};

T.sponsor = async (ctx, L, f, a) => {
  const R = L.content, u = L.u;
  const accent = C.te;
  const isSponsor = /sponsor/i.test(f.tier || '');
  const stack = () => [
    chipItem({ text: isSponsor ? 'SPONSOR' : 'PARTNER', size: 22 * u, fill: C.te, color: '#FFFFFF', track: 3 * u }),
    gap(22 * u),
    textItem({ text: f.name || 'Partner name', fam: F.XK, size: 70 * u, min: 34 * u, color: C.cr, maxLines: 2, upper: true, lineH: 1.06 }),
    gap(14 * u),
    textItem({ text: f.tier || '', fam: F.XB, size: 30 * u, min: 20 * u, color: C.co, maxLines: 2 }),
    textItem({ text: f.role || '', fam: F.SB, size: 26 * u, min: 18 * u, color: CR(0.82), maxLines: 2 }),
    gap(18 * u),
    textItem({ text: 'DMC 2026  ·  BUILT TO SCALE', fam: F.B, size: 17 * u, color: CR(0.6), track: 3 * u })
  ];
  const drawTile = (x, y, w, h) => {
    ctx.fillStyle = C.cr;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.te;
    ctx.fillRect(x, y, w, Math.max(6, 8 * u));
    if (a.logo) {
      const pad = 44 * u;
      const sc = Math.min((w - pad * 2) / a.logo.width, (h - pad * 2) / a.logo.height, 2.2);
      const dw = a.logo.width * sc, dh = a.logo.height * sc;
      ctx.drawImage(a.logo, x + (w - dw) / 2, y + (h - dh) / 2 + 4 * u, dw, dh);
    } else {
      ctx.fillStyle = C.ob;
      ctx.font = Math.round(46 * u) + 'px ' + F.XK;
      ctx.textAlign = 'center';
      ctx.fillText((f.name || '').toUpperCase().slice(0, 18), x + w / 2, y + h / 2 + 14 * u);
      ctx.textAlign = 'left';
    }
  };
  if (L.kind === 'tall' || L.kind === 'portrait') {
    const th = Math.min(R.h * 0.34, R.w * 0.46);
    const st = fitStack(ctx, stack(), { x: R.x, y: R.y, w: R.w, h: R.h - th - 40 * u }, L.grow);
    const y0 = R.y + Math.max(0, (R.h - (th + 40 * u + st.h)) / 2);
    drawTile(R.x, y0, R.w, th);
    st.paint(ctx, R.x, y0 + th + 40 * u, 'left');
  } else {
    const tw = Math.min(R.w * 0.42, R.h * 1.15);
    const th = Math.min(R.h * 0.92, tw * 0.8);
    drawTile(R.x + R.w - tw, R.y + (R.h - th) / 2, tw, th);
    placeStack(ctx, stack(), { x: R.x, y: R.y, w: R.w - tw - 56 * u, h: R.h }, 'left', true, L.grow);
  }
};

T.quote = (ctx, L, f, a) => {
  const R = L.content, u = L.u;
  const accent = accentFor(f.movement);
  const quote = f.quote || 'Your quote goes here.';
  const personH = 120 * u;
  const qBox = { x: R.x, y: R.y + 130 * u, w: R.w, h: R.h - 130 * u - personH - 40 * u };
  const qst = fitStack(ctx, [textItem({ text: quote, fam: F.XB, size: (L.kind === 'wide' ? 52 : 62) * u, min: 24 * u, color: C.cr, maxLines: 10, lineH: 1.16 })], qBox, L.grow);
  const qy = qBox.y + Math.max(0, (qBox.h - qst.h) / 2) * (L.kind === 'wide' ? 0.6 : 1);
  /* big opening mark in coral, tied to the top of the text */
  ctx.fillStyle = C.co;
  ctx.font = Math.round(190 * u) + 'px ' + F.XK;
  ctx.textAlign = 'left';
  ctx.fillText('\u201C', R.x - 4 * u, qy - 130 * u + 150 * u);
  qst.paint(ctx, R.x, qy, 'left');
  /* attribution */
  const py = R.y + R.h - personH;
  ctx.fillStyle = accent;
  ctx.fillRect(R.x, py - 18 * u, 120 * u, Math.max(4, 6 * u));
  const r = 48 * u;
  const cx = R.x + r + 4 * u, cy = py + personH / 2 + 6 * u;
  if (a.photo) {
    ctx.strokeStyle = accent === C.te ? C.cr : accent; ctx.lineWidth = Math.max(3, 5 * u);
    ctx.beginPath(); ctx.arc(cx, cy, r + 8 * u, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); coverDraw(ctx, a.photo, cx, cy, r, 0.18); ctx.restore();
  }
  const tx = a.photo ? cx + r + 34 * u : R.x;
  placeStack(ctx, [
    textItem({ text: f.name || 'Speaker name', fam: F.XK, size: 32 * u, min: 18 * u, color: C.cr, maxLines: 1, upper: true }),
    textItem({ text: [f.title, f.company].filter(Boolean).join(', '), fam: F.SB, size: 22 * u, min: 15 * u, color: CR(0.8), maxLines: 2 })
  ], { x: tx, y: py - 4 * u, w: R.x + R.w - tx, h: personH + 20 * u }, 'left', true);
};

function daysToGo(now) {
  const ev = Date.UTC(2026, 10, 21);
  const t = new Date(now || Date.now());
  const today = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); /* Accra is UTC+0 all year */
  return Math.round((ev - today) / 86400000);
}

T.countdown = (ctx, L, f, a) => {
  const R = L.content, u = L.u;
  const days = daysToGo(a.now);
  const big = days > 0 ? String(days) : days === 0 ? 'TODAY' : 'THANK YOU';
  const unit = days > 1 ? 'DAYS TO GO' : days === 1 ? 'DAY TO GO' : days === 0 ? 'DMC 2026 IS ON' : 'FOR JOINING DMC 2026';
  const wide = L.kind === 'wide' || L.kind === 'square';
  const numSize = (days > 0 ? (wide ? 360 : 440) : (wide ? 150 : 170)) * u;
  const box = wide ? { x: R.x, y: R.y, w: R.w * 0.54, h: R.h } : R;
  const items = [
    textItem({ text: big, fam: F.XK, size: numSize, min: 60 * u, color: C.cr, maxLines: 1, lineH: 0.98 }),
    gap(4 * u),
    textItem({ text: unit, fam: F.XK, size: 62 * u, min: 26 * u, color: C.co, maxLines: 1 })
  ];
  placeStack(ctx, items, box, wide ? 'left' : 'center', true);
  if (wide) {
    const x = R.x + R.w * 0.6;
    ctx.fillStyle = C.te;
    ctx.fillRect(x - 28 * u, R.y + R.h * 0.12, Math.max(4, 6 * u), R.h * 0.76);
    placeStack(ctx, [
      textItem({ text: 'DIGITAL MARKETERS’ CONFERENCE', fam: F.B, size: 20 * u, color: C.co, track: 2.4 * u }),
      gap(10 * u),
      textItem({ text: 'Built To Scale', fam: F.XK, size: 54 * u, min: 24 * u, color: C.cr, maxLines: 2, upper: true }),
      gap(18 * u),
      textItem({ text: 'Get your ticket at mangh.org', fam: F.SB, size: 26 * u, min: 16 * u, color: CR(0.85), maxLines: 2 })
    ], { x, y: R.y, w: R.x + R.w - x, h: R.h }, 'left', true);
  } else {
    /* tall/portrait: add the call to action under the number */
    const y = R.y + R.h - 120 * u;
    ctx.fillStyle = CR(0.85);
    ctx.font = Math.round(28 * u) + 'px ' + F.SB;
    ctx.textAlign = 'center';
    ctx.fillText('Get your ticket at mangh.org', L.w / 2, y);
    ctx.textAlign = 'left';
  }
};

T.session = (ctx, L, f, a) => {
  const R = L.content, u = L.u;
  const accent = accentFor(f.movement);
  const names = (f.speakers || '').split(/\s*[·,]\s*/).filter(Boolean).slice(0, 6);
  const faces = a.faces || [];
  const wide = L.kind === 'wide' || L.kind === 'square';
  const stack = () => [
    chipItem({ text: (f.movement || f.badge || 'Session').toUpperCase(), size: 22 * u, fill: accent, color: onAccent(accent), track: 3 * u }),
    gap(18 * u),
    textItem({ text: f.time ? f.time.replace(/-/g, '–') : '', fam: F.XK, size: 46 * u, min: 24 * u, color: accentInk(accent), maxLines: 1 }),
    gap(10 * u),
    textItem({ text: f.title || 'Session title', fam: F.XK, size: 72 * u, min: 30 * u, color: C.cr, maxLines: 4, upper: true, lineH: 1.06 }),
    gap(24 * u),
    names.length ? barItem({ color: accent }, [
      textItem({ text: names.length > 1 ? 'SPEAKERS' : 'SPEAKER', fam: F.B, size: 17 * u, color: accentInk(accent), track: 3 * u }),
      gap(6 * u)
    ].concat(names.map((n) => textItem({ text: n, fam: F.XB, size: 30 * u, min: 18 * u, color: C.cr, maxLines: 1, lineH: 1.28 })))) : gap(0)
  ];
  const faceR = (wide ? 52 : 62) * u;
  const drawFaces = (x, y) => {
    faces.slice(0, 5).forEach((fc, i) => {
      const cx = x + faceR + i * faceR * 1.55, cy = y + faceR;
      ctx.fillStyle = C.ob;
      ctx.beginPath(); ctx.arc(cx, cy, faceR + 7 * u, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, faceR, 0, Math.PI * 2); ctx.clip();
      if (fc.img) coverDraw(ctx, fc.img, cx, cy, faceR, 0.18);
      else {
        ctx.fillStyle = C.te; ctx.fillRect(cx - faceR, cy - faceR, faceR * 2, faceR * 2);
        ctx.fillStyle = C.cr; ctx.font = Math.round(faceR * 0.8) + 'px ' + F.XK; ctx.textAlign = 'center';
        ctx.fillText(initials(fc.name), cx, cy + faceR * 0.28); ctx.textAlign = 'left';
      }
      ctx.restore();
    });
  };
  if (faces.length && !wide) {
    drawFaces(R.x, R.y + 10 * u);
    const top = R.y + 10 * u + faceR * 2 + 36 * u;
    placeStack(ctx, stack(), { x: R.x, y: top, w: R.w, h: R.y + R.h - top }, 'left', false, L.grow);
  } else if (faces.length) {
    const colW = (faces.slice(0, 5).length * 1.55 + 0.45) * faceR;
    placeStack(ctx, stack(), { x: R.x, y: R.y, w: R.w, h: R.h - faceR * 2 - 28 * u }, 'left', false, L.grow);
    drawFaces(R.x, R.y + R.h - faceR * 2 - 6 * u);
  } else {
    placeStack(ctx, stack(), R, 'left', true, L.grow);
  }
};

/* ---- entry point ---- */
function dataUrlBuffer(s, maxBytes) {
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(s || '');
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  return buf.length && buf.length <= (maxBytes || 3 * 1024 * 1024) ? buf : null;
}

async function loadSiteImage(dir, file) {
  if (!/^[a-z0-9._-]+\.(webp|png|jpg)$/i.test(file || '')) return null;
  const p = path.join(ROOT, 'assets', dir, file);
  if (!p.startsWith(path.join(ROOT, 'assets', dir)) || !fs.existsSync(p)) return null;
  return loadImage(fs.readFileSync(p));
}

const FIELD_LIMITS = { name: 60, title: 90, company: 70, role: 24, session: 90, time: 24, movement: 24, building: 110, quote: 260,
                       tier: 60, partner: 40, speakers: 160, badge: 30, titleText: 120 };

function normaliseFields(template, raw) {
  const f = {};
  Object.keys(FIELD_LIMITS).forEach((k) => { f[k] = clean(raw[k], FIELD_LIMITS[k]); });
  f.title = clean(raw.title, template === 'session' ? 120 : 90);
  f.name = clean(raw.name, 60);
  f.role = clean(raw.role, template === 'sponsor' ? 90 : 24);
  f.quote = clean(raw.quote, 260);
  if (!MOVEMENT_ACCENT[f.movement]) f.movement = '';
  return f;
}

async function render(opts) {
  const template = opts.template;
  if (!T[template]) throw new Error('unknown template');
  const key = opts.size;
  if (!SIZES[key]) throw new Error('unknown size');
  const f = normaliseFields(template, opts.fields || {});
  const qrUrl = clean(opts.qrUrl, 120);
  if (qrUrl && !/^https:\/\/(www\.)?mangh\.org\/t\/[a-z0-9]{4,12}$/i.test(qrUrl) && !/^https?:\/\/localhost[:\d]*\/t\/[a-z0-9]{4,12}$/i.test(qrUrl) &&
      !/^https:\/\/[a-z0-9.-]+\.vercel\.app\/t\/[a-z0-9]{4,12}$/i.test(qrUrl)) throw new Error('bad qr url');
  const L = layout(key, { qr: Boolean(qrUrl) });
  const canvas = createCanvas(L.w, L.h);
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const a = { now: opts.now };
  const pbuf = dataUrlBuffer(opts.photo);
  if (pbuf) a.photo = await loadImage(pbuf);
  else if (opts.sitePhoto) a.photo = await loadSiteImage('speakers', opts.sitePhoto);
  const lbuf = dataUrlBuffer(opts.logo);
  if (lbuf) a.logo = await loadImage(lbuf);
  else if (opts.partner) {
    const p = DATA.partners.find((x) => x.slug === opts.partner);
    if (p) a.logo = await loadSiteImage('partners26', p.logo);
  }
  if (template === 'session') {
    a.faces = [];
    for (const n of (f.speakers || '').split(/\s*[·,]\s*/).filter(Boolean).slice(0, 5)) {
      const person = DATA.people.find((p) => p.name === n);
      a.faces.push({ name: n, img: person && person.photo ? await loadSiteImage('speakers', person.photo) : null });
    }
  }

  const accent = accentFor(f.movement);
  await frame(ctx, L, accent, qrUrl);
  await T[template](ctx, L, f, a);
  return canvas.toBuffer('image/png');
}

module.exports = { render, SIZES, daysToGo, DATA, C };
