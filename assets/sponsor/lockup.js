/* DMC 2026 sponsor lockups, shared by every renderer so they match the homepage hero pixel for pixel.

     Lockup A  "POWERED BY" + the MojoPay wordmark on a Signal Cream tile
     Lockup B  "TICKETS ON" + the MojoLife logo on the same tile (placeholder until the official file is supplied)

   Two shapes: `horizontal` (label left, tile right, as in the hero) and `stacked` (label above the tile, for narrow
   spaces such as a flyer footer or a 9:16 story).

   Everything is derived from one number, the tile width, using the hero's own proportions (see config.js). The same
   functions draw on a canvas (browser flyer, Live card maker, Node/Skia Studio renderer) and build HTML (Live screen),
   so there is one geometry. Logo protection is structural: only the official files named in config.js are drawn, always
   uncropped at their own aspect ratio, never recoloured, always on the full tile, with the clear space kept by the callers
   (clearSpace() returns it). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config.js'));
  else root.DMCSponsor = factory(root.DMCSponsorConfig);
})(typeof self !== 'undefined' ? self : this, function (CFG) {
  'use strict';

  var H = CFG.HERO;
  /* height of the "m" in the MojoPay wordmark as a share of the wordmark's height (measured from the official SVG: 138 of 192.7) */
  var M_HEIGHT = 138 / 192.72;

  /* ---- geometry: everything follows from the tile width ---- */
  function geometry(tileW) {
    var perL = CFG.LOGO_ASPECT + (2 * H.padX) / H.logoH;      /* tile width in units of logo height */
    var L = tileW / perL;
    var k = L / H.logoH;
    var g = {
      logoH: L, logoW: L * CFG.LOGO_ASPECT,
      padX: H.padX * k, padY: H.padY * k,
      labelPx: H.labelPx * k, tracking: H.labelTracking * H.labelPx * k, weight: H.labelWeight,
      gap: H.gap * k, gapStacked: (H.gapStacked || 8) * k
    };
    g.tileW = tileW;
    g.tileH = L + 2 * g.padY;
    g.clear = M_HEIGHT * L;
    return g;
  }
  /* clear space to keep free all round a lockup: the height of the "m" in the wordmark */
  function clearSpace(tileW) { return geometry(tileW).clear; }

  /* minimum MojoPay tile width for an artwork: % of its width, never under the pixel floor */
  function minTileW(artW, tall) {
    var pct = tall ? CFG.MOJOPAY_MIN_TILE_PCT_STORY : CFG.MOJOPAY_MIN_TILE_PCT_FEED;
    return Math.max(CFG.MIN_TILE_PX, Math.ceil(artW * pct / 100));
  }

  /* the official SVG has a viewBox and no size; give it one so every browser rasterises it at full resolution.
     (The file itself is untouched; this only adds width and height to the copy being drawn.) */
  function sizedSvg(text) {
    if (/<svg[^>]*\swidth=/.test(text)) return text;
    return text.replace('<svg ', '<svg width="' + Math.round(CFG.LOGO_ASPECT * 100) + '" height="100" ');
  }

  /* width of the MojoLife tile: same height as MojoPay's; the width follows the official logo's aspect, or matches
     MojoPay's while the logo is a placeholder */
  function lifeTileW(g) {
    var a = CFG.LOGOS.mojolife.file && CFG.LOGOS.mojolife.aspect;
    return a ? (g.tileH - 2 * g.padY) * a + 2 * g.padX : g.tileW;
  }
  function tileFor(kind, g) { return kind === 'mojolife' ? { w: lifeTileW(g), h: g.tileH } : { w: g.tileW, h: g.tileH }; }

  /* tracked label; returns its width. Manual spacing so it is identical on every canvas implementation. */
  function tracked(ctx, text, x, y, spacing, draw) {
    var cx = x, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      if (draw) ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + (i < text.length - 1 ? spacing : 0);
    }
    return cx - x;
  }

  function labelFont(opts, g) { return opts.font ? opts.font(g.labelPx, g.weight) : g.weight + ' ' + g.labelPx + 'px Archivo, sans-serif'; }

  /* size of a lockup without drawing it */
  function measure(ctx, opts) {
    var g = geometry(opts.tileW), t = tileFor(opts.kind, g);
    ctx.save();
    ctx.font = labelFont(opts, g);
    var text = CFG.LABELS[opts.kind].toUpperCase();
    var lw = tracked(ctx, text, 0, 0, g.tracking, false);
    ctx.restore();
    var stacked = opts.variant === 'stacked';
    return {
      g: g, labelW: lw, tile: t,
      w: stacked ? Math.max(lw, t.w) : lw + g.gap + t.w,
      h: stacked ? g.labelPx * 1.2 + g.gapStacked + t.h : t.h
    };
  }

  /* draw a lockup with its top-left corner at (x, y); opts.align 'right' puts the right edge at x instead.
     opts: { kind, variant, tileW, images:{mojopay,mojolife}, font(px, weight), align }
     returns where everything landed, so callers and tests can check it */
  function draw(ctx, opts) {
    var m = measure(ctx, opts), g = m.g, t = m.tile, stacked = opts.variant === 'stacked';
    var x = opts.align === 'right' ? opts.x - m.w : opts.x, y = opts.y;
    var tileX, tileY, labelX, labelBase;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = labelFont(opts, g);
    ctx.fillStyle = CFG.LABEL_COLOUR;
    /* centre the label the way CSS centres its line box: by the font's own ascent and descent */
    var mm = ctx.measureText('H');
    var asc = mm.fontBoundingBoxAscent != null ? mm.fontBoundingBoxAscent : mm.actualBoundingBoxAscent * 1.2;
    var desc = mm.fontBoundingBoxDescent != null ? mm.fontBoundingBoxDescent : mm.actualBoundingBoxAscent * 0.3;
    var text = CFG.LABELS[opts.kind].toUpperCase();
    if (stacked) {
      labelX = x; tileX = x; tileY = y + g.labelPx * 1.2 + g.gapStacked;
      labelBase = y + (g.labelPx * 1.2 + asc - desc) / 2;
    } else {
      labelX = x; tileX = x + m.labelW + g.gap; tileY = y;
      labelBase = y + t.h / 2 + (asc - desc) / 2;
    }
    tracked(ctx, text, labelX, labelBase, g.tracking, true);

    ctx.fillStyle = CFG.TILE_COLOUR;
    ctx.fillRect(tileX, tileY, t.w, t.h);
    var img = opts.images && opts.images[opts.kind], placeholder = !(CFG.LOGOS[opts.kind].file && img);
    if (!placeholder) {
      var lh = t.h - 2 * g.padY, aw = img.width / img.height;
      var lw = opts.kind === 'mojopay' ? g.logoW : lh * aw;
      ctx.drawImage(img, tileX + (t.w - lw) / 2, tileY + g.padY, lw, lh);
    } else {
      /* clearly marked empty slot: dashed outline and plain small text, not a logo */
      var lwid = Math.max(1, Math.round(g.logoH / 13));
      ctx.strokeStyle = '#D95F45';
      ctx.lineWidth = lwid;
      if (ctx.setLineDash) ctx.setLineDash([lwid * 4, lwid * 3]);
      ctx.strokeRect(tileX + lwid, tileY + lwid, t.w - 2 * lwid, t.h - 2 * lwid);
      if (ctx.setLineDash) ctx.setLineDash([]);
      var px = g.labelPx * 0.8;
      ctx.font = opts.font ? opts.font(px, 700) : '700 ' + px + 'px Archivo, sans-serif';
      var maxW = t.w - 2 * g.padX;
      while (tracked(ctx, CFG.PLACEHOLDER_TEXT, 0, 0, px * 0.1, false) > maxW && px > 6) {
        px -= 0.5;
        ctx.font = opts.font ? opts.font(px, 700) : '700 ' + px + 'px Archivo, sans-serif';
      }
      var pw = tracked(ctx, CFG.PLACEHOLDER_TEXT, 0, 0, px * 0.1, false);
      ctx.fillStyle = '#1C1C1C';
      var pm = ctx.measureText('H');
      var pa = pm.fontBoundingBoxAscent != null ? pm.fontBoundingBoxAscent : pm.actualBoundingBoxAscent * 1.2;
      var pd = pm.fontBoundingBoxDescent != null ? pm.fontBoundingBoxDescent : pm.actualBoundingBoxAscent * 0.3;
      tracked(ctx, CFG.PLACEHOLDER_TEXT, tileX + (t.w - pw) / 2, tileY + t.h / 2 + (pa - pd) / 2, px * 0.1, true);
    }
    ctx.restore();
    return {
      kind: opts.kind, variant: opts.variant, placeholder: placeholder,
      x: x, y: y, w: m.w, h: m.h,
      tile: { x: tileX, y: tileY, w: t.w, h: t.h },
      clear: g.clear
    };
  }

  /* problems with a placement against an artwork, [] when it is fine. MojoPay is held to the minimum width;
     MojoLife must be exactly as tall as MojoPay's tile. */
  function check(placements, artW, artH, tall) {
    var out = [], pay = null, life = null;
    placements.forEach(function (p) { if (p.kind === 'mojopay') pay = p; if (p.kind === 'mojolife') life = p; });
    if (!pay) out.push('MojoPay lockup missing');
    if (!life) out.push('MojoLife lockup missing');
    if (pay) {
      var need = minTileW(artW, tall);
      if (pay.tile.w + 0.5 < need) out.push('MojoPay tile ' + Math.round(pay.tile.w) + 'px is under the minimum ' + need + 'px');
      if (pay.tile.x < 0 || pay.tile.y < 0 || pay.tile.x + pay.tile.w > artW || pay.tile.y + pay.tile.h > artH) out.push('MojoPay tile is outside the artwork');
    }
    if (pay && life) {
      if (Math.abs(life.tile.h - pay.tile.h) > 0.5) out.push('MojoLife tile height differs from MojoPay tile height');
      if (life.tile.x < 0 || life.tile.y < 0 || life.tile.x + life.tile.w > artW || life.tile.y + life.tile.h > artH) out.push('MojoLife tile is outside the artwork');
    }
    return out;
  }

  /* ---- HTML (Live screen): the same geometry as markup with pixel sizes ---- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function html(kind, tileW, variant, fontFamily) {
    var g = geometry(tileW), t = tileFor(kind, g), cfg = CFG.LOGOS[kind], stacked = variant === 'stacked';
    var ff = fontFamily || 'Archivo,sans-serif';
    var inner;
    if (cfg.file) {
      var lh = t.h - 2 * g.padY, lw = kind === 'mojopay' ? g.logoW : lh * cfg.aspect;
      inner = '<img src="/' + esc(cfg.file) + '" alt="' + esc(cfg.alt) + '" style="display:block;height:' + lh.toFixed(2) + 'px;width:' + lw.toFixed(2) + 'px">';
    } else {
      inner = '<span data-placeholder="1" style="font:700 ' + (g.labelPx * 0.8).toFixed(2) + 'px ' + ff + ';letter-spacing:.1em;color:#1C1C1C;white-space:nowrap">' + esc(CFG.PLACEHOLDER_TEXT) + '</span>';
    }
    var tileStyle = 'display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:' + t.w.toFixed(2) + 'px;height:' + t.h.toFixed(2) +
      'px;background:' + CFG.TILE_COLOUR + ';' + (cfg.file ? '' : 'outline:' + Math.max(1, g.logoH / 13).toFixed(1) + 'px dashed #D95F45;outline-offset:-' + Math.max(1, g.logoH / 13).toFixed(1) + 'px;');
    var labelStyle = 'font:' + g.weight + ' ' + g.labelPx.toFixed(2) + 'px/1.2 ' + ff + ';letter-spacing:' + g.tracking.toFixed(2) + 'px;text-transform:uppercase;color:' + CFG.LABEL_COLOUR + ';white-space:nowrap';
    return '<div class="dmc-lockup" data-kind="' + kind + '" style="display:flex;' + (stacked ? 'flex-direction:column;align-items:flex-start;gap:' + g.gapStacked.toFixed(2) + 'px' : 'align-items:center;gap:' + g.gap.toFixed(2) + 'px') + '">' +
      '<span style="' + labelStyle + '">' + esc(CFG.LABELS[kind]) + '</span><span style="' + tileStyle + '">' + inner + '</span></div>';
  }

  return {
    config: CFG, geometry: geometry, clearSpace: clearSpace, minTileW: minTileW, sizedSvg: sizedSvg,
    measure: measure, draw: draw, check: check, html: html
  };
});
