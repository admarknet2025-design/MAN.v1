/* DMC 2026 post-event survey (/dmc-2026-survey) → Google Form "DMC 2026 survey" (AdMarkNet account).
   Same pattern as assets/breakouts.js: the answers go to /api/form-submit, which POSTs them to the form's formResponse
   URL and reports whether Google stored them. Plus a honeypot, a loading state and a success / error message.
   The form id must be listed in FORMS in api/form-submit.js.
   The questions in dmc-2026-survey.html mirror the Google Form one to one. Option values must match the form's options
   exactly (including "Definately"), or Google rejects the response. If a question is edited, deleted or re-created in the
   form, re-read the entry ids and options (the form's FB_PUBLIC_LOAD_DATA_) and update both files.
   The page keeps nothing: no storage, no cookies. */
(function(){
'use strict';

var FORM_ID = '1FAIpQLSc9W9k-Ok1aW-0fdTT3Pvnyxi8bzf25zyyIa2o0y9aKeHDbdQ';
var VIEW_URL = 'https://docs.google.com/forms/d/e/' + FORM_ID + '/viewform';

/* page field → Google Form entry id */
var E = {
  overall:        'entry.655507640',   /* 1-5, required */
  recommend:      'entry.474717544',   /* 1-10, required */
  s_keynote:      'entry.1169892890',  /* session grid rows, all required */
  s_yourself:     'entry.1141156678',
  s_team:         'entry.560606147',
  s_work:         'entry.712907196',
  s_pitch:        'entry.1022998319',
  s_breakout:     'entry.1421566299',
  takeaway:       'entry.1215546423',  /* paragraph, required */
  e_venue:        'entry.464338378',   /* experience grid rows, all required */
  e_timing:       'entry.1798699203',
  e_registration: 'entry.884286065',
  e_ticketing:    'entry.775666282',
  e_networking:   'entry.815097212',
  value:          'entry.80458988',    /* multiple choice, required */
  partners:       'entry.1185154233',  /* checkboxes, optional */
  topics:         'entry.1810167979',  /* checkboxes + Other, required */
  attend:         'entry.299316233',   /* multiple choice, required */
  improve:        'entry.1172581994',  /* paragraph, optional */
  sponsors:       'entry.1277564209',  /* checkboxes + Other, optional */
  workshops:      'entry.1601688153',  /* Yes / No, required */
  name:           'entry.2127267316',  /* short answer, optional */
  email:          'entry.343259750',   /* short answer with email validation, optional */
  quote:          'entry.1348481870'   /* single checkbox, optional */
};

var form = document.getElementById('surveyForm');
if(!form) return;
var btn = document.getElementById('surveyBtn');
var label = btn.textContent;
var wrap = document.getElementById('survey-form-wrap');

/* build the rating-grid chips from data-cols, so every row has exactly the form's columns */
Array.prototype.forEach.call(form.querySelectorAll('[data-grid]'), function(g){
  var cols = g.getAttribute('data-cols').split('|');
  Array.prototype.forEach.call(g.querySelectorAll('[data-row]'), function(row){
    var name = row.getAttribute('data-row');
    var chips = document.createElement('div');
    chips.className = 'chips';
    cols.forEach(function(c){
      var l = document.createElement('label');
      var i = document.createElement('input');
      i.type = 'radio'; i.name = name; i.value = c;
      var s = document.createElement('span');
      s.textContent = c;
      l.appendChild(i); l.appendChild(s);
      chips.appendChild(l);
    });
    row.appendChild(chips);
  });
});

/* typing an Other answer ticks its box */
[['topics-other', 'topics-other-on'], ['sponsors-other', 'sponsors-other-on']].forEach(function(p){
  var t = document.getElementById(p[0]), c = document.getElementById(p[1]);
  if(t && c) t.addEventListener('input', function(){ c.checked = t.value.trim() !== ''; });
});

/* clear a question's error as soon as it is answered */
form.addEventListener('change', function(e){ var q = e.target.closest('.q'); if(q) q.classList.remove('bad'); });
form.addEventListener('input', function(e){ var q = e.target.closest('.q'); if(q) q.classList.remove('bad'); });

function checked(name){
  return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function(i){ return i.value; });
}
function val(name){ var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; }
function otherText(name){ return checked(name + '_other_on').length ? val(name + '_other') : ''; }

function validate(){
  var bad = [];
  Array.prototype.forEach.call(form.querySelectorAll('.q[data-req]'), function(q){
    var kind = q.getAttribute('data-req'), name = q.getAttribute('data-name'), ok = true;
    if(kind === 'radio') ok = checked(name).length === 1;
    else if(kind === 'check') ok = checked(name).length > 0 || otherText(name) !== '';
    else if(kind === 'text') ok = val(name) !== '';
    else if(kind === 'email') ok = val(name) === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val(name));
    else if(kind === 'grid') ok = Array.prototype.every.call(q.querySelectorAll('[data-row]'), function(r){ return checked(r.getAttribute('data-row')).length === 1; });
    q.classList.toggle('bad', !ok);
    if(!ok) bad.push(q);
  });
  return bad;
}

function encode(){
  var parts = [];
  function add(k, v){ parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); }
  ['overall', 'recommend', 'value', 'attend', 'workshops',
   's_keynote', 's_yourself', 's_team', 's_work', 's_pitch', 's_breakout',
   'e_venue', 'e_timing', 'e_registration', 'e_ticketing', 'e_networking'].forEach(function(k){
    var c = checked(k); if(c.length) add(E[k], c[0]);
  });
  ['partners', 'topics', 'sponsors', 'quote'].forEach(function(k){
    checked(k).forEach(function(v){ add(E[k], v); });
  });
  ['topics', 'sponsors'].forEach(function(k){
    var o = otherText(k);
    if(o){ add(E[k], '__other_option__'); add(E[k] + '.other_option_response', o); }
  });
  ['takeaway', 'improve', 'name', 'email'].forEach(function(k){
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
  el.textContent = 'We couldn’t send your feedback. Check your connection and try again, or ';
  var a = document.createElement('a');
  a.href = VIEW_URL; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'open the survey in a new tab'; a.style.color = 'inherit';
  el.appendChild(a);
  el.appendChild(document.createTextNode('.'));
}
function clearError(){ var el = form.querySelector('.form-err'); if(el) el.textContent = ''; }

function showDone(){
  wrap.innerHTML =
    '<div role="status" tabindex="-1" id="survey-done" style="text-align:center;padding:56px 32px;background:#fff;border:1px solid rgba(28,28,28,.08);outline:none">' +
      '<h3 style="font-size:24px;font-weight:800;color:#1C1C1C;margin:0 0 10px">Thank you.</h3>' +
      '<p style="font-size:15px;color:rgba(28,28,28,.72);line-height:1.7;max-width:420px;margin:0 auto">See you at DMC 2027.</p>' +
    '</div>';
  var d = document.getElementById('survey-done');
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
