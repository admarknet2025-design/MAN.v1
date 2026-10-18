(function(){
'use strict';

var currentPage = document.body.getAttribute('data-page') || 'home';
var motionInited = {};

/* ── NAV UTILS ── */
function syncExpanded(){
  document.querySelectorAll('.nav-item').forEach(function(ni){
    var b = ni.querySelector(':scope > button');
    if(b) b.setAttribute('aria-expanded', ni.classList.contains('open') ? 'true' : 'false');
  });
  document.querySelectorAll('.hamburger').forEach(function(h){
    var mm = document.getElementById(h.getAttribute('aria-controls'));
    h.setAttribute('aria-expanded', mm && mm.classList.contains('open') ? 'true' : 'false');
  });
}
window.toggleDrop = function(id){
  document.querySelectorAll('.nav-item.open').forEach(function(ni){
    if(ni.id !== id) ni.classList.remove('open');
  });
  var el = document.getElementById(id);
  if(el) el.classList.toggle('open');
  syncExpanded();
};
window.toggleMM = function(id){
  document.querySelectorAll('.mm.open').forEach(function(mm){ if(mm.id !== id) mm.classList.remove('open'); });
  var el = document.getElementById(id);
  if(el) el.classList.toggle('open');
  syncExpanded();
};
window.closeMM = function(id){
  var el = document.getElementById(id);
  if(el) el.classList.remove('open');
  syncExpanded();
};
document.addEventListener('click', function(e){
  if(!e.target.closest('.nav-item') && !e.target.closest('.hamburger')){
    document.querySelectorAll('.nav-item.open').forEach(function(ni){ ni.classList.remove('open'); });
  }
  if(!e.target.closest('.mm') && !e.target.closest('.hamburger')){
    document.querySelectorAll('.mm.open').forEach(function(mm){ mm.classList.remove('open'); });
  }
  syncExpanded();
});
/* Escape closes any open menu and returns focus to its button */
document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape') return;
  var openItem = document.querySelector('.nav-item.open');
  var openMM = document.querySelector('.mm.open');
  if(openItem){
    openItem.classList.remove('open');
    var b = openItem.querySelector(':scope > button'); if(b) b.focus();
  }
  if(openMM){
    openMM.classList.remove('open');
    var h = document.querySelector('.hamburger[aria-controls="' + openMM.id + '"]'); if(h) h.focus();
  }
  syncExpanded();
});
/* keyboard users tabbing out of an open dropdown close it */
document.addEventListener('focusin', function(e){
  document.querySelectorAll('.nav-item.open').forEach(function(ni){ if(!ni.contains(e.target)) ni.classList.remove('open'); });
  syncExpanded();
});

/* ── MOTION SYSTEM ── */
document.body.classList.add('js-on');

/* Cursor aurora */
var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!('ontouchstart' in window) && !reduceMotion){
  var aur = document.createElement('div');
  aur.className = 'cursor-aurora';
  document.body.appendChild(aur);
  var ax = -999, ay = -999, tx = -999, ty = -999;
  document.addEventListener('mousemove', function(e){ tx = e.clientX; ty = e.clientY; }, {passive:true});
  (function loop(){ ax += (tx-ax)*.09; ay += (ty-ay)*.09; aur.style.left = ax+'px'; aur.style.top = ay+'px'; requestAnimationFrame(loop); })();
}

/* Countup helper */
function countUp(el, target, suffix, dur){
  if(reduceMotion){ el.textContent = target + suffix; return; }
  var t0 = performance.now();
  (function tick(now){
    var p = Math.min((now-t0)/dur, 1);
    var ease = 1 - Math.pow(1-p, 3);
    el.textContent = Math.round(ease * target) + suffix;
    if(p < 1) requestAnimationFrame(tick);
  })(performance.now());
}

/* Per-page init */
function initPageMotion(pageId){
  if(motionInited[pageId]) return;
  motionInited[pageId] = true;

  var page = document.getElementById('page-' + pageId);
  if(!page) return;

  /* Hero text reveal */
  var heroRevEls = page.querySelectorAll('.hr');
  heroRevEls.forEach(function(el, i){
    setTimeout(function(){ el.classList.add('hrin'); }, 200 + i * 110);
  });

  /* Shimmer on accent */
  var accents = page.querySelectorAll('.accent, .h26-t2');
  accents.forEach(function(el){ el.classList.add('shimmer'); });

  /* Kente wipe */
  var kentes = page.querySelectorAll('.kente');
  var ko = new IntersectionObserver(function(en){
    en.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('k-in'); ko.unobserve(e.target); } });
  }, {threshold:0.3});
  kentes.forEach(function(k){ ko.observe(k); });

  /* Stats countup */
  var sBars = page.querySelectorAll('.stats-bar');
  sBars.forEach(function(sBar){
    var sNums = sBar.querySelectorAll('.n[data-count]');
    var done = false;
    if(!sNums.length) return;
    new IntersectionObserver(function(en){
      if(!en[0].isIntersecting || done) return;
      done = true;
      sNums.forEach(function(el){
        var tgt = parseInt(el.getAttribute('data-count'));
        var sfx = el.getAttribute('data-suffix') || '';
        if(!isNaN(tgt)) countUp(el, tgt, sfx, 1100);
      });
    }, {threshold:0.6}).observe(sBar);
  });

  /* Scroll reveals */
  var srEls = page.querySelectorAll('.sr');
  var ro = new IntersectionObserver(function(en){
    en.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('rin'); ro.unobserve(e.target); }
    });
  }, {threshold:0.08, rootMargin:'0px 0px -20px 0px'});
  srEls.forEach(function(el){ ro.observe(el); });

  /* Nav border on scroll */
  var navEl = page.querySelector('nav');
  if(navEl){
    var scrollH = function(){
      if(currentPage !== pageId) return;
      navEl.style.borderBottomColor = window.scrollY > 80 ? (document.body.classList.contains('nogold') ? 'rgba(79,179,169,.28)' : 'rgba(201,162,74,.28)') : 'rgba(255,255,255,.07)';
    };
    window.addEventListener('scroll', scrollH, {passive:true});
  }

  /* Sticky register bar (dmc26 only) */
  if(pageId === 'dmc26'){
    var sr2 = document.getElementById('sticky-reg');
    window.addEventListener('scroll', function(){
      if(currentPage !== 'dmc26') return;
      if(sr2) sr2.classList.toggle('show', window.scrollY > 600);
    }, {passive:true});
  }
}

/* ── FORMS ── */
function gfSubmit(url, fields, values){
  var body = Object.keys(fields).map(function(k){
    return encodeURIComponent(fields[k]) + '=' + encodeURIComponent(values[k] || '');
  }).join('&');
  /* no-cors: the response is opaque, so only network failures reject */
  return fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: body
  });
}
function formError(form, msg){
  var el = form.querySelector('.form-err');
  if(!el){
    el = document.createElement('p');
    el.className = 'form-err';
    el.setAttribute('role', 'alert');
    el.style.cssText = 'font-size:13px;font-weight:600;color:#b3361f;margin-top:12px;line-height:1.5';
    form.appendChild(el);
  }
  el.textContent = msg;
}

/* Join MAN community form → Google Form */
(function(){
  var GF_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeqrp_YIh4-8Hjd5M6rkfoetbzMpURy_eq1PN4q_wkoKypWJQ/formResponse';
  var GF_FIELDS = {
    name:       'entry.1648406395',
    email:      'entry.334935259',
    whatsapp:   'entry.2127168989',
    role:       'entry.2141079051',
    company:    'entry.1443534928',
    experience: 'entry.779049404',
    reason:     'entry.203084004'
  };
  var form = document.getElementById('joinForm');
  var btn  = document.getElementById('joinBtn');
  if(!form) return;
  var label = btn.textContent;
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var phone = document.getElementById('f-whatsapp');
    if(phone && phone.value.replace(/\D/g, '').length < 7){
      phone.setCustomValidity('Enter your WhatsApp number with country code, like +233 24 000 0000.');
      phone.reportValidity();
      phone.addEventListener('input', function clear(){ phone.setCustomValidity(''); phone.removeEventListener('input', clear); });
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Sending…';
    var v = {};
    new FormData(form).forEach(function(val, k){ v[k] = val; });
    /* spam trap: a filled hidden field means a bot; show the usual screen but send nothing */
    var send = v.fax ? Promise.resolve() : gfSubmit(GF_URL, GF_FIELDS, v);
    send.then(function(){
      var wrap = document.getElementById('join-form-wrap');
      var first = String(v.name || '').split(' ')[0] || 'there';
      wrap.innerHTML =
        '<div role="status" tabindex="-1" id="join-done" style="text-align:center;padding:56px 32px;background:#fff;border:1px solid rgba(28,28,28,.08);outline:none">' +
          '<div style="font-size:48px;margin-bottom:16px">✅</div>' +
          '<h3 style="font-size:24px;font-weight:800;color:#1C1C1C;margin:0 0 10px">Application received.</h3>' +
          '<p style="font-size:15px;color:rgba(28,28,28,.55);line-height:1.7;max-width:380px;margin:0 auto"></p>' +
        '</div>';
      wrap.querySelector('p').textContent = 'Thank you, ' + first + '. We review every application manually and will reach out on WhatsApp within 3 business days if it’s a fit.';
      var doneEl = document.getElementById('join-done');
      if(doneEl) doneEl.focus({preventScroll: true}); /* announces the result to screen readers */
      wrap.scrollIntoView({behavior: 'smooth', block: 'center'});
    }).catch(function(){
      btn.disabled = false;
      btn.textContent = label;
      formError(form, 'We couldn’t send your application. Check your connection and try again, or email admarknet2025@gmail.com.');
    });
  });
})();

/* ── INIT ── */
document.body.classList.add('js-on');
initPageMotion(currentPage);
if(location.hash){
  var hashEl = document.getElementById(location.hash.slice(1));
  if(hashEl) setTimeout(function(){ hashEl.scrollIntoView(); }, 120);
}

})();
