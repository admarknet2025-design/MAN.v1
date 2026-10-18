/* Google Analytics 4. Does nothing until GA_ID is set to the property's Measurement ID (G-XXXXXXXXXX). */
(function(){
'use strict';
var GA_ID = '';

window.dataLayer = window.dataLayer || [];
window.gtag = function(){ window.dataLayer.push(arguments); };
if(!GA_ID) return;

/* Short ?ref= codes from shared flyer links become campaign data in GA, so the
   caption link can stay tidy: mangh.org/dmc-2026?ref=flyer */
var SOURCES = { flyer: 'flyer', wa: 'whatsapp', li: 'linkedin', x: 'x' };
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
})();
