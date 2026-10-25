/* POST /api/studio-render (team login) — renders one artwork PNG on the server (same fonts, same code for everyone).
   Body: { template, size, fields, photo?, sitePhoto?, partner?, logo?, qrCode? }. Returns image/png. */
'use strict';

const { requireAuth, origin } = require('./_auth');

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res, 'DMC Studio')) return;
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  const b = req.body && typeof req.body === 'object' ? req.body : null;
  if (!b) return res.status(400).json({ error: 'bad body' });
  try {
    const { render } = require('../lib/studio/render');
    const code = /^[a-z0-9]{4,12}$/.test(String(b.qrCode || '')) ? String(b.qrCode) : '';
    const png = await render({
      template: String(b.template || ''),
      size: String(b.size || ''),
      fields: b.fields && typeof b.fields === 'object' ? b.fields : {},
      photo: typeof b.photo === 'string' ? b.photo : '',
      sitePhoto: typeof b.sitePhoto === 'string' ? b.sitePhoto : '',
      partner: typeof b.partner === 'string' ? b.partner : '',
      logo: typeof b.logo === 'string' ? b.logo : '',
      qrUrl: code ? origin(req) + '/t/' + code : '',
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(png);
  } catch (e) {
    console.error('studio render error', e && e.message);
    return res.status(/unknown|bad/.test(String(e && e.message)) ? 400 : 500).json({ error: String((e && e.message) || 'render failed') });
  }
};
