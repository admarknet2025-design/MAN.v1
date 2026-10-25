/* Early-bird pricing (GH₵100) ends 31 Oct 2026 (Ghana is UTC+0); from 1 Nov the ticket price is GH₵150. After the deadline, swap the
   early-bird wording for the new price so the page never advertises an expired one. Pre-deadline copy is the HTML default. */
(function(){
'use strict';
if(Date.now() < Date.UTC(2026, 10, 1)) return; /* 1 Nov 2026 00:00 UTC */
document.querySelectorAll('[data-eb-after]').forEach(function(el){
  el.textContent = el.getAttribute('data-eb-after');
});
})();
