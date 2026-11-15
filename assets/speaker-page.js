/* "Share this page" on speaker profile pages: the phone's share sheet where there is one, otherwise copy the link. */
(function(){
'use strict';
var b = document.querySelector('.spk-share'), out = document.querySelector('.spk-copied');
if (!b) return;
function say(t){ if (out) out.textContent = t; }
b.addEventListener('click', function(){
  var url = b.getAttribute('data-url') || location.href.split(/[?#]/)[0], title = b.getAttribute('data-title') || document.title;
  if (navigator.share) { navigator.share({ title: title, url: url }).catch(function(){}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function(){ say('Link copied: ' + url); }, function(){ say(url); });
  } else say(url);
});
})();
