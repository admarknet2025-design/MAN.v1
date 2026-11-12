/* POST /api/studio-links (team login) — issues one tracked short link per platform for an artwork.
   Body: { slug, template, platforms: ["instagram", ...] }  Returns { links: { instagram: "https://mangh.org/t/<code>", ... } }.
   Asking again for the same slug + template + platform returns the same code. */
'use strict';

const store = require('./_store');
const { requireAuth, origin } = require('./_auth');

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'whatsapp'];
const TEMPLATES = ['speaker', 'attending', 'sponsor', 'quote', 'countdown', 'session'];
const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res, 'DMC Studio')) return;
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const slug = String(b.slug || '').toLowerCase();
  const template = String(b.template || '');
  const platforms = Array.isArray(b.platforms) ? b.platforms.filter((p) => PLATFORMS.indexOf(p) >= 0) : [];
  if (!SLUG.test(slug) || TEMPLATES.indexOf(template) < 0 || !platforms.length) return res.status(400).json({ error: 'bad request' });
  if (!store.configured()) return res.status(503).json({ error: 'The link store is not configured (KV_REST_API_URL / KV_REST_API_TOKEN).' });
  try {
    const base = origin(req);
    const links = {};
    for (const platform of platforms) {
      const code = await store.linkFor({ slug, template, platform, campaign: template });
      links[platform] = base + '/t/' + code;
    }
    return res.status(200).json({ links });
  } catch (e) {
    console.error('studio links error', e && e.message);
    return res.status(502).json({ error: 'store unavailable' });
  }
};
