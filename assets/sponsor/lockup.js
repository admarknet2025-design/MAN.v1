/* DMC 2026 sponsor lockups, shared by every renderer so they match the homepage hero pixel for pixel.

     Lockup    "POWERED BY" + the MojoPay wordmark on a Signal Cream tile
     Ticket line  the words "Tickets exclusively on MojoLife", plain text beside the lockup (no logo: MojoLife is named, not drawn)

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
    var g = geometry(opts.tileW), t = { w: g.tileW, h: g.tileH };
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
     opts: { kind, variant, tileW, images:{mojopay}, font(px, weight), align, labelColour, tileEdge }
     returns where everything landed, so callers and tests can check it */
  function draw(ctx, opts) {
    var m = measure(ctx, opts), g = m.g, t = m.tile, stacked = opts.variant === 'stacked';
    var x = opts.align === 'right' ? opts.x - m.w : opts.x, y = opts.y;
    var tileX, tileY, labelX, labelBase;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = labelFont(opts, g);
    ctx.fillStyle = opts.labelColour || CFG.LABEL_COLOUR;     /* the hero's muted cream on dark; callers on light or coloured grounds pass a matching ink */
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
    if (opts.tileEdge) {                                     /* a hairline round the tile when the ground is as light as the tile itself */
      ctx.strokeStyle = opts.tileEdge; ctx.lineWidth = Math.max(1, Math.round(g.logoH / 13));
      ctx.strokeRect(tileX - ctx.lineWidth / 2, tileY - ctx.lineWidth / 2, t.w + ctx.lineWidth, t.h + ctx.lineWidth);
    }
    var img = opts.images && opts.images.mojopay;
    if (!img) throw new Error('the official MojoPay logo was not loaded');
    ctx.drawImage(img, tileX + (t.w - g.logoW) / 2, tileY + g.padY, g.logoW, g.logoH);
    ctx.restore();
    return {
      kind: 'mojopay', variant: opts.variant,
      x: x, y: y, w: m.w, h: m.h,
      tile: { x: tileX, y: tileY, w: t.w, h: t.h },
      clear: g.clear
    };
  }

  /* ---- the ticket line: "Tickets exclusively on MojoLife" as plain text, in the tile row beside the lockup ---- */
  function ticketPx(tileW, lines) { var g = geometry(tileW); return lines === 1 ? g.tileH * 0.5 : g.tileH * 0.4; }
  function ticketLines(lines) { return lines === 1 ? [CFG.TICKET_EXCLUSIVE] : CFG.TICKET_EXCLUSIVE_LINES; }
  /* opts: { x, y, tileW, lines (1 or 2, default 2), font(px, weight), colour, align 'left'|'right' }; y is the top of the lockup it sits beside
     (variant 'stacked', the default) or of the tile row (variant 'horizontal') */
  function drawTicketLine(ctx, opts) {
    var g = geometry(opts.tileW), n = opts.lines === 1 ? 1 : 2, px = ticketPx(opts.tileW, n), lines = ticketLines(n);
    var rowY = opts.variant === 'horizontal' ? opts.y : opts.y + g.labelPx * 1.2 + g.gapStacked;
    ctx.save();
    ctx.font = opts.font ? opts.font(px, 700) : '700 ' + px + 'px Archivo, sans-serif';
    ctx.fillStyle = opts.colour || CFG.TICKET_COLOUR;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    var mm = ctx.measureText('H');
    var asc = mm.fontBoundingBoxAscent != null ? mm.fontBoundingBoxAscent : mm.actualBoundingBoxAscent * 1.2;
    var desc = mm.fontBoundingBoxDescent != null ? mm.fontBoundingBoxDescent : mm.actualBoundingBoxAscent * 0.3;
    var lh = px * 1.2, w = 0, i;
    lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    var x = opts.align === 'right' ? opts.x - w : opts.x, top = rowY + (g.tileH - lh * n) / 2;
    lines.forEach(function (l, k) { ctx.fillText(l, x, top + k * lh + (lh + asc - desc) / 2); });
    ctx.restore();
    return { kind: 'ticketline', text: lines.join(' '), px: px, x: x, y: rowY, w: w, h: g.tileH };
  }
  function measureTicketLine(ctx, opts) {
    var n = opts.lines === 1 ? 1 : 2, px = ticketPx(opts.tileW, n), w = 0;
    ctx.save(); ctx.font = opts.font ? opts.font(px, 700) : '700 ' + px + 'px Archivo, sans-serif';
    ticketLines(n).forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    ctx.restore();
    return { w: w, h: geometry(opts.tileW).tileH, px: px };
  }

  /* problems with the placements on an artwork, [] when it is fine. The MojoPay tile is held to the minimum width; the ticket line
     must be there and not smaller than the minimum text size. */
  function check(placements, artW, artH, tall) {
    var out = [], pay = null, tl = null;
    placements.forEach(function (p) { if (p.kind === 'mojopay') pay = p; if (p.kind === 'ticketline') tl = p; if (p.kind === 'mojolife') out.push('a MojoLife logo is drawn: only the text line is wanted'); });
    if (!pay) out.push('MojoPay lockup missing');
    if (!tl) out.push('"' + CFG.TICKET_EXCLUSIVE + '" line missing');
    if (pay) {
      var need = minTileW(artW, tall);
      if (pay.tile.w + 0.5 < need) out.push('MojoPay tile ' + Math.round(pay.tile.w) + 'px is under the minimum ' + need + 'px');
      if (pay.tile.x < 0 || pay.tile.y < 0 || pay.tile.x + pay.tile.w > artW || pay.tile.y + pay.tile.h > artH) out.push('MojoPay tile is outside the artwork');
    }
    if (tl) {
      var minPx = Math.max(12, artW * CFG.MIN_TICKET_TEXT_PCT / 100);
      if (tl.px + 0.25 < minPx) out.push('ticket line text ' + tl.px.toFixed(1) + 'px is under the minimum ' + minPx.toFixed(1) + 'px');
      if (tl.x < 0 || tl.y < 0 || tl.x + tl.w > artW || tl.y + tl.h > artH) out.push('ticket line is outside the artwork');
      if (pay && tl.x < pay.x + pay.w && tl.x + tl.w > pay.x && tl.y < pay.y + pay.h && tl.y + tl.h > pay.y) out.push('ticket line overlaps the MojoPay lockup');
    }
    return out;
  }

  /* ---- HTML (Live screen): the same geometry as markup with pixel sizes ---- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function html(tileW, variant, fontFamily) {
    var g = geometry(tileW), cfg = CFG.LOGOS.mojopay, stacked = variant === 'stacked', ff = fontFamily || 'Archivo,sans-serif';
    var tileStyle = 'display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:' + g.tileW.toFixed(2) + 'px;height:' + g.tileH.toFixed(2) + 'px;background:' + CFG.TILE_COLOUR;
    var labelStyle = 'font:' + g.weight + ' ' + g.labelPx.toFixed(2) + 'px/1.2 ' + ff + ';letter-spacing:' + g.tracking.toFixed(2) + 'px;text-transform:uppercase;color:' + CFG.LABEL_COLOUR + ';white-space:nowrap';
    return '<div class="dmc-lockup" data-kind="mojopay" style="display:flex;' + (stacked ? 'flex-direction:column;align-items:flex-start;gap:' + g.gapStacked.toFixed(2) + 'px' : 'align-items:center;gap:' + g.gap.toFixed(2) + 'px') + '">' +
      '<span style="' + labelStyle + '">' + esc(CFG.LABELS.mojopay) + '</span><span style="' + tileStyle + '"><img src="/' + esc(cfg.file) + '" alt="' + esc(cfg.alt) + '" style="display:block;height:' + g.logoH.toFixed(2) + 'px;width:' + g.logoW.toFixed(2) + 'px"></span></div>';
  }
  function ticketLineHtml(tileW, fontFamily) {
    var g = geometry(tileW);
    return '<div class="dmc-ticketline" data-kind="ticketline" style="font:700 ' + ticketPx(tileW, 1).toFixed(2) + 'px/' + g.tileH.toFixed(2) + 'px ' + (fontFamily || 'Archivo,sans-serif') + ';color:' + CFG.TICKET_COLOUR + ';white-space:nowrap;height:' + g.tileH.toFixed(2) + 'px">' + esc(CFG.TICKET_EXCLUSIVE) + '</div>';
  }

  return {
    config: CFG, geometry: geometry, clearSpace: clearSpace, minTileW: minTileW, sizedSvg: sizedSvg,
    measure: measure, draw: draw, check: check, html: html,
    drawTicketLine: drawTicketLine, measureTicketLine: measureTicketLine, ticketLineHtml: ticketLineHtml
  };
});
