/* DMC 2026 "Make Your Flyer" — draws a 1080×1440 flyer on <canvas id="dmc26-flyer"> */
(function(){
'use strict';

var canvas = document.getElementById('dmc26-flyer');
if(!canvas) return;
var ctx = canvas.getContext('2d');
var W = 1080, H = 1440;

/* Brand palette */
var OB = '#1C1C1C', SC = '#F4EFE6', BT = '#2A7B74', PC = '#D95F45', AG = '#C9A24A';
var SC7 = 'rgba(244,239,230,0.70)', SC6 = 'rgba(244,239,230,0.60)', SC4 = 'rgba(244,239,230,0.40)',
    SC2 = 'rgba(244,239,230,0.55)', AG3 = 'rgba(201,162,74,0.30)';

var TICKET_URL = 'https://tickets.mojo-pay.com/events/digital-marketers-conference-2026';

/* Logos are served from this site (same origin), so the canvas stays exportable.
   Every logo sits on a cream tile: most marks are drawn for light backgrounds. */
var LOGO_SRCS = {
  fido:            '/assets/partners26/fido.webp',
  mnotify:         '/assets/partners26/mnotify.webp',
  generationghana: '/assets/partners26/generation-ghana.webp',
  kasad3:          '/assets/partners26/kasad3.webp',
  techlabari:      '/assets/partners26/tech-labari.webp',
  koin:            '/assets/partners26/mista-koin.webp'
};
var PARTNERS = [
  { key: 'fido',            label: 'FIDO' },
  { key: 'mnotify',         label: 'mNotify' },
  { key: 'generationghana', label: 'Generation Ghana' },
  { key: 'kasad3',          label: 'Kasad3' },
  { key: 'techlabari',      label: 'Tech Labari' },
  { key: 'koin',            label: 'Koin Photography' }
];

var logos = {};
/* Sponsor credit (Powered by MojoPay, Tickets exclusively on MojoLife): one shared lockup, assets/sponsor/ */
var SP = window.DMCSponsor;
var spImgs = {};
/* Speaker/host flyers are produced offline by tools/speaker-flyers.js, which sets this before the page loads.
   The public page offers no speaker option. */
var SPK = window.DMC_SPEAKER_FLYER || null;
var photo = null;
var qrData = null;

function loadSponsorLogos(){
  var L = SP.config.LOGOS;
  return Promise.all(Object.keys(L).filter(function(k){ return L[k].file; }).map(function(k){
    return fetch('/' + L[k].file).then(function(r){ return r.text(); }).then(function(t){
      return new Promise(function(res){
        var img = new Image();
        img.onload = function(){ spImgs[k] = img; res(); };
        img.onerror = function(){ res(); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SP.sizedSvg(t));
      });
    }).catch(function(){});
  }));
}

function loadLogos(){
  return Promise.all([loadSponsorLogos()].concat(Object.keys(LOGO_SRCS).map(function(key){
    return new Promise(function(res){
      var img = new Image();
      img.onload = function(){ logos[key] = img; res(); };
      img.onerror = function(){ res(); }; /* fail silently: placeholder box stays */
      img.src = LOGO_SRCS[key];
    });
  })));
}

function initQR(){
  try {
    var qr = window.qrcode(0, 'M');
    qr.addData(TICKET_URL);
    qr.make();
    qrData = qr;
  } catch(e) { qrData = null; }
}

/* Helpers */
function clip(text, maxW){
  if(ctx.measureText(text).width <= maxW) return text;
  var t = text;
  while(ctx.measureText(t + '…').width > maxW && t.length > 0) t = t.slice(0, -1);
  return t + '…';
}

/* Kente strip — matches the site CSS pattern: gold 18 | ob 2 | teal 18 | ob 2 | coral 18 | ob 2 | cream 18 | ob 2 */
function drawKente(y){
  var SEG = [
    { c: AG, w: 18 }, { c: OB, w: 2 }, { c: BT, w: 18 }, { c: OB, w: 2 },
    { c: PC, w: 18 }, { c: OB, w: 2 }, { c: SC, w: 18 }, { c: OB, w: 2 }
  ];
  var x = 0;
  while(x < W){
    for(var i = 0; i < SEG.length; i++){
      if(x >= W) break;
      ctx.fillStyle = SEG[i].c;
      ctx.fillRect(x, y, Math.min(SEG[i].w, W - x), 14);
      x += SEG[i].w;
    }
  }
}

function drawQR(x, y, size){
  if(!qrData) return;
  var m = qrData.getModuleCount();
  var cell = size / m, pad = 10;
  ctx.fillStyle = SC;
  ctx.fillRect(x - pad, y - pad, size + pad * 2, size + pad * 2);
  ctx.fillStyle = OB;
  for(var r = 0; r < m; r++){
    for(var c = 0; c < m; c++){
      if(qrData.isDark(r, c)) ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
    }
  }
}

/* Dashed placeholder box with gold corner ticks — fallback when a logo is missing */
function logoBox(x, y, w, h, label){
  ctx.save();
  ctx.strokeStyle = 'rgba(244,239,230,0.13)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.restore();

  ctx.strokeStyle = AG3; ctx.lineWidth = 1.5; ctx.setLineDash([]);
  var t = 9;
  [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(function(p){
    var sx = p[0] === x ? 1 : -1, sy = p[1] === y ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1] + sy * t); ctx.lineTo(p[0], p[1]); ctx.lineTo(p[0] + sx * t, p[1]);
    ctx.stroke();
  });

  ctx.font = '600 15px "Archivo"';
  ctx.fillStyle = 'rgba(244,239,230,0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

/* Logo on its tile, preserving aspect ratio; falls back to the placeholder box */
function drawLogo(key, label, x, y, boxW, boxH){
  var img = logos[key];
  if(!img){ logoBox(x, y, boxW, boxH, label); return; }
  ctx.fillStyle = SC;
  ctx.fillRect(x, y, boxW, boxH);
  var pad = key === 'koin' ? 8 : 12;
  var scale = Math.min((boxW - pad * 2) / img.naturalWidth, (boxH - pad * 2) / img.naturalHeight);
  var dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (boxW - dw) / 2, y + (boxH - dh) / 2, dw, dh);
}

/* M·A·N wordmark, as in the site nav (no logo file exists, so it is typeset) */
function drawManMark(x, y, boxW, boxH){
  ctx.save();
  ctx.font = 'normal 38px "Archivo Black"';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  var parts = [['M', SC], ['·', AG], ['A', SC], ['·', AG], ['N', SC]];
  var total = 0;
  parts.forEach(function(p){ total += ctx.measureText(p[0]).width; });
  var cx = x + (boxW - total) / 2;
  parts.forEach(function(p){
    ctx.fillStyle = p[1];
    ctx.fillText(p[0], cx, y + boxH / 2 + 1);
    cx += ctx.measureText(p[0]).width;
  });
  ctx.restore();
}

/* The sponsor credit is two drawings: "Powered by MojoPay" in the header beside the title block, and the line "Tickets exclusively on
   MojoLife" in the footer, right-aligned to rightX. Always drawn; the tile is never under the contract minimum (16% of the flyer's width).
   Placements are kept on window.DMC_SPONSOR_PLACEMENTS for the checks. */
var SP_TILE_W = Math.max(SP.minTileW(W, false), Math.round(W * 0.17));
function drawMojoPay(x, y){
  if(!spImgs.mojopay) return null;   /* the logo is still loading: the redraw that follows its load draws the credit, and flyerBlob waits for it */
  var a = SP.draw(ctx, { kind: 'mojopay', variant: 'stacked', tileW: SP_TILE_W, images: spImgs, x: x, y: y });
  ctx.textAlign = 'left';
  return a;
}
function drawTicketLine(rightX, y){
  var b = SP.drawTicketLine(ctx, { x: rightX, y: y, tileW: SP_TILE_W, variant: 'stacked', align: 'right' });
  ctx.textAlign = 'left';
  return b;
}
/* the website hero's gold: dark gold into light gold */
function goldFill(x, w){
  var g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, AG); g.addColorStop(0.62, '#F5D87A'); g.addColorStop(1, '#E6C566');
  return g;
}

function val(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }

function draw(){
  var name = val('fl-name') || 'Your Name';
  var role = val('fl-role') || 'Your Title';

  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.setLineDash([]);

  var KENTE_Y = 1160;
  var PARTNER_H = H - KENTE_Y - 14;
  var lx = 88;

  /* 1 Background */
  ctx.fillStyle = OB;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#161616';
  ctx.fillRect(0, KENTE_Y + 14, W, PARTNER_H);

  /* 2 Top-right geometric */
  ctx.fillStyle = PC;
  ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W, 280); ctx.lineTo(W - 280, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = BT;
  ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W, 152); ctx.lineTo(W - 152, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = AG;
  ctx.beginPath(); ctx.moveTo(W, 280); ctx.lineTo(W, 322); ctx.lineTo(W - 44, 280); ctx.closePath(); ctx.fill();

  /* 3 Left gold bar */
  ctx.fillStyle = AG;
  ctx.fillRect(56, 66, 6, KENTE_Y - 80);

  /* 4 Conference headline */
  ctx.font = 'normal 50px "Archivo Black"';
  ctx.fillStyle = SC;
  ctx.fillText('DIGITAL', lx, 148);
  ctx.fillStyle = PC;
  ctx.fillText("MARKETERS'", lx, 208);
  ctx.font = 'normal 34px "Archivo Black"';
  ctx.fillStyle = SC;
  ctx.fillText('CONFERENCE 2026', lx, 256);

  ctx.strokeStyle = AG3; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx, 274); ctx.lineTo(lx + 440, 274); ctx.stroke();

  /* 4b "Powered by MojoPay", beside the title block: a rule, then the contracted lockup centred on the headline's height */
  var mpX = lx + 440 + 40;
  ctx.fillStyle = 'rgba(244,239,230,0.28)';
  ctx.fillRect(mpX - 20, 112, 2, 136);
  var mojoPlacement = drawMojoPay(mpX, 180 - Math.round(SP.measure(ctx, { kind: 'mojopay', variant: 'stacked', tileW: SP_TILE_W }).h / 2));

  /* 5 BUILT TO SCALE: "BUILT TO" cream, "SCALE" in the website's gold gradient */
  ctx.font = '700 14px "Archivo"';
  ctx.fillStyle = AG;
  ctx.fillText("THIS YEAR'S THEME", lx, 300);
  ctx.font = 'normal 78px "Archivo Black"';
  ctx.fillStyle = SC;
  ctx.fillText('BUILT TO', lx, 388);
  ctx.fillStyle = goldFill(lx, ctx.measureText('SCALE').width);
  ctx.fillText('SCALE', lx, 476);

  /* 6 Photo circle */
  var px = 828, py = 576, pr = 212;
  ctx.save();
  ctx.strokeStyle = PC; ctx.lineWidth = 4;
  ctx.setLineDash([14, 10]);
  ctx.beginPath(); ctx.arc(px, py, pr + 30, -0.3, Math.PI * 1.62); ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = AG; ctx.lineWidth = 5; ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(px, py, pr + 12, 0, Math.PI * 2); ctx.stroke();

  ctx.save();
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
  if(photo){
    var iw = photo.naturalWidth, ih = photo.naturalHeight;
    var sq = Math.min(iw, ih);
    ctx.drawImage(photo, (iw - sq) / 2, (ih - sq) / 2, sq, sq, px - pr, py - pr, pr * 2, pr * 2);
  } else {
    ctx.fillStyle = '#192B29';
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 22px "Archivo"';
    ctx.fillStyle = 'rgba(244,239,230,.7)';
    ctx.fillText('Upload your photo', px, py - 12);
    ctx.font = '400 16px "Archivo"';
    ctx.fillStyle = 'rgba(244,239,230,.5)';
    ctx.fillText('Use the controls beside this flyer', px, py + 18);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  /* 7 MEET ME THERE */
  ctx.font = 'normal 56px "Archivo Black"';
  ctx.fillStyle = SC;
  if(SPK){
    ctx.fillText(SPK.lines[0], lx, 530);
    ctx.fillText(SPK.lines[1], lx, 596);
    /* gold tag under the photo */
    ctx.fillStyle = AG;
    ctx.fillRect(px - 120, 842, 240, 52);
    ctx.fillStyle = OB;
    ctx.font = 'normal 26px "Archivo Black"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(SPK.tag, px, 869);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  } else {
    ctx.fillText('MEET ME', lx, 530);
    ctx.fillText('THERE', lx, 596);
  }

  /* 8 Name badge */
  var bx = lx, by = 622, bw = 460, bh = 82;
  ctx.fillStyle = BT;
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = AG;
  ctx.fillRect(bx, by, 4, bh);
  ctx.font = '700 24px "Archivo"';
  ctx.fillStyle = SC;
  ctx.fillText(clip(name, bw - 44), bx + 18, by + 30);
  var rs = 18;
  ctx.font = '400 ' + rs + 'px "Archivo"';
  while(rs > 14 && ctx.measureText(role).width > bw - 44){ rs--; ctx.font = '400 ' + rs + 'px "Archivo"'; }
  ctx.fillStyle = SC6;
  ctx.fillText(clip(role, bw - 44), bx + 18, by + 60);

  /* 9 QR code */
  var qrX = lx, qrY = 724, qrSize = 128;
  drawQR(qrX, qrY, qrSize);
  ctx.font = '700 15px "Archivo"';
  ctx.fillStyle = AG;
  ctx.textAlign = 'left';
  ctx.fillText('SCAN FOR TICKETS', lx, qrY + qrSize + 28);
  ctx.font = '500 14px "Archivo"';
  ctx.fillStyle = SC7;
  ctx.fillText(SP.config.TICKET_LINE, lx, qrY + qrSize + 50);

  /* 10 Date & venue */
  var dtY = 965;
  ctx.font = 'normal 50px "Archivo Black"';
  ctx.fillStyle = SC;
  ctx.textAlign = 'left';
  ctx.fillText('21 NOV 2026', lx, dtY);
  ctx.font = '500 18px "Archivo"';
  ctx.fillStyle = SC7;
  ctx.fillText('Saturday  ·  10:00 AM – 3:00 PM', lx, dtY + 32);
  ctx.font = '700 20px "Archivo"';
  ctx.fillStyle = '#5CC0B5';
  ctx.fillText('British Council, Accra', lx, dtY + 68);
  ctx.font = '600 18px "Archivo"';
  ctx.fillStyle = SC7;
  ctx.textAlign = 'right';
  ctx.fillText('mangh.org', W - 56, dtY + 68);

  ctx.font = '600 16px "Archivo"';
  ctx.fillStyle = SC6;
  ctx.textAlign = 'left';
  ctx.fillText('#DMC2026  ·  #BuiltToScale', lx, dtY + 102);

  ctx.strokeStyle = AG3; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx, KENTE_Y - 22); ctx.lineTo(W - 56, KENTE_Y - 22); ctx.stroke();

  /* 11 Kente divider */
  drawKente(KENTE_Y);

  /* 12 Partner / sponsor band */
  var pY = KENTE_Y + 14;
  ctx.fillStyle = AG;
  ctx.fillRect(0, pY, 4, PARTNER_H);
  ctx.fillRect(W - 4, pY, 4, PARTNER_H);

  /* Row A: organiser, then the contracted sponsor credit (shared lockups, assets/sponsor/) */
  var rowAY = pY + 18;
  ctx.font = '700 14px "Archivo"';
  ctx.fillStyle = SC2;
  ctx.textAlign = 'left';
  ctx.fillText('ORGANIZED BY', lx, rowAY + 12);
  drawManMark(lx, rowAY + 24, 160, 56);
  var ticketPlacement = drawTicketLine(W - lx, rowAY);
  if(mojoPlacement) window.DMC_SPONSOR_PLACEMENTS = [mojoPlacement, ticketPlacement];

  var ruleY = pY + 122;
  ctx.strokeStyle = 'rgba(244,239,230,0.06)'; ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(lx, ruleY); ctx.lineTo(W - lx, ruleY); ctx.stroke();

  /* Row B: six partners */
  var rowBY = ruleY + 14;
  ctx.font = '700 14px "Archivo"';
  ctx.fillStyle = SC2;
  ctx.textAlign = 'center';
  ctx.fillText('IN PARTNERSHIP WITH', W / 2, rowBY + 12);

  var gap = 14, pBoxW = 138, pBoxH = 66;
  var totalPW = PARTNERS.length * pBoxW + (PARTNERS.length - 1) * gap;
  var pxStart = (W - totalPW) / 2;
  PARTNERS.forEach(function(p, i){
    drawLogo(p.key, p.label, pxStart + i * (pBoxW + gap), rowBY + 26, pBoxW, pBoxH);
  });
  ctx.textAlign = 'left';
}

/* Photo upload */
var input  = document.getElementById('fl-photo');
var zone   = document.getElementById('fl-zone');
var thumb  = document.getElementById('fl-thumb');
var icon   = document.getElementById('fl-icon');
var msg    = document.getElementById('fl-msg');

function note(text){ if(msg) msg.textContent = text || ''; }
var smsg = document.getElementById('fl-smsg');
function snote(text){ if(smsg) smsg.textContent = text || ''; }

function loadPhoto(file){
  if(!file) return;
  if(!/^image\//.test(file.type)){ note('That file is not an image — try a JPG or PNG.'); return; }
  var reader = new FileReader();
  reader.onload = function(e){
    var img = new Image();
    img.onload = function(){
      photo = img;
      thumb.src = e.target.result;
      thumb.style.display = 'block';
      icon.style.display = 'none';
      note('');
      draw();
    };
    img.onerror = function(){ note('Could not read that photo — try a JPG or PNG.'); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

if(input) input.addEventListener('change', function(e){ loadPhoto(e.target.files[0]); });
if(zone){
  zone.addEventListener('dragover', function(e){ e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', function(){ zone.classList.remove('drag'); });
  zone.addEventListener('drop', function(e){
    e.preventDefault(); zone.classList.remove('drag');
    loadPhoto(e.dataTransfer.files[0]);
  });
}

/* Live update */
var t;
function sched(){ clearTimeout(t); t = setTimeout(draw, 50); }
['fl-name', 'fl-role'].forEach(function(id){
  var el = document.getElementById(id);
  if(el) el.addEventListener('input', sched);
});

/* GA events (no-op until analytics.js has a Measurement ID) */
function track(name, params){ if(window.gtag) window.gtag('event', name, params || {}); }

/* Download / share */
function fileName(){
  return 'DMC2026-BuiltToScale-' + (val('fl-name') || 'flyer').replace(/[\\\/:*?"<>|\s]+/g, '-') + '.png';
}
/* a flyer is never exported before the sponsor credit has been drawn */
function flyerBlob(cb){ ready.then(function(){ draw(); canvas.toBlob(cb, 'image/png'); }); }

var dl = document.getElementById('fl-dl');
if(dl) dl.addEventListener('click', function(){
  track('flyer_download');
  flyerBlob(function(blob){
    if(!blob) return;
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.download = fileName();
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  });
});

/* Caption: editable; the event links share whatever it says */
var cap = document.getElementById('fl-caption');
var copyBtn = document.getElementById('fl-copy');

function copyText(text){
  if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  return new Promise(function(res, rej){
    cap.select();
    try { document.execCommand('copy') ? res() : rej(); } catch(e) { rej(e); }
  });
}
function setHref(id, href){ var a = document.getElementById(id); if(a) a.href = href; }
function syncLinks(){
  /* each channel gets its own ?ref= code so GA can tell them apart */
  function withRef(code){ return encodeURIComponent(cap.value.replace(/\?ref=[a-z0-9-]+/, '?ref=' + code)); }
  setHref('fl-wa', 'https://wa.me/?text=' + withRef('wa'));
  setHref('fl-x', 'https://twitter.com/intent/tweet?text=' + withRef('x'));
}
/* Caption follows the name/role fields until the attendee edits it by hand */
var capDirty = false;
var CAP_BASE = cap ? cap.value : '';
function buildCaption(){
  var name = val('fl-name'), role = val('fl-role');
  if(!name) return CAP_BASE;
  return CAP_BASE + '\n— ' + name + (role ? ', ' + role : '');
}
function refreshCaption(){
  if(capDirty || !cap) return;
  cap.value = buildCaption();
  syncLinks();
}
if(cap){
  cap.addEventListener('input', function(){ capDirty = true; syncLinks(); });
  ['fl-name', 'fl-role'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener('input', refreshCaption);
  });
  syncLinks();
}

if(copyBtn && cap) copyBtn.addEventListener('click', function(){
  copyText(cap.value).then(function(){
    track('flyer_copy_caption');
    snote('Caption copied — paste it into your post.');
  }, function(){
    snote('Could not copy automatically — select the caption and copy it.');
  });
});

/* Native share sheet (phones, some desktops) — hidden where files can't be shared */
var shareBtn = document.getElementById('fl-share');
function canShareFiles(){
  try {
    return !!(navigator.share && navigator.canShare &&
      navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }));
  } catch(e) { return false; }
}
if(shareBtn && canShareFiles()){
  shareBtn.hidden = false;
  shareBtn.addEventListener('click', function(){
    flyerBlob(function(blob){
      if(!blob) return;
      var file = new File([blob], fileName(), { type: 'image/png' });
      navigator.share({ files: [file], text: cap ? cap.value : '', title: 'DMC 2026 — Built To Scale' })
        .then(function(){ track('flyer_share', { method: 'share_sheet' }); snote(''); })
        .catch(function(err){
          if(err && err.name === 'AbortError') return; /* user closed the sheet */
          snote('Sharing did not work on this device — download the flyer and copy the caption instead.');
        });
    });
  });
}

/* Init: canvas text needs the web fonts loaded before the first draw */
function fonts(){
  if(!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.all([
    document.fonts.load('normal 50px "Archivo Black"'),
    document.fonts.load('400 16px "Archivo"'),
    document.fonts.load('500 14px "Archivo"'),
    document.fonts.load('600 14px "Archivo"'),
    document.fonts.load('700 24px "Archivo"')
  ]).catch(function(){});
}

var ready = Promise.resolve();
function start(){
  initQR();
  draw();
  ready = Promise.all([loadLogos(), fonts()]).then(draw);
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
window.addEventListener('load', function(){ initQR(); draw(); }); /* picks up the QR library if it arrived late */
})();
