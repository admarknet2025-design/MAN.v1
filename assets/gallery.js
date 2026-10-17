/* DMC 2025 gallery lightbox: progressive enhancement over plain links to the full-size photos */
(function(){
  var items=[].slice.call(document.querySelectorAll('.gall-item'));
  var lb=document.getElementById('lb');
  if(!items.length||!lb||typeof lb.showModal!=='function') return;
  var img=document.getElementById('lb-img'), cap=document.getElementById('lb-cap');
  var cur=0;
  function show(i){
    cur=(i+items.length)%items.length;
    var a=items[cur], t=a.querySelector('img');
    img.src=a.getAttribute('href'); img.alt=t?t.alt:''; cap.textContent=a.getAttribute('data-cap')||'';
    var n=new Image(); n.src=items[(cur+1)%items.length].getAttribute('href');
  }
  items.forEach(function(a,i){
    a.addEventListener('click',function(e){ e.preventDefault(); show(i); lb.showModal(); });
  });
  lb.querySelector('.lb-prev').addEventListener('click',function(){ show(cur-1); });
  lb.querySelector('.lb-next').addEventListener('click',function(){ show(cur+1); });
  lb.querySelector('.lb-x').addEventListener('click',function(){ lb.close(); });
  lb.addEventListener('click',function(e){ if(e.target===lb) lb.close(); });
  lb.addEventListener('keydown',function(e){
    if(e.key==='ArrowLeft'){ e.preventDefault(); show(cur-1); }
    else if(e.key==='ArrowRight'){ e.preventDefault(); show(cur+1); }
  });
  lb.addEventListener('close',function(){ img.removeAttribute('src'); });
})();
