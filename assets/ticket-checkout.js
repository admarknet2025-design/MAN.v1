/* TicketCheckout — opens MojoTickets checkout in a modal on mangh.org instead of sending people away.

   Every <a href="https://tickets.mojo-pay.com/events/digital-marketers-conference-2026"> on the site is picked up
   automatically. The links stay real links: without JavaScript, or in an in-app browser, they open the ticket page
   in a new tab exactly as before.

   FEATURE FLAG: off. Flip EMBED to true only once MojoPay has confirmed that https://mangh.org may frame their checkout
   (see docs/ticket-checkout.md). While it is false the script does nothing, except on Vercel previews and localhost,
   where adding ?embed=1 to a page URL switches it on for that browser tab (and ?embed=0 switches it off again). */
(function(){
'use strict';

var EMBED = false;

var TICKET_ORIGIN = 'https://tickets.mojo-pay.com';
var TICKET_PATH = '/events/digital-marketers-conference-2026';
var TICKET_URL = TICKET_ORIGIN + TICKET_PATH;
var PARAM_KEYS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
var STORE_KEY = 'man_ticket_params';
var LOAD_TIMEOUT_MS = 8000;
/* Message names MojoTickets sends to the parent page after a purchase. Empty until MojoPay confirms them; with an
   empty list the "You're in" screen never shows (nothing is guessed). */
var SUCCESS_EVENTS = [];

function previewHost(){
  var h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || /(^|\.)vercel\.app$/.test(h);
}
function enabled(){
  if(EMBED) return true;
  if(!previewHost()) return false;
  try {
    var q = new URLSearchParams(location.search).get('embed');
    if(q === '1') sessionStorage.setItem('man_embed', '1');
    if(q === '0') sessionStorage.removeItem('man_embed');
    return sessionStorage.getItem('man_embed') === '1';
  } catch(e) { return false; }
}
if(!enabled()) return;

/* ---- referral and campaign parameters: kept for the whole visit ---- */
function stored(){
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}') || {}; } catch(e) { return {}; }
}
function params(){
  var found = {}, sp;
  try { sp = new URLSearchParams(location.search); } catch(e) { return stored(); }
  PARAM_KEYS.forEach(function(k){
    var v = sp.get(k);
    if(v && /^[A-Za-z0-9_.~%-]{1,80}$/.test(v)) found[k] = v;
  });
  if(Object.keys(found).length){
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(found)); } catch(e) {}
    return found;
  }
  return stored();
}
function ticketUrl(){
  var p = params(), qs = PARAM_KEYS.filter(function(k){ return p[k]; })
    .map(function(k){ return k + '=' + encodeURIComponent(p[k]); }).join('&');
  return TICKET_URL + (qs ? '?' + qs : '');
}

function track(name, extra){
  var p = params(), data = { ref: p.ref || '' };
  for(var k in (extra || {})) data[k] = extra[k];
  if(window.gtag) window.gtag('event', name, data);
}

function isTicketLink(a){
  try {
    var u = new URL(a.href, location.href);
    return u.origin === TICKET_ORIGIN && u.pathname.replace(/\/$/, '') === TICKET_PATH;
  } catch(e) { return false; }
}
function inAppBrowser(){
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|BytedanceWebview|WhatsApp|Snapchat|Line\//i.test(navigator.userAgent || '');
}

/* keep the plain links pointing at the right place (with the visitor's ref) for no-JS-style gestures */
function syncLinks(){
  var href = ticketUrl();
  Array.prototype.forEach.call(document.querySelectorAll('a[href*="tickets.mojo-pay.com"]'), function(a){
    if(isTicketLink(a)) a.href = href;
  });
}

/* ---- the modal ---- */
var dlg, frame, loader, slow, done, fb, timer, opener;

function el(tag, cls, html){
  var e = document.createElement(tag);
  if(cls) e.className = cls;
  if(html) e.innerHTML = html;
  return e;
}

function build(){
  dlg = el('dialog', 'tk');
  dlg.setAttribute('aria-labelledby', 'tk-title');
  dlg.innerHTML =
    '<div class="tk-bar"><div class="tk-brand"><b>DMC 2026</b><span id="tk-title">Get your ticket</span></div>' +
    '<button type="button" class="tk-x" aria-label="Close checkout"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>' +
    '<div class="tk-body">' +
      '<div class="tk-load" role="status"><span class="tk-spin" aria-hidden="true"></span><span>Loading secure checkout…</span></div>' +
      '<div class="tk-slow" hidden><p>Checkout is taking longer than usual.</p><a class="tk-btn" target="_blank" rel="noopener">Open checkout in a new tab →</a></div>' +
      '<div class="tk-ok" hidden><h2>You’re in.</h2><p>Thanks for getting your ticket to DMC 2026.</p><a class="tk-btn" href="/dmc-2026#flyer">Make your flyer →</a></div>' +
    '</div>' +
    '<div class="tk-foot"><span class="tk-lock"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 6V4.5a3.5 3.5 0 017 0V6M2.5 6h9v6.5h-9z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>Secure checkout by MojoTickets</span>' +
    '<a class="tk-fb" target="_blank" rel="noopener">Having trouble? Open checkout in a new tab →</a></div>';
  document.body.appendChild(dlg);
  loader = dlg.querySelector('.tk-load');
  slow = dlg.querySelector('.tk-slow');
  done = dlg.querySelector('.tk-ok');
  fb = dlg.querySelector('.tk-fb');

  dlg.querySelector('.tk-x').addEventListener('click', function(){ dlg.close(); });
  dlg.addEventListener('click', function(e){ if(e.target === dlg) dlg.close(); }); /* click on the dimmed backdrop */
  dlg.addEventListener('close', onClose);
  fb.addEventListener('click', function(){ track('ticket_fallback_click', { where: 'footer' }); });
  slow.querySelector('a').addEventListener('click', function(){ track('ticket_fallback_click', { where: 'timeout' }); });
  done.querySelector('a').addEventListener('click', function(){ dlg.close(); });
}

function open(trigger){
  if(!dlg) build();
  opener = trigger || document.activeElement;
  var src = ticketUrl();
  fb.href = src;
  slow.querySelector('a').href = src;
  loader.hidden = false; slow.hidden = true; done.hidden = true;

  frame = el('iframe', 'tk-frame');
  frame.title = 'MojoTickets checkout for DMC 2026';
  frame.setAttribute('allow', 'payment');
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  frame.hidden = true;
  frame.addEventListener('load', function(){
    clearTimeout(timer);
    loader.hidden = true; slow.hidden = true; frame.hidden = false;
    track('ticket_iframe_loaded');
  });
  document.documentElement.classList.add('tk-lock-scroll');
  dlg.showModal();
  /* The checkout is only requested now, when someone asks for it. The src is set before the iframe joins the page so
     the browser's empty about:blank load never counts as "loaded". */
  frame.src = src;
  dlg.querySelector('.tk-body').appendChild(frame);
  track('ticket_modal_open');
  timer = setTimeout(function(){ if(frame && frame.hidden){ loader.hidden = true; slow.hidden = false; } }, LOAD_TIMEOUT_MS);
}

function onClose(){
  clearTimeout(timer);
  if(frame){ frame.src = 'about:blank'; frame.remove(); frame = null; }
  document.documentElement.classList.remove('tk-lock-scroll');
  if(opener && opener.focus){ try { opener.focus(); } catch(e) {} }
}

function purchased(){
  if(!dlg || !dlg.open) return;
  if(frame) frame.hidden = true;
  loader.hidden = true; slow.hidden = true; done.hidden = false;
  track('ticket_purchase_success');
}

document.addEventListener('click', function(e){
  var a = e.target.closest && e.target.closest('a[href*="tickets.mojo-pay.com"]');
  if(!a || !isTicketLink(a)) return;
  if(a.closest('.tk')) return; /* the fallback links inside the modal always open the new tab */
  if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; /* new-tab gestures keep working */
  if(inAppBrowser()) return; /* in-app browsers: the link opens the ticket page in its own tab, as before */
  if(typeof HTMLDialogElement === 'undefined') return;
  e.preventDefault();
  open(a);
});

window.addEventListener('message', function(ev){
  if(ev.origin !== TICKET_ORIGIN) return;
  if(!frame || ev.source !== frame.contentWindow) return;
  var d = ev.data, name = d && typeof d === 'object' ? (d.type || d.event) : d;
  if(typeof name === 'string' && SUCCESS_EVENTS.indexOf(name) > -1) purchased();
});

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncLinks);
else syncLinks();
})();
