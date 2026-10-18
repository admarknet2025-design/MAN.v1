/* Press page: copy buttons for the boilerplate paragraphs */
(function(){
'use strict';
Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function(btn){
  var label = btn.textContent;
  btn.addEventListener('click', function(){
    var el = document.getElementById(btn.getAttribute('data-copy'));
    if(!el) return;
    var text = el.textContent.trim();
    function done(ok){
      btn.textContent = ok ? 'Copied' : 'Select the text and copy';
      setTimeout(function(){ btn.textContent = label; }, 1800);
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(false); });
    } else {
      var r = document.createRange(); r.selectNodeContents(el);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      var ok = false; try { ok = document.execCommand('copy'); } catch(e) {}
      done(ok);
    }
  });
});
})();
