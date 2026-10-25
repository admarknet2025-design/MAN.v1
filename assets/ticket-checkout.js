/* TicketCheckout — one component behind every ticket button on the site.

   Every <a href="https://tickets.mojo-pay.com/events/digital-marketers-conference-2026"> is picked up by one click
   listener, so new buttons are covered automatically. The links stay real links: with JavaScript off, or with a
   ctrl/cmd/middle-click, they open the ticket page in a new tab exactly as before.

   What a click does:
   - Normal browser: a modal over the page with MojoTickets' embeddable checkout
     (https://tickets.mojo-pay.com/embed/events/…). The page stays open behind it.
   - In-app browser (Instagram, Facebook, TikTok, WhatsApp, Snapchat, Line) or no <dialog> support: the embed URL opens
     in a new tab. If the browser blocks the new tab, the modal shows a plain "Open checkout" link instead.
   - A "Having trouble? Open checkout in a new tab" link is always visible.

   Referral: `ref` and `utm_*` are saved in sessionStorage on the first page of a visit and appended to every checkout
   URL. MojoTickets does not store them, so when checkout starts (the embed posts `mojotickets:checkout:complete`) we log
   the order reference together with the saved ref to /api/attribution. That event means "checkout started", not "paid".

   MojoTickets' popup widget (embed.js, data-mode="popup") is NOT wired in: its script URL and data-event value are not
   confirmed, and nothing here guesses them. See docs/ticket-checkout.md. */
(function(){
'use strict';

var EMBED = true;

var TICKET_ORIGIN = 'https://tickets.mojo-pay.com';
var TICKET_PATH = '/events/digital-marketers-conference-2026';
var TICKET_URL = TICKET_ORIGIN + TICKET_PATH;
var EMBED_URL = TICKET_ORIGIN + '/embed' + TICKET_PATH;
var CHECKOUT_STARTED = 'mojotickets:checkout:complete';
var ATTRIBUTION_ENDPOINT = '/api/attribution';
var PARAM_KEYS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
var PARAM_OK = /^[A-Za-z0-9_.~%-]{1,80}$/;
var REFERENCE_OK = /^[A-Za-z0-9._:-]{1,100}$/;
var STORE_KEY = 'man_ticket_params';
var LOAD_TIMEOUT_MS = 8000;

/* ---- referral and campaign parameters: saved on first landing, kept for the whole visit ---- */
function stored(){
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}') || {}; } catch(e) { return {}; }
}
function params(){
  var found = {}, sp;
  try { sp = new URLSearchParams(location.search); } catch(e) { return stored(); }
  PARAM_KEYS.forEach(function(k){
    var v = sp.get(k);
    if(v && PARAM_OK.test(v)) found[k] = v;
  });
  if(Object.keys(found).length){ /* a new ref in the URL replaces the saved one */
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(found)); } catch(e) {}
    return found;
  }
  return stored();
}
params(); /* capture now, whether or not checkout is opened later */

function previewHost(){
  var h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || /(^|\.)vercel\.app$/.test(h);
}
function enabled(){
  if(!EMBED) return false;
  if(previewHost()){ /* previews and localhost: ?embed=0 switches the modal off for the tab so the plain links can be tested */
    try {
      var q = new URLSearchParams(location.search).get('embed');
      if(q === '0') sessionStorage.setItem('man_embed_off', '1');
      if(q === '1') sessionStorage.removeItem('man_embed_off');
      return sessionStorage.getItem('man_embed_off') !== '1';
    } catch(e) {}
  }
  return true;
}

function withParams(base){
  var p = params(), qs = PARAM_KEYS.filter(function(k){ return p[k]; })
    .map(function(k){ return k + '=' + encodeURIComponent(p[k]); }).join('&');
  return base + (qs ? '?' + qs : '');
}
function embedUrl(){ return withParams(EMBED_URL); }
function ticketUrl(){ return withParams(TICKET_URL); }

function inAppBrowser(){
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|BytedanceWebview|WhatsApp|Snapchat|Line\//i.test(navigator.userAgent || '');
}
function uaClass(){
  if(inAppBrowser()) return 'in-app';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ? 'mobile' : 'desktop';
}

function track(name, extra){
  var data = { ref: params().ref || '' };
  for(var k in (extra || {})) data[k] = extra[k];
  if(window.gtag) window.gtag('event', name, data);
}

function isTicketLink(a){
  try {
    var u = new URL(a.href, location.href);
    return u.origin === TICKET_ORIGIN && u.pathname.replace(/\/$/, '') === TICKET_PATH;
  } catch(e) { return false; }
}

/* keep the plain links pointing at the ticket page with the visitor's ref, for no-script and new-tab gestures */
function syncLinks(){
  var href = ticketUrl();
  Array.prototype.forEach.call(document.querySelectorAll('a[href*="tickets.mojo-pay.com"]'), function(a){
    if(isTicketLink(a)) a.href = href;
  });
}

/* ---- checkout started: log it on our side ---- */
var logged = {};
function logStart(reference){
  if(logged[reference]) return;
  logged[reference] = true;
  var p = params();
  var body = {
    reference: reference,
    ref: p.ref || '',
    utm_source: p.utm_source || '', utm_medium: p.utm_medium || '', utm_campaign: p.utm_campaign || '',
    utm_content: p.utm_content || '', utm_term: p.utm_term || '',
    path: location.pathname,
    ts: new Date().toISOString(),
    ua: uaClass()
  };
  try {
    /* keepalive: MoMo payment can navigate the whole page away right after this message */
    fetch(ATTRIBUTION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(function(){});
  } catch(e) {}
}

/* ---- the modal ---- */
var dlg, stage, frame, loader, slow, slowMsg, almost, fb, timer, opener;

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
    '<p class="tk-note"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 6V4.5a3.5 3.5 0 017 0V6M2.5 6h9v6.5h-9z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>Payment completes securely on MojoPay.</p>' +
    '<p class="tk-almost" role="status" hidden>You’re almost in. Finish payment on MojoPay, then <a href="/dmc-2026#flyer">make your flyer →</a></p>' +
    '<div class="tk-body"><div class="tk-stage">' +
      '<div class="tk-load" role="status"><span class="tk-spin" aria-hidden="true"></span><span>Loading secure checkout…</span></div>' +
      '<div class="tk-slow" hidden><p class="tk-slow-msg"></p><a class="tk-btn" target="_blank" rel="noopener">Open checkout in a new tab →</a></div>' +
    '</div></div>' +
    '<div class="tk-foot"><span class="tk-lock">Secure checkout by MojoTickets</span>' +
    '<a class="tk-fb" target="_blank" rel="noopener">Having trouble? Open checkout in a new tab →</a></div>';
  document.body.appendChild(dlg);
  stage = dlg.querySelector('.tk-stage');
  loader = dlg.querySelector('.tk-load');
  slow = dlg.querySelector('.tk-slow');
  slowMsg = dlg.querySelector('.tk-slow-msg');
  almost = dlg.querySelector('.tk-almost');
  fb = dlg.querySelector('.tk-fb');

  dlg.querySelector('.tk-x').addEventListener('click', function(){ dlg.close(); });
  dlg.addEventListener('click', function(e){ if(e.target === dlg) dlg.close(); }); /* click on the dimmed backdrop */
  dlg.addEventListener('close', onClose);
  fb.addEventListener('click', function(){ track('ticket_fallback_click', { where: 'footer' }); });
  slow.querySelector('a').addEventListener('click', function(){ track('ticket_fallback_click', { where: 'panel' }); });
  almost.querySelector('a').addEventListener('click', function(){ dlg.close(); });
}

/* blocked = the browser refused the new tab: show the link instead of loading the iframe */
function open(trigger, blocked){
  if(!dlg) build();
  opener = trigger || document.activeElement;
  var src = embedUrl();
  fb.href = src;
  slow.querySelector('a').href = src;
  almost.hidden = true;
  if(frame){ frame.remove(); frame = null; }
  document.documentElement.classList.add('tk-lock-scroll');
  dlg.showModal();

  if(blocked){
    loader.hidden = true; slow.hidden = false;
    slowMsg.textContent = 'Your browser blocked the new tab.';
    return;
  }
  loader.hidden = false; slow.hidden = true;
  slowMsg.textContent = 'Checkout is taking longer than usual.';
  frame = el('iframe', 'tk-frame');
  frame.title = 'MojoTickets checkout for DMC 2026';
  frame.setAttribute('allow', 'payment');
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  /* no sandbox: MoMo payment redirects the top window to MojoPay, and a sandbox would block that */
  frame.hidden = true;
  frame.addEventListener('load', function(){
    clearTimeout(timer);
    loader.hidden = true; slow.hidden = true; frame.hidden = false;
  });
  /* The checkout is only requested now. The src is set before the iframe joins the page so the browser's empty
     about:blank load never counts as "loaded". */
  frame.src = src;
  stage.appendChild(frame);
  timer = setTimeout(function(){ if(frame && frame.hidden){ loader.hidden = true; slow.hidden = false; } }, LOAD_TIMEOUT_MS);
}

function onClose(){
  clearTimeout(timer);
  if(frame){ frame.src = 'about:blank'; frame.remove(); frame = null; }
  document.documentElement.classList.remove('tk-lock-scroll');
  if(opener && opener.focus){ try { opener.focus(); } catch(e) {} }
}

/* new tab for in-app browsers; returns false if the browser blocked it */
function openTab(url){
  var w = null;
  try { w = window.open('', '_blank'); } catch(e) {}
  if(!w) return false;
  try { w.opener = null; } catch(e) {}
  try { w.location.href = url; } catch(e) { return false; }
  return true;
}

document.addEventListener('click', function(e){
  if(!enabled()) return;
  var a = e.target.closest && e.target.closest('a[href*="tickets.mojo-pay.com"]');
  if(!a || !isTicketLink(a)) return;
  if(a.closest('.tk')) return; /* the fallback links inside the modal always open the new tab */
  if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; /* new-tab gestures keep working */
  var noDialog = typeof HTMLDialogElement === 'undefined';
  if(noDialog && !inAppBrowser()) return; /* very old browser: the plain link does the job */
  e.preventDefault();
  var mode = (inAppBrowser() || noDialog) ? 'tab' : 'modal';
  track('ticket_open', { mode: mode });
  if(mode === 'modal'){ open(a, false); return; }
  if(!openTab(embedUrl())){
    track('ticket_popup_blocked');
    if(noDialog){ location.href = embedUrl(); return; }
    open(a, true);
  }
});

/* MojoTickets tells the parent page when an order is created (before payment). It is NOT a payment confirmation. */
window.addEventListener('message', function(ev){
  if(ev.origin !== TICKET_ORIGIN) return;
  var d = ev.data;
  if(!d || typeof d !== 'object' || d.type !== CHECKOUT_STARTED) return;
  var reference = typeof d.reference === 'string' ? d.reference : '';
  if(!REFERENCE_OK.test(reference)) return;
  track('ticket_checkout_started');
  logStart(reference);
  if(dlg && dlg.open && almost) almost.hidden = false;
});

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncLinks);
else syncLinks();
})();
