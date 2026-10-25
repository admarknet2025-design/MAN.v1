/* Tiny Redis client for the attribution log, over the Upstash REST API (no dependencies).

   Environment variables (set in Vercel, never committed). The Vercel Marketplace "Upstash for Redis" (or the older
   Vercel KV) integration creates one of these pairs for you:
     KV_REST_API_URL + KV_REST_API_TOKEN            (Vercel KV / Upstash integration)
     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

   Keys:
     att:v1:<reference>   JSON record of one checkout start (written once; SET NX)
     att:v1:index         sorted set: reference, scored by receive time (ms)
     att:v1:counts        hash: ref code -> number of checkout starts */
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
  ]);
  return true;
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

module.exports = { configured, add, recent, counts };
