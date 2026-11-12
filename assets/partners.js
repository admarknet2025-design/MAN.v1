/* DMC 2027 partnership interest form (/partners#interest) → Google Form.
   Same pattern as the community sign-up in assets/app.js: the entry.<id> fields go to /api/form-submit, which POSTs them
   to the form's formResponse URL and reports whether Google stored them; plus a honeypot, a loading state, and a success / error message. If PARTNER_FORM is ever
   emptied, the submit button disables itself (with a console warning). */
(function(){
'use strict';

/* working days promised in the success message; keep equal to REPLY_DAYS in the form's Apps Script (confirmed: 3) */
var PARTNER_REPLY_DAYS = 3;

/* The Google Form "DMC 2027 Partnership Interest" (owned by the M·A·N Google account; responses go to the Sheet
   "DMC 2027 Partnership Interest (Responses)", which has a Status column). The entry.<id> values come from the live
   form; if a question is ever deleted and re-created its id changes, so re-read them (form > Get pre-filled link).
   The form id must also be listed in FORMS in api/form-submit.js. */
var PARTNER_FORM = {
  url: 'https://docs.google.com/forms/d/e/1FAIpQLSeTARgNGhqSIpnaDbnM1nkFLywGVH9CImomrSNBrZfVC6irVg/formResponse',
  fields: {
    company:   'entry.1341781364', /* Company (required) */
    name:      'entry.185364778',  /* Contact name (required) */
    role:      'entry.420210386',  /* Role */
    email:     'entry.464573096',  /* Email */
    whatsapp:  'entry.99722791',   /* WhatsApp */
    interest:  'entry.816365957',  /* Interest (checkboxes: one entry value per ticked option) */
    outcome:   'entry.1211098734', /* Outcome */
    timeline:  'entry.39606336',   /* Timeline (dropdown) */
    ref:       'entry.929923117',  /* Ref (hidden) */
    page:      'entry.675384087'   /* Page URL (hidden) */
  }
};

var form = document.getElementById('partnerForm');
if(!form) return;
var btn = document.getElementById('partnerBtn');
var label = btn.textContent;
var wrap = document.getElementById('partner-form-wrap');

function configured(){
  if(!/^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse$/.test(PARTNER_FORM.url)) return false;
  return Object.keys(PARTNER_FORM.fields).every(function(k){ return /^entry\.\d+$/.test(PARTNER_FORM.fields[k]); });
}
var live = configured();
if(!live){
  btn.disabled = true;
  var note = document.getElementById('p-config-note');
  if(note) note.hidden = false;
  if(window.console && console.warn) console.warn('[partners] PARTNER_FORM in assets/partners.js is not filled in (formResponse URL and entry.<id> values), so the submit button is disabled.');
}

/* hidden fields: the ?ref= code (same shape as the site's share links) and the page URL */
(function(){
  var r = '';
  try { r = (new URLSearchParams(location.search).get('ref') || '').toLowerCase(); } catch(e) {}
  if(!/^[a-z0-9]+(-[a-z0-9-]*)?$/.test(r) || r.length > 40) r = '';
  document.getElementById('p-ref').value = r;
  document.getElementById('p-page').value = location.origin + location.pathname + location.search;
})();

function val(id){ return document.getElementById(id).value.trim(); }
function formError(msg){
  var el = form.querySelector('.form-err');
  if(!el){
    el = document.createElement('p');
    el.className = 'form-err';
    el.setAttribute('role', 'alert');
    el.style.cssText = 'font-size:13px;font-weight:600;color:#b3361f;margin-top:12px;line-height:1.5';
    form.appendChild(el);
  }
  el.textContent = '';
  el.appendChild(document.createTextNode(msg.before));
  if(msg.linkText){
    var a = document.createElement('a');
    a.href = '/#connect'; a.textContent = msg.linkText; a.style.color = 'inherit';
    el.appendChild(a);
    el.appendChild(document.createTextNode(msg.after || ''));
  }
}
function clearError(){ var el = form.querySelector('.form-err'); if(el) el.textContent = ''; }
function invalid(id, msg){
  var f = document.getElementById(id);
  f.setCustomValidity(msg);
  f.reportValidity();
  f.addEventListener('input', function clear(){ f.setCustomValidity(''); f.removeEventListener('input', clear); });
}

/* one POST body; the interest checkboxes send one entry.<id> value per ticked option */
function body(v, interests){
  var F = PARTNER_FORM.fields, parts = [];
  function add(k, x){ parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(x)); }
  ['company', 'name', 'role', 'email', 'whatsapp', 'outcome', 'timeline', 'ref', 'page'].forEach(function(k){ add(F[k], v[k] || ''); });
  interests.forEach(function(x){ add(F.interest, x); });
  return parts.join('&');
}

function showDone(first){
  wrap.innerHTML =
    '<div role="status" tabindex="-1" id="partner-done" style="text-align:center;padding:56px 32px;background:#fff;border:1px solid rgba(28,28,28,.08);outline:none">' +
      '<h3 style="font-size:24px;font-weight:800;color:#1C1C1C;margin:0 0 10px"></h3>' +
      '<p style="font-size:15px;color:rgba(28,28,28,.72);line-height:1.7;max-width:420px;margin:0 auto"></p>' +
    '</div>';
  wrap.querySelector('h3').textContent = first ? 'Thanks, ' + first + '.' : 'Thanks.';
  wrap.querySelector('p').textContent = 'We’ve received your details and will reply within ' + PARTNER_REPLY_DAYS + ' working days.';
  var d = document.getElementById('partner-done');
  if(d) d.focus({preventScroll: true}); /* announces the result to screen readers */
  wrap.scrollIntoView({behavior: 'smooth', block: 'center'});
}

form.addEventListener('submit', function(e){
  e.preventDefault();
  clearError();
  var v = {};
  new FormData(form).forEach(function(x, k){ if(k !== 'interest') v[k] = String(x).trim(); });
  var interests = Array.prototype.map.call(form.querySelectorAll('input[name=interest]:checked'), function(c){ return c.value; });

  if(!v.company){ invalid('p-company', 'Enter your company or organisation.'); return; }
  if(!v.name){ invalid('p-name', 'Enter the contact person’s name.'); return; }
  if(!v.email && !v.whatsapp){ invalid('p-email', 'Give us an email address or a WhatsApp number.'); return; }
  if(v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)){ invalid('p-email', 'Enter a valid email address, like name@company.com.'); return; }
  if(v.whatsapp && v.whatsapp.replace(/\D/g, '').length < 7){ invalid('p-whatsapp', 'Enter your WhatsApp number with country code, like +233 24 000 0000.'); return; }
  if(!live) return;

  btn.disabled = true;
  btn.textContent = 'Sending…';
  /* spam trap: a filled hidden field means a bot; show the usual screen but send nothing */
  /* through /api/form-submit (defined in assets/app.js): resolves only when Google stored the response */
  var send = v.fax ? Promise.resolve() :
    (window.MAN_relaySubmit ? window.MAN_relaySubmit(PARTNER_FORM.url, body(v, interests)) : Promise.reject(new Error('relay')));
  send.then(function(){
    showDone(v.name.split(' ')[0]);
  }).catch(function(){
    btn.disabled = false;
    btn.textContent = label;
    formError({ before: 'We couldn’t send your details. Check your connection and try again, or use the ', linkText: 'contact details', after: ' on our home page.' });
  });
});
})();
