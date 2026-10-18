/* Campaign link builder. The source/medium table mirrors the ?ref= parser in each page's Google tag. */
(function(){
'use strict';
var BASE = 'https://mangh.org';
var SOC = { ig: 'instagram', fb: 'facebook', tt: 'tiktok', yt: 'youtube', li: 'linkedin', x: 'x', wa: 'whatsapp', tg: 'telegram' };
var PAR = { mojopay: 'mojopay', fido: 'fido', gengh: 'generation-ghana', mnotify: 'mnotify', kasad3: 'kasad3', techlabari: 'tech-labari', koin: 'koin' };
var PARTNERS = [['MojoPay', 'mojopay'], ['FIDO', 'fido'], ['Generation Ghana', 'gengh'], ['mNotify', 'mnotify'], ['Kasad3', 'kasad3'], ['Tech Labari', 'techlabari'], ['Koin Photography', 'koin']];

function $(id){ return document.getElementById(id); }
function clean(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

function describe(code){
  var p = code.split('-'), k = p[0], d = p.slice(1).join('-');
  var src = k, med = 'referral-link';
  if(SOC[k]) { src = SOC[k]; med = 'social'; }
  else if(PAR[k]) { src = PAR[k]; med = 'partner'; }
  else if(k === 'spk') { src = 'speaker'; med = 'speaker'; }
  else if(k === 'email') { src = 'email'; med = 'email'; }
  else if(k === 'qr') { src = 'qr'; med = 'print'; }
  return { src: src, med: med, detail: d };
}

/* put ?ref= before any #hash, and after any existing ?query */
function build(path, code){
  var hash = '', i = path.indexOf('#');
  if(i >= 0){ hash = path.slice(i); path = path.slice(0, i); }
  return BASE + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + code + hash;
}

function code(){
  var ch = $('lk-ch').value;
  if(ch === 'custom') ch = String($('lk-cu').value || '').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'link'; /* no hyphens: the first part is the source */
  var d = clean($('lk-d').value);
  return ch + (d ? '-' + d : '');
}

function update(){
  $('lk-cu-wrap').hidden = $('lk-ch').value !== 'custom';
  var c = code(), info = describe(c);
  $('lk-url').value = build($('lk-page').value, c);
  $('lk-gm').textContent = 'In Google Analytics: source ' + info.src + ' · medium ' + info.med + ' · campaign dmc26' + (info.detail ? ' · detail ' + info.detail : '');
}

['lk-page', 'lk-ch'].forEach(function(id){ $(id).addEventListener('change', update); });
['lk-cu', 'lk-d'].forEach(function(id){ $(id).addEventListener('input', update); });

function copy(text, done){
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done, function(){ done(false); }); return; }
  var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
  var ok = false; try { ok = document.execCommand('copy'); } catch(e) {}
  t.remove(); done(ok);
}
$('lk-copy').addEventListener('click', function(){
  copy($('lk-url').value, function(ok){ $('lk-msg').textContent = ok === false ? 'Could not copy — select the link and copy it.' : 'Link copied.'; });
});
$('lk-url').addEventListener('focus', function(){ this.select(); });

/* partner table */
var box = $('lk-partners');
PARTNERS.forEach(function(p){
  var url = build('/dmc-2026', p[1]);
  var row = document.createElement('div'); row.className = 'lk-pr';
  var name = document.createElement('b'); name.textContent = p[0];
  var inp = document.createElement('input'); inp.type = 'text'; inp.readOnly = true; inp.value = url; inp.setAttribute('aria-label', p[0] + ' link');
  var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.textContent = 'Copy';
  btn.addEventListener('click', function(){ copy(url, function(ok){ btn.textContent = ok === false ? 'Failed' : 'Copied'; setTimeout(function(){ btn.textContent = 'Copy'; }, 1500); }); });
  inp.addEventListener('focus', function(){ this.select(); });
  row.appendChild(name); row.appendChild(inp); row.appendChild(btn); box.appendChild(row);
});

update();
})();
