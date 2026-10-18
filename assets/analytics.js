/* Cookie notice for Google Analytics. The Google tag itself is in each page's <head> and starts with
   analytics cookies denied (consent mode); Accept switches them on, Decline keeps them off. */
(function(){
'use strict';
var GA_ID = 'G-CDT1GX4GJ6';
var KEY = 'man_analytics';

function gtag(){ (window.dataLayer = window.dataLayer || []).push(arguments); }
if(!window.gtag) window.gtag = gtag;

function getChoice(){ try { return localStorage.getItem(KEY); } catch(e) { return null; } }
function setChoice(v){ try { localStorage.setItem(KEY, v); } catch(e) {} }

function grant(){ gtag('consent', 'update', { analytics_storage: 'granted' }); }

/* Declining switches cookies off and clears the ones GA already set */
function deny(){
  gtag('consent', 'update', { analytics_storage: 'denied' });
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
    '<p class="ck-t">We use Google Analytics to count visits and see which shared flyers bring people here. ' +
    'Accept lets it use cookies. Decline and it only counts page views, with no cookies. ' +
    'Nothing from the sponsorship form is sent to it. <a href="/privacy">Privacy and Terms</a></p>' +
    '<div class="ck-b"><button type="button" class="btn" data-ck="no">Decline</button>' +
    '<button type="button" class="btn btn-f" data-ck="yes">Accept</button></div>';
  banner.addEventListener('click', function(e){
    var b = e.target.closest('[data-ck]');
    if(!b) return;
    if(b.getAttribute('data-ck') === 'yes'){ setChoice('granted'); grant(); }
    else { setChoice('denied'); deny(); }
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
  if(getChoice() === null) showBanner(); /* 'granted' was already applied by the tag in <head> */
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
