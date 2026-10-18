/* Days-to-go line in the DMC 2026 hero. Doors/start: Sat 21 Nov 2026, 10:00 GMT (Ghana is UTC+0); end 15:00. */
(function(){
'use strict';
var box = document.getElementById('countdown');
if(!box) return;
var n = document.getElementById('cd-n'), t = document.getElementById('cd-t');
var START = Date.UTC(2026, 10, 21, 10, 0), END = Date.UTC(2026, 10, 21, 15, 0), DAY = 86400000;

function render(){
  var now = Date.now();
  var days = Math.ceil((START - now) / DAY);
  if(now >= END){ n.textContent = 'Thank you'; t.textContent = 'for joining DMC 2026'; }
  else if(now >= START){ n.textContent = 'Today'; t.textContent = '— DMC 2026 is happening now'; }
  else if(days <= 1){ n.textContent = 'Tomorrow'; t.textContent = '— DMC 2026 is almost here'; }
  else { n.textContent = days; t.textContent = 'days to go'; }
  box.classList.add('on');
}
render();
setInterval(render, 60000);
})();
