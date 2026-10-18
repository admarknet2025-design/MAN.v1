/* Google Analytics 4, loaded only after the visitor accepts the cookie notice.
   Leave GA_ID empty to switch analytics (and the notice) off. */
(function(){
'use strict';
var GA_ID = 'G-CDT1GX4GJ6';
var KEY = 'man_analytics';

window.dataLayer = window.dataLayer || [];
window.gtag = function(){ window.dataLayer.push(arguments); };
if(!GA_ID) return;

function getChoice(){ try { return localStorage.getItem(KEY); } catch(e) { return null; } }
function setChoice(v){ try { localStorage.setItem(KEY, v); } catch(e) {} }

/* Short ?ref= codes from shared flyer links become campaign data in GA, so the
   caption link can stay tidy: mangh.org/dmc-2026?ref=flyer */
var SOURCES = { flyer: 'flyer', wa: 'whatsapp', li: 'linkedin', x: 'x' };
var loaded = false;

function loadGA(){
  if(loaded) return;
  loaded = true;
  window['ga-disable-' + GA_ID] = false;
  var cfg = {};
  try {
    var url = new URL(location.href);
    var ref = url.searchParams.get('ref');
    if(ref && SOURCES[ref] && !url.searchParams.has('utm_source')){
      url.searchParams.set('utm_source', SOURCES[ref]);
      url.searchParams.set('utm_medium', 'flyer-share');
      url.searchParams.set('utm_campaign', 'dmc26');
      cfg.page_location = url.href;
    }
  } catch(e) {}
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
  document.head.appendChild(s);
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, cfg);
}

/* Declining stops tracking and clears the cookies GA already set */
function stopGA(){
  window['ga-disable-' + GA_ID] = true;
  var host = location.hostname.split('.');
  var domains = [location.hostname];
  if(host.length > 1) domains.push('.' + host.slice(-2).join('.'));
  document.cookie.split(';').forEach(function(c){
    var n = c.split('=')[0].trim();
    if(n === '_ga' || n.indexOf('_ga_') === 0 || n === '_gid' || n.indexOf('_gat') === 0){
      domains.forEach(function(d){
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + d;
      });
      document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }
  });
}

var banner = null;
function hideBanner(){ if(banner){ banner.remove(); banner = null; } }
function showBanner(){
  if(banner) return;
  banner = document.createElement('div');
  banner.className = 'ck';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookie notice');
  banner.innerHTML =
    '<p class="ck-t">We use Google Analytics cookies to count visits and see which shared flyers bring people here. ' +
    'Nothing from the sponsorship form is sent to it. <a href="/privacy">Privacy and Terms</a></p>' +
    '<div class="ck-b"><button type="button" class="btn" data-ck="no">Decline</button>' +
    '<button type="button" class="btn btn-f" data-ck="yes">Accept</button></div>';
  banner.addEventListener('click', function(e){
    var b = e.target.closest('[data-ck]');
    if(!b) return;
    if(b.getAttribute('data-ck') === 'yes'){ setChoice('granted'); loadGA(); }
    else { setChoice('denied'); stopGA(); }
    hideBanner();
  });
  document.body.appendChild(banner);
}

function addSettingsLink(){
  var box = document.querySelector('.fb-lnks');
  if(!box) return;
  var a = document.createElement('a');
  a.href = '#';
  a.textContent = 'Cookie settings';
  a.addEventListener('click', function(e){ e.preventDefault(); showBanner(); });
  box.appendChild(a);
}

function init(){
  addSettingsLink();
  var c = getChoice();
  if(c === 'granted') loadGA();
  else if(c !== 'denied') showBanner();
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
