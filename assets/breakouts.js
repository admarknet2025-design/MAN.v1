/* DMC 2026 breakout choice form (/breakouts) → Google Form "DMC 2026: choose your breakout session".
   Same pattern as assets/partners.js: the entry.<id> fields go to /api/form-submit, which POSTs them to the form's
   formResponse URL and reports whether Google stored them. Plus a honeypot, a loading state and a success / error message.
   The form id must be listed in FORMS in api/form-submit.js. If a question in the Google Form is ever deleted and
   re-created its entry id changes, so re-read them (form > Get pre-filled link). The page keeps nothing: no storage, no cookies. */
(function(){
'use strict';

var FORM_ID = '1FAIpQLSe4jbGTpQMYBdIOwCc1dQ-ZxfUG02sPNsdjK68KtUVhe8Mv5Q';
var FIELDS = {
  name:    'entry.1402883046', /* Full name (required) */
  contact: 'entry.6786688',    /* Phone number or email used to buy the ticket (required) */
  session: 'entry.1859155456', /* Which breakout session (required; the value must be one of the form's three options) */
  company: 'entry.644842322',  /* Company or organisation */
  role:    'entry.1086273214'  /* Job title or role */
};

var form = document.getElementById('breakoutForm');
if(!form) return;
var btn = document.getElementById('breakoutBtn');
var label = btn.textContent;
var wrap = document.getElementById('breakout-form-wrap');

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

function formError(msg, linkText, href, after){
  var el = form.querySelector('.form-err');
  if(!el){
    el = document.createElement('p');
    el.className = 'form-err';
    el.setAttribute('role', 'alert');
    el.style.cssText = 'font-size:13px;font-weight:600;color:#b3361f;margin-top:12px;line-height:1.5';
    form.appendChild(el);
  }
  el.textContent = '';
  el.appendChild(document.createTextNode(msg));
  if(linkText){
    var a = document.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = linkText; a.style.color = 'inherit';
    el.appendChild(a);
    el.appendChild(document.createTextNode(after || ''));
  }
}
function clearError(){ var el = form.querySelector('.form-err'); if(el) el.textContent = ''; }
function invalid(id, msg){
  var f = document.getElementById(id);
  f.setCustomValidity(msg);
  f.reportValidity();
  f.addEventListener('input', function clear(){ f.setCustomValidity(''); f.removeEventListener('input', clear); });
}

function showDone(first){
  wrap.innerHTML =
    '<div role="status" tabindex="-1" id="breakout-done" style="text-align:center;padding:56px 32px;background:#fff;border:1px solid rgba(28,28,28,.08);outline:none">' +
      '<h3 style="font-size:24px;font-weight:800;color:#1C1C1C;margin:0 0 10px"></h3>' +
      '<p style="font-size:15px;color:rgba(28,28,28,.72);line-height:1.7;max-width:420px;margin:0 auto"></p>' +
    '</div>';
  wrap.querySelector('h3').textContent = first ? 'Thank you, ' + first + '.' : 'Thank you.';
  wrap.querySelector('p').textContent = 'Your breakout session is noted. See you on Saturday at the British Council, Accra. Doors open 9:00 AM.';
  var d = document.getElementById('breakout-done');
  if(d) d.focus({preventScroll: true}); /* announces the result to screen readers */
  wrap.scrollIntoView({behavior: 'smooth', block: 'center'});
}

form.addEventListener('submit', function(e){
  e.preventDefault();
  clearError();
  var v = {};
  new FormData(form).forEach(function(x, k){ v[k] = String(x).trim(); });

  if(!v.name){ invalid('b-name', 'Enter your full name.'); return; }
  if(!v.contact){ invalid('b-contact', 'Enter the phone number or email you used to buy your ticket.'); return; }
  if(v.contact.indexOf('@') >= 0){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contact)){ invalid('b-contact', 'Enter a valid email address, like name@company.com.'); return; }
  } else if(v.contact.replace(/\D/g, '').length < 7){
    invalid('b-contact', 'Enter a phone number with country code, like +233 24 000 0000, or an email address.'); return;
  }
  if(!v.session){ var first = document.getElementById('bs-1'); first.setCustomValidity('Choose a session.'); first.reportValidity(); first.addEventListener('change', function(){ first.setCustomValidity(''); }, {once: true}); return; }

  btn.disabled = true;
  btn.textContent = 'Sending…';
  /* spam trap: a filled hidden field means a bot; show the usual screen but send nothing */
  var body = Object.keys(FIELDS).map(function(k){ return encodeURIComponent(FIELDS[k]) + '=' + encodeURIComponent(v[k] || ''); }).join('&');
  var send = v.fax ? Promise.resolve() : relay(body);
  send.then(function(){
    showDone(v.name.split(' ')[0]);
  }).catch(function(){
    btn.disabled = false;
    btn.textContent = label;
    formError('We couldn’t send your choice. Check your connection and try again, or ', 'open the form in a new tab', 'https://docs.google.com/forms/d/e/' + FORM_ID + '/viewform', '.');
  });
});
})();
