/* POST /api/form-submit: relays the site's Google Form submissions (community sign-up, DMC 2027 partner interest).

   Why a relay: a browser can only POST to docs.google.com in `no-cors` mode, whose response is opaque, so the page
   cannot tell a stored response (HTTP 200) from a rejected one (HTTP 400, e.g. a dropdown value that is not one of the
   form's options, or a missing required answer). The pages used to show "received" either way. Here the server makes
   the POST, reads Google's real status, and the page shows success only when Google accepted the response.

   Request:  JSON { "form": "<public form id, the part after /forms/d/e/>", "body": "entry.123=...&entry.456=..." }
   Response: 200 { ok: true } | 4xx/5xx { ok: false, error }
   Only the forms in FORMS are relayed, and only entry.<digits> fields, so this is not an open relay. */
'use strict';

/* public form id -> what it is (for logs only). Add a form here before pointing a page at it. */
const FORMS = {
  '1FAIpQLSeqrp_YIh4-8Hjd5M6rkfoetbzMpURy_eq1PN4q_wkoKypWJQ': 'community sign-up (index.html, assets/app.js)'
  /* the DMC 2027 partner-interest form is added here when PARTNER_FORM in assets/partners.js is filled in */
};

const MAX_BODY = 16 * 1024;
const FIELD = /^entry\.\d+$/;

function readJson(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') { try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve(null); } }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > MAX_BODY * 2) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { ok: false, error: 'method' }); }

  const data = await readJson(req);
  const id = data && typeof data.form === 'string' ? data.form : '';
  const body = data && typeof data.body === 'string' ? data.body : '';
  if (!Object.prototype.hasOwnProperty.call(FORMS, id)) return send(res, 400, { ok: false, error: 'form' });
  if (!body || body.length > MAX_BODY) return send(res, 400, { ok: false, error: 'body' });

  const params = new URLSearchParams(body);
  for (const k of params.keys()) if (!FIELD.test(k)) return send(res, 400, { ok: false, error: 'field' });

  let status = 0;
  try {
    const r = await fetch('https://docs.google.com/forms/d/e/' + id + '/formResponse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      redirect: 'manual', /* a redirect means Google wants a sign-in: the response was not stored */
      signal: AbortSignal.timeout(10000)
    });
    status = r.status;
  } catch (e) {
    console.error('[form-submit] network error', FORMS[id], e && e.name);
    return send(res, 502, { ok: false, error: 'upstream' });
  }
  if (status === 200) return send(res, 200, { ok: true });
  console.error('[form-submit] Google rejected the response', FORMS[id], status);
  return send(res, 502, { ok: false, error: 'rejected', status });
};
