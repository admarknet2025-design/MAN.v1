/* Early-bird pricing ends 31 Oct 2026 (Ghana is UTC+0). After that, swap the early-bird wording for neutral
   "tickets on sale" text so the page never advertises an expired price. Pre-deadline copy is the HTML default. */
(function(){
'use strict';
if(Date.now() < Date.UTC(2026, 10, 1)) return; /* 1 Nov 2026 00:00 UTC */
document.querySelectorAll('[data-eb-after]').forEach(function(el){
  el.textContent = el.getAttribute('data-eb-after');
});
})();
