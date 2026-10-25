/* /api/studio-library (team login) — the optional shared library of people the team has chosen to save.
   Nothing is stored unless "Save to library" is ticked in the Studio.
     GET  ?                 list of saved people (no photos)
     GET  ?id=<id>          one person including the cropped photo (data URL)
     POST { name, title, company, photo, permission: true }   save
     DELETE ?id=<id>        remove */
'use strict';

const store = require('./_store');
const { requireAuth } = require('./_auth');

const ID = /^[a-z0-9]{6,20}$/;
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res, 'DMC Studio')) return;
  if (!store.configured()) return res.status(503).json({ error: 'The library store is not configured (KV_REST_API_URL / KV_REST_API_TOKEN).' });
  try {
    if (req.method === 'GET') {
      const id = req.query && req.query.id;
      if (id) {
        if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
        const rec = await store.libGet(id);
        return rec ? res.status(200).json(rec) : res.status(404).json({ error: 'not found' });
      }
      return res.status(200).json({ people: await store.libList(100) });
    }
    if (req.method === 'POST') {
      const b = req.body && typeof req.body === 'object' ? req.body : {};
      if (b.permission !== true) return res.status(400).json({ error: 'Confirm you have the person’s permission to save their photo.' });
      const name = clean(b.name, 60);
      const photo = String(b.photo || '');
      if (!name || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > 420000) return res.status(400).json({ error: 'name and a photo under 300 KB are required' });
      const id = require('crypto').randomBytes(8).toString('hex').slice(0, 12);
      await store.libSave({ id, name, title: clean(b.title, 90), company: clean(b.company, 70), photo, saved: new Date().toISOString() });
      return res.status(201).json({ id });
    }
    if (req.method === 'DELETE') {
      const id = req.query && req.query.id;
      if (!ID.test(id || '')) return res.status(400).json({ error: 'bad id' });
      await store.libDelete(id);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('studio library error', e && e.message);
    return res.status(502).json({ error: 'store unavailable' });
  }
};
