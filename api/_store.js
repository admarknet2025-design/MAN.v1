/* Tiny Redis client for the attribution log, over the Upstash REST API (no dependencies).

   Environment variables (set in Vercel, never committed). The Vercel Marketplace "Upstash for Redis" (or the older
   Vercel KV) integration creates one of these pairs for you:
     KV_REST_API_URL + KV_REST_API_TOKEN            (Vercel KV / Upstash integration)
     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

   Keys:
     att:v1:<reference>   JSON record of one checkout start (written once; SET NX)
     att:v1:index         sorted set: reference, scored by receive time (ms)
     att:v1:counts        hash: ref code -> number of checkout starts
     att:v1:combo         hash: "ck|<ref>|<source>|<campaign>" -> checkouts started, "cl|..." -> tracked-link clicks
     t:v1:<code>          JSON of one tracked short link { slug, template, platform, campaign, created }
     t:v1:map:<key>       the code already issued for slug|template|platform|campaign (so regenerating reuses it)
     t:v1:clicks          list of the newest clicks (capped)
     lib:v1:<id>          JSON of one saved person from the Studio library (cropped photo as a data URL)
     lib:v1:index         sorted set of library ids by save time */
'use strict';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

const KEY = (reference) => 'att:v1:' + reference;
const INDEX = 'att:v1:index';
const COUNTS = 'att:v1:counts';

function configured() { return Boolean(URL_ && TOKEN); }

/* run commands in one round trip; returns the array of results */
async function pipeline(commands) {
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('store ' + r.status);
  const out = await r.json();
  return out.map((o) => {
    if (o && o.error) throw new Error('store: ' + o.error);
    return o ? o.result : null;
  });
}

/* returns true if this reference was new, false if it was already logged */
async function add(record) {
  const [created] = await pipeline([['SET', KEY(record.reference), JSON.stringify(record), 'NX']]);
  if (created !== 'OK') return false;
  await pipeline([
    ['ZADD', INDEX, String(Date.parse(record.received) || Date.now()), record.reference],
    ['HINCRBY', COUNTS, record.ref || '(none)', '1'],
    ['HINCRBY', COMBO, comboField('ck', record.ref, record.utm_source, record.utm_campaign), '1'],
  ]);
  return true;
}

const COMBO = 'att:v1:combo';
const comboField = (kind, ref, source, campaign) => [kind, ref || '-', source || '-', campaign || '-'].join('|');

/* ---- tracked short links (DMC Studio) ---- */
const LINK = (code) => 't:v1:' + code;
const LINK_MAP = (key) => 't:v1:map:' + key;
const CLICKS = 't:v1:clicks';
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function newCode() {
  const bytes = require('crypto').randomBytes(7);
  let c = '';
  for (let i = 0; i < 7; i++) c += ALPHABET[bytes[i] % ALPHABET.length];
  return c;
}

/* one code per slug|template|platform|campaign; asking again returns the same code */
async function linkFor(rec) {
  const key = [rec.slug, rec.template, rec.platform, rec.campaign].join('|');
  const [existing] = await pipeline([['GET', LINK_MAP(key)]]);
  if (existing) return existing;
  for (let i = 0; i < 6; i++) {
    const code = newCode();
    const [ok] = await pipeline([['SET', LINK(code), JSON.stringify(Object.assign({ created: new Date().toISOString() }, rec)), 'NX']]);
    if (ok === 'OK') {
      const [won] = await pipeline([['SET', LINK_MAP(key), code, 'NX']]);
      if (won === 'OK') return code;
      const [other] = await pipeline([['GET', LINK_MAP(key)], ['DEL', LINK(code)]]);
      return other;
    }
  }
  throw new Error('could not allocate a code');
}

async function getLink(code) {
  const [raw] = await pipeline([['GET', LINK(code)]]);
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

async function logClick(link, click) {
  const row = Object.assign({}, click, { slug: link.slug, template: link.template, platform: link.platform, campaign: link.campaign });
  await pipeline([
    ['HINCRBY', COMBO, comboField('cl', link.slug, link.platform, link.template), '1'],
    ['LPUSH', CLICKS, JSON.stringify(row)],
    ['LTRIM', CLICKS, '0', '1999'],
  ]);
}

async function recentClicks(limit) {
  const [rows] = await pipeline([['LRANGE', CLICKS, '0', String(limit - 1)]]);
  return (rows || []).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
}

/* [{ kind: 'ck'|'cl', ref, source, campaign, n }] */
async function combos() {
  const [flat] = await pipeline([['HGETALL', COMBO]]);
  const out = [];
  for (let i = 0; flat && i < flat.length; i += 2) {
    const p = flat[i].split('|');
    out.push({ kind: p[0], ref: p[1], source: p[2], campaign: p[3], n: Number(flat[i + 1]) });
  }
  return out;
}

/* ---- Studio library: saved people (only when "Save to library" is ticked) ---- */
const LIB = (id) => 'lib:v1:' + id;
const LIB_INDEX = 'lib:v1:index';

async function libSave(rec) {
  await pipeline([['SET', LIB(rec.id), JSON.stringify(rec)], ['ZADD', LIB_INDEX, String(Date.now()), rec.id]]);
}
async function libList(limit) {
  const [ids] = await pipeline([['ZREVRANGE', LIB_INDEX, '0', String(limit - 1)]]);
  if (!ids || !ids.length) return [];
  const [rows] = await pipeline([['MGET'].concat(ids.map(LIB))]);
  return (rows || []).map((s) => { try { const r = JSON.parse(s); delete r.photo; return r; } catch (e) { return null; } }).filter(Boolean);
}
async function libGet(id) {
  const [raw] = await pipeline([['GET', LIB(id)]]);
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
async function libDelete(id) {
  await pipeline([['DEL', LIB(id)], ['ZREM', LIB_INDEX, id]]);
}

/* newest first */
async function recent(limit) {
  const [refs] = await pipeline([['ZREVRANGE', INDEX, '0', String(limit - 1)]]);
  if (!refs || !refs.length) return [];
  const [rows] = await pipeline([['MGET'].concat(refs.map(KEY))]);
  return (rows || []).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
}

async function counts() {
  const [flat, total] = await pipeline([['HGETALL', COUNTS], ['ZCARD', INDEX]]);
  const out = [];
  for (let i = 0; flat && i < flat.length; i += 2) out.push({ ref: flat[i], n: Number(flat[i + 1]) });
  out.sort((a, b) => b.n - a.n);
  return { byRef: out, total: Number(total) || 0 };
}

module.exports = { configured, pipeline, add, recent, counts, linkFor, getLink, logClick, recentClicks, combos, libSave, libList, libGet, libDelete };
