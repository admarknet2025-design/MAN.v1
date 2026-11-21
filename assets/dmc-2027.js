/* DMC 2027 interest form (/dmc-2027) → Google Form "DMC 2027: be first to know" (AdMarkNet account).
   Same pattern as assets/survey.js: the answers go to /api/form-submit, which POSTs them to the form's formResponse
   URL and reports whether Google stored them. Plus a honeypot, a loading state and a success / error message.
   The form id must be listed in FORMS in api/form-submit.js.
   The questions in dmc-2027.html mirror the Google Form one to one. Option values must match the form's options
   exactly, or Google rejects the response. If a question is edited, deleted or re-created in the form, re-read the
   entry ids and options (the form's FB_PUBLIC_LOAD_DATA_) and update both files.
   The page keeps nothing: no storage, no cookies. */
(function(){
'use strict';

var FORM_ID = '1FAIpQLSdwGwi4UH8toxKSgX9K8QiHpFXXtlose5o5URz2eLw8_bxtJQ';
var VIEW_URL = 'https://docs.google.com/forms/d/e/' + FORM_ID + '/viewform';

/* page field → Google Form entry id */
var E = {
  name:    'entry.154193774',   /* short answer, required */
  email:   'entry.231831222',   /* short answer, required */
  phone:   'entry.85093522',    /* short answer, optional */
  company: 'entry.967583702',   /* short answer, optional */
  role:    'entry.2039781258',  /* short answer, optional */
  was2026: 'entry.1822439529',  /* Yes / No, required */
  part:    'entry.211919248',   /* checkboxes, required */
  wish:    'entry.956218778'    /* paragraph, optional */
};

var form = document.getElementById('interestForm');
if(!form) return;
var btn = document.getElementById('interestBtn');
var label = btn.textContent;
var wrap = document.getElementById('interest-form-wrap');

/* clear a question's error as soon as it is answered */
form.addEventListener('change', function(e){ var q = e.target.closest('.q'); if(q) q.classList.remove('bad'); });
form.addEventListener('input', function(e){ var q = e.target.closest('.q'); if(q) q.classList.remove('bad'); });

function checked(name){
  return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function(i){ return i.value; });
}
function val(name){ var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; }

function validate(){
  var bad = [];
  Array.prototype.forEach.call(form.querySelectorAll('.q[data-req]'), function(q){
    var kind = q.getAttribute('data-req'), name = q.getAttribute('data-name'), ok = true;
    if(kind === 'radio') ok = checked(name).length === 1;
    else if(kind === 'check') ok = checked(name).length > 0;
    else if(kind === 'text') ok = val(name) !== '';
    else if(kind === 'emailreq') ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val(name));
    q.classList.toggle('bad', !ok);
    if(!ok) bad.push(q);
  });
  return bad;
}

function encode(){
  var parts = [];
  function add(k, v){ parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); }
  var c = checked('was2026'); if(c.length) add(E.was2026, c[0]);
  checked('part').forEach(function(v){ add(E.part, v); });
  ['name', 'email', 'phone', 'company', 'role', 'wish'].forEach(function(k){
    var v = val(k); if(v) add(E[k], v);
  });
  return parts.join('&');
}

function relay(body){
  return fetch('/api/form-submit', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({form: FORM_ID, body: body})
  }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){
      if(!r.ok || !j.ok) throw new Error('form-submit ' + r.status);
    });
  });
}

function formError(){
  var el = form.querySelector('.form-err');
  if(!el){
    el = document.createElement('p');
    el.className = 'form-err';
    el.setAttribute('role', 'alert');
    el.style.cssText = 'font-size:13px;font-weight:600;color:#b3361f;margin-top:12px;line-height:1.5';
    form.appendChild(el);
  }
  el.textContent = 'We couldn’t send your details. Check your connection and try again, or ';
  var a = document.createElement('a');
  a.href = VIEW_URL; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'open the form in a new tab'; a.style.color = 'inherit';
  el.appendChild(a);
  el.appendChild(document.createTextNode('.'));
}
function clearError(){ var el = form.querySelector('.form-err'); if(el) el.textContent = ''; }

function showDone(){
  wrap.innerHTML =
    '<div role="status" tabindex="-1" id="interest-done" style="text-align:center;padding:56px 32px;background:#fff;border:1px solid rgba(28,28,28,.08);outline:none">' +
      '<h3 style="font-size:24px;font-weight:800;color:#1C1C1C;margin:0 0 10px">Thank you.</h3>' +
      '<p style="font-size:15px;color:rgba(28,28,28,.72);line-height:1.7;max-width:420px;margin:0 auto">You’re on the list. We’ll be in touch as soon as the details are ready.</p>' +
    '</div>';
  var d = document.getElementById('interest-done');
  if(d) d.focus({preventScroll: true}); /* announces the result to screen readers */
  wrap.scrollIntoView({behavior: 'smooth', block: 'center'});
}

form.addEventListener('submit', function(e){
  e.preventDefault();
  clearError();
  var bad = validate();
  if(bad.length){
    bad[0].scrollIntoView({behavior: 'smooth', block: 'center'});
    var f = bad[0].querySelector('input:not([type=hidden]),textarea');
    if(f) f.focus({preventScroll: true});
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Sending…';
  /* spam trap: a filled hidden field means a bot; show the usual screen but send nothing */
  var send = val('fax') ? Promise.resolve() : relay(encode());
  send.then(showDone).catch(function(){
    btn.disabled = false;
    btn.textContent = label;
    formError();
  });
});
})();
