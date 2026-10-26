/* DMC Live: shared server logic for the phone view (/live), the projector view (/live/screen) and the operator panel
   (/live/control). Everything lives in the same Upstash Redis as the attribution log (see _store.js), under "live:v1:".

   Realtime is short polling: phones and screens GET /api/live-state every 2 seconds; the response is cached by Vercel's edge for
   1 second and rebuilt only when the "ver" counter has changed, so 250 phones cost Redis about one command per second.

   Redis keys (all under live:v1:):
     ver                 integer, bumped by every change (public submit or operator action)
     cfg                 hash: session, activity, screen, prompts, sess, rehearsal, takeover (each a JSON string)
     hb                  zset: device hash scored by last heartbeat (people connected)
     dev:<dh>:w          hash: cloud -> entries this device has made (limit 3 each)
     wc:<cloud>          zset: normalised word -> count;  wcd:<cloud> hash: normalised word -> display form
     flag                hash: flagged words waiting for the operator
     qs:<session>        hash: question id -> JSON;  qv:<session> hash: id -> votes;  qvt:<session>:<id> set of voters
     polls               hash: poll id -> JSON;  pv:<poll> hash: option -> votes;  pvd:<poll> hash: device hash -> option
     wall                hash: id -> JSON (Build Wall entries, with opt-in contact);  tk hash: id -> JSON (takeaway cards)
     tki:<id>            string: small preview image of a takeaway card (moderation only)
     quotes              hash: id -> JSON (official quotes);  handles hash: speaker slug -> social handle
     an                  hash: analytics counters;  blocked set: extra blocked words;  rl:<kind>:<key> rate-limit markers
   Device ids are stored only as salted hashes and expire 30 days after the event; Build Wall contacts (opt-in) 90 days after. */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./_store');
const DATA = require('../lib/studio/data.json');

const P = 'live:v1:';
const K = (name) => P + name;
const EVENT_END = Math.floor(Date.UTC(2026, 10, 21, 23, 59, 59) / 1000);
const KEEP = EVENT_END + 30 * 86400;        /* device ids and everything else */
const KEEP_WALL = EVENT_END + 90 * 86400;   /* Build Wall entries (opt-in contacts for the What I Built cards) */

/* ---- brand: the movements and their fixed accent colours (gold is only a small accent: kente strips, rings, tag chips) ---- */
const COLOURS = { ob: '#1C1C1C', cr: '#F4EFE6', te: '#2A7B74', co: '#D95F45' };
const MOVEMENTS = {
  'Build Yourself': { cloud: 'yourself', accent: COLOURS.te, ink: '#FFFFFF' },
  'Build Your Team': { cloud: 'team', accent: COLOURS.co, ink: COLOURS.ob },
  'Build Your Work': { cloud: 'work', accent: COLOURS.cr, ink: COLOURS.ob }
};
const CLOUDS = {
  yourself: { id: 'yourself', movement: 'Build Yourself', accent: COLOURS.te, prompt: 'One word for what’s stopping you from growing.' },
  team: { id: 'team', movement: 'Build Your Team', accent: COLOURS.co, prompt: 'One word for the team you want.' },
  work: { id: 'work', movement: 'Build Your Work', accent: COLOURS.cr, prompt: 'One word for what you’ll ship in 2027.' }
};
const FORMATS = ['Keynote', 'Discussion', 'Presentation', 'Live Interview', 'Other'];
const LIMITS = { word: 24, question: 280, name: 30, line: 120, takeaway: 140, contact: 80, quote: 220, wordsPerDevice: 3, previewBytes: 60000 };

/* ---- redis helpers ---- */
const run = (cmds) => store.pipeline(cmds);
const toObj = (flat) => { const o = {}; for (let i = 0; flat && i < flat.length; i += 2) o[flat[i]] = flat[i + 1]; return o; };
const jp = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const now = () => Date.now();
/* plain text only: control characters, angle brackets and emoji go (emoji are full-colour pictures the brand palette cannot control, and they differ per phone) */
const PICTURES = /(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
const clean = (s, max) => String(s == null ? '' : s).replace(PICTURES, '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200);

let SALT = process.env.LIVE_SALT || 'dmc26-live';
const hashDevice = (id) => crypto.createHash('sha256').update(SALT + '|' + String(id)).digest('hex').slice(0, 16);
const validDevice = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id);

/* returns true if allowed; false if this device already did this within `seconds` */
async function rateOk(kind, key, seconds) {
  const [r] = await run([['SET', K('rl:' + kind + ':' + key), '1', 'NX', 'EX', String(seconds)]]);
  return r === 'OK';
}
const bump = () => ['INCR', K('ver')];
/* changes that affect settings the public endpoints validate against (current activity, polls, sessions, prompts) also bump "cver",
   so a submit costs one GET to know whether its cached copy of the settings is still good */
const bumpCfg = () => [['INCR', K('ver')], ['INCR', K('cver')]];

/* ---- text: normalising words and the profanity filter (the matching rules live in lib/live/filter-core.js and are bundled into
   assets/live-cards.js, so card text is checked on the phone by exactly the same code) ---- */
const { squash, tokens, hits, compile } = require('../lib/live/filter-core');
let BLOCK = null, BLOCK_AT = 0;
function baseList() {
  const file = path.join(__dirname, '..', 'lib', 'live', 'blocklist.txt');
  return fs.readFileSync(file, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
}
async function blocklist() {
  if (BLOCK && now() - BLOCK_AT < 30000) return BLOCK;
  let extra = [];
  try { [extra] = await run([['SMEMBERS', K('blocked')]]); } catch (e) { extra = []; }
  const all = baseList().concat(extra || []);
  BLOCK = { words: compile(all), raw: all };
  BLOCK_AT = now();
  return BLOCK;
}
async function isClean(text) { const l = await blocklist(); return !hits(text, l); }

/* one or two words, lower-cased, trimmed, simple plurals folded (so "Teams" and "team" are one word) */
function normaliseWord(raw) {
  const s = clean(raw, LIMITS.word * 2).toLowerCase().replace(/[^\p{L}\p{N}'’ -]/gu, '').replace(/\s+/g, ' ').trim();
  const words = s.split(' ').filter(Boolean);
  if (!words.length || words.length > 2) return null;
  const one = (w) => {
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  };
  const out = words.map(one).join(' ');
  return out.length >= 2 && out.length <= LIMITS.word ? out : null;
}
const display = (w) => w.replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

/* ---- programme: sessions come from the site's own data (lib/studio/data.json, built from dmc-2026.html) plus the operator's edits ---- */
const PEOPLE = new Map(DATA.people.map((p) => [p.slug, p]));
function personView(slug, handles) {
  const p = PEOPLE.get(slug);
  if (!p) return null;
  return { slug: p.slug, name: p.name, title: p.title || '', company: p.company || '', photo: p.photo ? '/assets/speakers/' + p.photo : '', sponsor: p.sponsor || '', handle: (handles && handles[p.slug]) || '' };
}
function baseSessions() {
  return DATA.sessions.map((s) => ({ id: s.id, start: s.start, end: s.end, title: s.title, badge: s.badge, format: s.format || s.badge, movement: s.movement || '',
    people: s.people || [], note: s.speakers || '', custom: false }));
}
function sessionList(sess) {
  sess = sess || {};
  const over = sess.over || {};
  let list = baseSessions().concat((sess.add || []).map((a) => Object.assign({ custom: true, people: [], note: '', badge: a.format || 'Other' }, a)));
  list = list.map((s) => Object.assign({}, s, over[s.id] || {}));
  if (Array.isArray(sess.order) && sess.order.length) {
    const rank = new Map(sess.order.map((id, i) => [id, i]));
    list.sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 999) - (rank.has(b.id) ? rank.get(b.id) : 999));
  }
  return list.filter((s) => !s.hidden);
}
function sessionView(s, handles) {
  if (!s) return null;
  const m = MOVEMENTS[s.movement] || { accent: COLOURS.te, ink: '#FFFFFF' };
  return { id: s.id, start: s.start || '', end: s.end || '', title: s.title, format: s.format, movement: s.movement || '', accent: m.accent, ink: m.ink,
    speakers: (s.people || []).map((slug) => personView(slug, handles)).filter(Boolean), note: s.note || '' };
}

/* ---- config ---- */
async function readCfg() {
  const [flat, ver] = await run([['HGETALL', K('cfg')], ['GET', K('ver')]]);
  const c = toObj(flat);
  return {
    ver: Number(ver) || 0,
    session: c.session || '',
    activity: jp(c.activity, { type: 'none' }),
    screen: jp(c.screen, { mode: 'follow' }),
    prompts: Object.assign({}, ...Object.keys(CLOUDS).map((k) => ({ [k]: CLOUDS[k].prompt })), jp(c.prompts, {})),
    sess: jp(c.sess, {}),
    rehearsal: c.rehearsal === '1',
    takeover: jp(c.takeover, null)
  };
}
function cfgSet(field, value) { return ['HSET', K('cfg'), field, typeof value === 'string' ? value : JSON.stringify(value)]; }

let cfgMemo = { cver: null, value: null };
async function readCfgCached() {
  const [cver] = await run([['GET', K('cver')]]);
  if (cfgMemo.value && cfgMemo.cver === (cver || '0')) return cfgMemo.value;
  const value = await readCfg();
  cfgMemo = { cver: cver || '0', value };
  return value;
}

/* ---- the public state (phones) and the screen state (projector) ---- */
const memo = {};
async function memoised(name, build) {
  const [ver] = await run([['GET', K('ver')]]);
  const key = name + ':' + (ver || 0);
  if (memo[name] && memo[name].key === key) return memo[name].value;
  const value = await build();
  memo[name] = { key, value };
  return value;
}

function questionList(qs, qv, onlyApproved) {
  const votes = toObj(qv);
  const rows = Object.values(toObj(qs)).map((j) => jp(j, null)).filter(Boolean);
  const out = rows.filter((q) => (onlyApproved ? q.status === 'approved' : true)).map((q) => Object.assign({}, q, { votes: Number(votes[q.id]) || 0 }));
  out.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.answered ? 1 : 0) - (b.answered ? 1 : 0) || b.votes - a.votes || a.ts - b.ts);
  return out;
}
const pubQuestion = (q) => ({ id: q.id, text: q.text, name: q.name, votes: q.votes, pinned: !!q.pinned, answered: !!q.answered });

async function pollView(poll, showAll) {
  if (!poll) return null;
  const [pv] = await run([['HGETALL', K('pv:' + poll.id)]]);
  const v = toObj(pv);
  const counts = poll.options.map((_, i) => Number(v[i]) || 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const out = { id: poll.id, question: poll.question, options: poll.options, open: !!poll.open, show: !!poll.show, role: poll.pair ? poll.pair.role : '', pair: poll.pair ? poll.pair.with : '' };
  if (poll.show || showAll) { out.counts = counts; out.total = total; }
  return out;
}
/* swing: the same question before and after, matched per device */
async function swingView(pollBefore, pollAfter) {
  const [b, a] = await run([['HGETALL', K('pvd:' + pollBefore.id)], ['HGETALL', K('pvd:' + pollAfter.id)]]);
  const B = toObj(b), A = toObj(a);
  let both = 0, changed = 0;
  const flow = {};
  for (const dh of Object.keys(B)) {
    if (A[dh] === undefined) continue;
    both++;
    if (A[dh] !== B[dh]) { changed++; flow[B[dh] + '>' + A[dh]] = (flow[B[dh] + '>' + A[dh]] || 0) + 1; }
  }
  return { both, changed, pct: both ? Math.round((changed / both) * 100) : 0, flow };
}

async function officialQuotes(sessionId, handles) {
  const [q] = await run([['HGETALL', K('quotes')]]);
  return Object.values(toObj(q)).map((j) => jp(j, null)).filter((x) => x && x.session === sessionId && x.published && (!x.sponsor || x.approved))
    .sort((a, b) => a.ts - b.ts).map((x) => ({ id: x.id, text: x.text, session: x.session, speaker: Object.assign({}, x.speaker, { handle: (x.speaker.slug && handles && handles[x.speaker.slug]) || x.speaker.handle || '' }) }));
}

async function publicState() {
  return memoised('state', async () => {
    const cfg = await readCfg();
    const [hflat] = await run([['HGETALL', K('handles')]]);
    const handles = toObj(hflat);
    const list = sessionList(cfg.sess);
    const idx = list.findIndex((s) => s.id === cfg.session);
    const out = {
      v: cfg.ver, t: now(), rehearsal: cfg.rehearsal, takeover: cfg.takeover,
      now: idx >= 0 ? sessionView(list[idx], handles) : null,
      next: sessionView(list[idx >= 0 ? idx + 1 : 0], handles),
      activity: { type: 'none' }, quotes: []
    };
    if (idx >= 0) out.quotes = await officialQuotes(list[idx].id, handles);
    const act = cfg.activity || { type: 'none' };
    if (act.type === 'cloud' && CLOUDS[act.id]) {
      out.activity = { type: 'cloud', id: act.id, movement: CLOUDS[act.id].movement, accent: CLOUDS[act.id].accent, prompt: cfg.prompts[act.id], limit: LIMITS.wordsPerDevice };
    } else if (act.type === 'qa' && act.id) {
      const [qs, qv] = await run([['HGETALL', K('qs:' + act.id)], ['HGETALL', K('qv:' + act.id)]]);
      const s = list.find((x) => x.id === act.id);
      out.activity = { type: 'qa', id: act.id, title: s ? s.title : '', questions: questionList(qs, qv, true).slice(0, 30).map(pubQuestion) };
    } else if (act.type === 'poll' && act.id) {
      const [pj] = await run([['HGET', K('polls'), act.id]]);
      const poll = jp(pj, null);
      out.activity = poll ? { type: 'poll', poll: await pollView(poll) } : { type: 'none' };
    } else if (act.type === 'wall') {
      out.activity = { type: 'wall', prompt: 'What are you building?', line: LIMITS.line };
    }
    return out;
  });
}

/* the whole programme plus every published official quote, for the quote card maker (loaded only when it opens) */
async function sessionsState() {
  return memoised('sessions', async () => {
    const cfg = await readCfg();
    const [hflat, q] = await run([['HGETALL', K('handles')], ['HGETALL', K('quotes')]]);
    const handles = toObj(hflat);
    const list = sessionList(cfg.sess);
    const quotes = Object.values(toObj(q)).map((j) => jp(j, null)).filter((x) => x && x.published && (!x.sponsor || x.approved)).sort((a, b) => a.ts - b.ts)
      .map((x) => ({ id: x.id, text: x.text, session: x.session, speaker: Object.assign({}, x.speaker, { handle: (x.speaker.slug && handles[x.speaker.slug]) || '' }) }));
    return { v: cfg.ver, current: cfg.session, rehearsal: cfg.rehearsal, sessions: list.map((s) => sessionView(s, handles)), quotes };
  });
}

async function screenState() {
  return memoised('screen', async () => {
    const cfg = await readCfg();
    const [hflat] = await run([['HGETALL', K('handles')]]);
    const handles = toObj(hflat);
    const list = sessionList(cfg.sess);
    const cur = list.find((s) => s.id === cfg.session);
    const out = { v: cfg.ver, t: now(), rehearsal: cfg.rehearsal, takeover: cfg.takeover, mode: 'holding', session: sessionView(cur, handles) };
    const scr = cfg.screen || { mode: 'follow' };
    const act = cfg.activity || { type: 'none' };
    let mode = scr.mode;
    if (mode === 'follow') mode = act.type === 'none' ? 'holding' : act.type;
    const words = async (id) => {
      const [wc, wd] = await run([['ZREVRANGE', K('wc:' + id), '0', '79', 'WITHSCORES'], ['HGETALL', K('wcd:' + id)]]);
      const disp = toObj(wd); const o = [];
      for (let i = 0; wc && i < wc.length; i += 2) o.push({ w: disp[wc[i]] || display(wc[i]), n: Number(wc[i + 1]) });
      return o;
    };
    if (mode === 'cloud' && CLOUDS[act.id || scr.id]) {
      const id = act.type === 'cloud' ? act.id : scr.id;
      out.mode = 'cloud'; out.cloud = { id, movement: CLOUDS[id].movement, accent: CLOUDS[id].accent, prompt: cfg.prompts[id], words: await words(id) };
    } else if (mode === 'finale') {
      out.mode = 'finale';
      out.clouds = [];
      for (const id of Object.keys(CLOUDS)) out.clouds.push({ id, movement: CLOUDS[id].movement, accent: CLOUDS[id].accent, prompt: cfg.prompts[id], words: await words(id) });
    } else if (mode === 'qa' || mode === 'interview') {
      const sid = act.type === 'qa' ? act.id : (scr.id || cfg.session);
      const [qs, qv] = await run([['HGETALL', K('qs:' + sid)], ['HGETALL', K('qv:' + sid)]]);
      const qsl = questionList(qs, qv, true).filter((q) => !q.answered);
      out.mode = mode; out.title = (list.find((x) => x.id === sid) || {}).title || '';
      out.questions = qsl.slice(0, mode === 'interview' ? 3 : 8).map(pubQuestion);
    } else if (mode === 'poll') {
      const pid = act.type === 'poll' ? act.id : scr.id;
      const [pj] = await run([['HGET', K('polls'), pid]]);
      const poll = jp(pj, null);
      if (poll) {
        out.mode = 'poll'; out.poll = await pollView(poll, !!scr.results);
        if (poll.pair && poll.pair.role === 'after' && (poll.show || scr.results)) {
          const [bj] = await run([['HGET', K('polls'), poll.pair.with]]);
          const before = jp(bj, null);
          if (before) { out.before = await pollView(before, true); out.swing = await swingView(before, poll); }
        }
      }
    } else if (mode === 'wall') {
      const [w] = await run([['HGETALL', K('wall')]]);
      out.mode = 'wall';
      out.wall = Object.values(toObj(w)).map((j) => jp(j, null)).filter((x) => x && x.status === 'approved').sort((a, b) => a.ts - b.ts).slice(-120).map((x) => ({ name: x.name, line: x.line }));
    } else if (mode === 'takeaways') {
      const [t] = await run([['HGETALL', K('tk')]]);
      out.mode = 'takeaways';
      out.takeaways = Object.values(toObj(t)).map((j) => jp(j, null)).filter((x) => x && x.status === 'screen').sort((a, b) => b.ts - a.ts).slice(0, 12).map((x) => ({ text: x.text, name: x.name }));
    } else if (mode === 'quote') {
      const [q] = await run([['HGET', K('quotes'), scr.id || '']]);
      const quote = jp(q, null);
      if (quote && quote.published && (!quote.sponsor || quote.approved)) {
        out.mode = 'quote'; out.quote = { text: quote.text, speaker: quote.speaker, session: quote.session };
      }
    }
    return out;
  });
}

module.exports = { P, K, KEEP, KEEP_WALL, EVENT_END, COLOURS, MOVEMENTS, CLOUDS, FORMATS, LIMITS, DATA, PEOPLE, run, toObj, jp, now, clean, hashDevice, validDevice, rateOk, bump, bumpCfg, readCfgCached,
  blocklist, hits, isClean, squash, tokens, normaliseWord, display, personView, sessionList, sessionView, baseSessions, readCfg, cfgSet, questionList, pubQuestion,
  pollView, swingView, officialQuotes, publicState, screenState, sessionsState, store };
