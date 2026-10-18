/* DMC 2026 sponsor form */
(function () {
  /* Sponsor form endpoint (Google Apps Script web app). Change it here only. */
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbx5UqBU_mwbdOTbBfR3LeT91xncqbKoY4p_evsc-r6o8V_RPTK3t1DMt0qbNKO-vRGF/exec';
  var form = document.getElementById('form');
  var statusEl = document.getElementById('status');
  var submitBtn = document.getElementById('submit');

  function val(id) { return document.getElementById(id).value.trim(); }
  function setErr(id, msg) {
    var f = document.getElementById(id), e = document.getElementById('e-' + id);
    if (e) e.textContent = msg || '';
    if (f) f.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function validate() {
    var ok = true, first = null;
    function need(id, msg) { var bad = !val(id); setErr(id, bad ? msg : ''); if (bad && !first) first = id; if (bad) ok = false; }
    need('company', 'Enter your company or organisation.');
    need('name', 'Enter the contact person’s name.');
    need('phone', 'Enter a phone or WhatsApp number.');
    var em = val('email');
    var badEm = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
    setErr('email', badEm ? 'Enter a valid email address, like name@company.com.' : '');
    if (badEm) { ok = false; if (!first) first = 'email'; }
    if (first) document.getElementById(first).focus();
    return ok;
  }

  function payload() {
    var tier = (form.querySelector('input[name=tier]:checked') || {}).value || 'Not sure yet';
    var interests = Array.prototype.map.call(form.querySelectorAll('input[name=interest]:checked'), function (c) { return c.value; });
    return {
      company: val('company'), website: val('website'), name: val('name'), role: val('role'),
      email: val('email'), phone: val('phone'), tier: tier, interests: interests,
      submittedAt: new Date().toISOString(), status: 'new'
    };
  }
  function summaryText(p) {
    return [
      'DMC 2026 sponsorship interest',
      'Company: ' + p.company,
      'Website: ' + (p.website || '-'),
      'Contact: ' + p.name + (p.role ? ' (' + p.role + ')' : ''),
      'Email: ' + p.email,
      'Phone/WhatsApp: ' + p.phone,
      'Tier: ' + p.tier,
      'Interested in: ' + (p.interests.length ? p.interests.join(', ') : '-')
    ].join('\n');
  }

  /* Apps Script web apps send no CORS headers, so this is a deliberate no-cors POST with a text/plain JSON body.
     The response is opaque: a resolved fetch means the request was sent, not that the row was written. */
  async function save(p) {
    await fetch(ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(p)
    });
  }

  function showDone(saved, p) {
    form.hidden = true;
    var d = document.getElementById('done');
    d.hidden = false;
    if (saved) {
      document.getElementById('done-title').textContent = 'Thank you, ' + p.name.split(' ')[0];
      document.getElementById('done-body').textContent = 'We received the details for ' + p.company + '. Our partnerships team will reply to ' + p.email + ' with the sponsor pack.';
    } else {
      document.getElementById('done-title').textContent = 'One more step';
      document.getElementById('done-body').textContent = 'We could not record your details from this page. Copy them below and send them to the DMC 2026 partnerships team so your interest reaches us.';
      document.getElementById('fallback').hidden = false;
      document.getElementById('summary').textContent = summaryText(p);
    }
    d.scrollIntoView({ block: 'start' });
  }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    statusEl.textContent = '';
    if (document.getElementById('fax').value) return;
    if (!validate()) return;
    var p = payload();
    submitBtn.disabled = true; submitBtn.textContent = 'Sending…';
    try {
      await save(p); showDone(true, p);
      if (window.gtag) window.gtag('event', 'sponsor_enquiry', { tier: p.tier });
    } catch (e) {
      showDone(false, p);
      if (window.gtag) window.gtag('event', 'sponsor_enquiry_error', { tier: p.tier });
    }
  });

  document.getElementById('copy').addEventListener('click', function () {
    var t = document.getElementById('summary').textContent, b = this;
    var sel = function () { var r = document.createRange(); r.selectNodeContents(document.getElementById('summary')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected, press copy'; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { b.textContent = 'Copied'; }, sel);
    } else sel();
  });
})();
