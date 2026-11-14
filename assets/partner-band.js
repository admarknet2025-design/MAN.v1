/* The flat partner band of the flyers, as HTML, for the tool pages (assets/tools.css styles it).
     DMCBand.mount(el, { width, tileW, tileH, rowGap, padX, sponsorId, compact })   → Promise
   Row 1: POWERED BY + the MojoPay lockup (assets/sponsor/lockup.js, the logo unaltered, on the flyer's white tile) + the contract's
   "Tickets exclusively on MojoLife" line, and ORGANIZED BY + M·A·N on the right. Row 2: IN PARTNERSHIP WITH + every partner in
   assets/partners26/partners.json (the one partner list, seven with Jobberman). The lockup keeps the markup tools/sponsor-check.js
   measures (.dmc-lockup[data-kind=mojopay] and .dmc-ticketline inside the element with sponsorId). Sizes are px at `width`; callers
   scale the band with a transform when the page is scaled (the projector). compact: one row (phones and narrow pages wrap). */
(function (root) {
'use strict';
var LIST = null;
function partners() {
  if (!LIST) LIST = fetch('/assets/partners26/partners.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  return LIST;
}
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function mount(el, o) {
  o = o || {};
  var SP = root.DMCSponsor, W = o.width || 1920, padX = o.padX == null ? 64 : o.padX;
  var tileW = o.tileW || (SP ? Math.max(SP.minTileW(W, false), Math.round(W * 0.16)) : 320);
  var lock = SP ? SP.html(tileW, 'horizontal', "'DMC Archivo B','Archivo',sans-serif") + SP.ticketLineHtml(tileW, "'DMC Archivo B','Archivo',sans-serif") : '';
  var g = SP ? SP.geometry(tileW) : { tileH: 64 };
  var rowH = Math.round(g.tileH), tH = o.tileH || Math.round(rowH * 0.86);
  el.classList.add('dmc-band');
  el.innerHTML =
    '<div class="dmc-kente" aria-hidden="true"></div>' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:32px;padding:' + (o.rowGap || 16) + 'px ' + padX + 'px 0;flex-wrap:' + (o.compact ? 'wrap' : 'nowrap') + '">' +
      '<div id="' + esc(o.sponsorId || 'sponsor') + '" style="display:flex;align-items:center;gap:36px" aria-label="Powered by MojoPay. Tickets exclusively on MojoLife.">' + lock + '</div>' +
      '<div style="display:flex;align-items:center;gap:20px;height:' + rowH + 'px"><span class="bl">Organized by</span><img class="man" src="/assets/man-logo.png" alt="M·A·N, Marketers &amp; Advertisers Network" style="height:' + Math.round(rowH * 0.82) + 'px"></div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:24px;padding:' + (o.rowGap || 16) + 'px ' + padX + 'px ' + (o.rowGap || 16) + 'px">' +
      '<span class="bl">In partnership with</span><div class="tiles" data-partners style="height:' + tH + 'px"></div>' +
    '</div>';
  /* the flyer's white tile for the MojoPay logo (the logo itself is untouched) */
  var t = el.querySelector('.dmc-lockup[data-kind="mojopay"]');
  if (t && t.children[1]) t.children[1].style.background = '#FFFFFF';
  return partners().then(function (j) {
    var box = el.querySelector('[data-partners]');
    var list = (j && j.partners) || [];
    box.innerHTML = list.map(function (p) {
      var k = tH / 58, py = Math.round((p.pad ? p.pad[0] : 8) * k), px = Math.round((p.pad ? p.pad[1] : 12) * k);
      return '<div class="tile" data-partner="' + esc(p.id) + '" style="padding:' + py + 'px ' + px + 'px"><img src="/assets/partners26/' + esc(p.logo) + '" alt="' + esc(p.siteName || p.name) + '"></div>';
    }).join('');
    return list.length;
  });
}
root.DMCBand = { mount: mount, partners: partners };
})(window);
