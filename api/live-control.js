/* /api/live-control — the DMC Live operator panel's API (team login: ADMIN_USER / ADMIN_PASSWORD, shared with /admin and /studio).
     GET  ?view=state          everything the panel shows (sessions, activity, queues, quotes, counters)
     GET  ?view=tki&id=t12     the small preview image of one takeaway card (kept out of the state so it stays light)
     GET  ?export=all|wall|questions|words|polls|takeaways|quotes|analytics    CSV
     POST { op, ... }          one operator action (see OPS below)
   Every action that changes what phones or screens show bumps the "ver" counter, so they update within a couple of seconds. */
'use strict';

const live = require('./_live');
const { requireAuth } = require('./_auth');

const { K, run, toObj, jp, clean, LIMITS, CLOUDS } = live;
const SCREEN_MODES = ['follow', 'holding', 'finale', 'interview', 'takeaways', 'wall', 'quote', 'qa', 'poll', 'cloud'];
const ACTIVITY_TYPES = ['none', 'cloud', 'qa', 'poll', 'wall'];
const fail = (res, error, status) => res.status(status || 400).json({ error });

/* ---- helpers ---- */
const all = async (key) => Object.values(toObj((await run([['HGETALL', K(key)]]))[0])).map((j) => jp(j, null)).filter(Boolean);
async function sessions(cfg) { return live.sessionList((cfg || await live.readCfg()).sess); }
async function saveSess(sess) { await run([live.cfgSet('sess', sess), ...live.bumpCfg()]); }
function cell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const csv = (head, rows) => [head.join(',')].concat(rows.map((r) => head.map((h) => cell(r[h])).join(','))).join('\r\n') + '\r\n';
const iso = (t) => (t ? new Date(Number(t)).toISOString() : '');

/* ---- the panel's view of everything ----
   The heavy part (programme, queues, polls, quotes) is rebuilt only when the "ver" counter has moved, once per server instance; each poll
   otherwise costs five cheap reads (the counters and the clicks), so two operators polling every few seconds stay well inside the store's command budget. */
let heavy = { key: '', value: null };
async function controlHeavy(ver) {
  if (heavy.value && heavy.key === ver) return heavy.value;
  const cfg = await live.readCfg();
  const [hflat, blocked, flag, qsess] = await run([['HGETALL', K('handles')], ['SMEMBERS', K('blocked')], ['HGETALL', K('flag')], ['SMEMBERS', K('qsess')]]);
  const handles = toObj(hflat);
  const list = live.sessionList(cfg.sess);
  const cur = list.find((s) => s.id === cfg.session);
  const hasQs = new Set(qsess || []);
  const [polls, quotes, wall, tk, qsAll] = await Promise.all([all('polls'), all('quotes'), all('wall'), all('tk'),
    Promise.all(list.filter((s) => hasQs.has(s.id)).map(async (s) => { const [qs, qv] = await run([['HGETALL', K('qs:' + s.id)], ['HGETALL', K('qv:' + s.id)]]); return live.questionList(qs, qv, false).map((q) => Object.assign({}, q, { s: s.id })); }))]);
  const pollsOut = [];
  for (const p of polls.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))) pollsOut.push(Object.assign({}, p, await live.pollView(p, true)));
  const questions = [].concat(...qsAll);
  const value = {
    v: cfg.ver, rehearsal: cfg.rehearsal,
    session: cfg.session, now: live.sessionView(cur, handles), activity: cfg.activity, screen: cfg.screen, prompts: cfg.prompts, takeover: cfg.takeover,
    sessions: list.map((s) => Object.assign(live.sessionView(s, handles), { custom: !!s.custom, hidden: !!s.hidden, badge: s.badge })),
    clouds: Object.values(CLOUDS), formats: live.FORMATS, movements: Object.keys(live.MOVEMENTS),
    people: live.DATA.people.map((p) => ({ slug: p.slug, name: p.name, title: p.title, company: p.company, sponsor: p.sponsor || '', photo: p.photo ? '/assets/speakers/' + p.photo : '', handle: handles[p.slug] || '' })),
    polls: pollsOut,
    questions: questions.map((q) => ({ id: q.id, s: q.s, text: q.text, name: q.name, status: q.status, pinned: !!q.pinned, answered: !!q.answered, flagged: !!q.flagged, votes: q.votes, ts: q.ts })),
    wall: wall.sort((a, b) => a.ts - b.ts).map((w) => ({ id: w.id, name: w.name, line: w.line, status: w.status, flagged: !!w.flagged, optin: !!w.optin, hasContact: !!w.contact, ts: w.ts })),
    takeaways: tk.sort((a, b) => b.ts - a.ts).map((t) => ({ id: t.id, session: t.session, text: t.text, name: t.name, status: t.status, flagged: !!t.flagged, ts: t.ts })),
    quotes: quotes.sort((a, b) => a.ts - b.ts),
    flagged: Object.values(toObj(flag)).map((j) => jp(j, null)).filter(Boolean).sort((a, b) => b.ts - a.ts),
    blocked: blocked || []
  };
  heavy = { key: ver, value };
  return value;
}
async function controlState() {
  const [ver, cnt, hb, an] = await run([['GET', K('ver')], ['HGETALL', K('cnt')], ['ZCOUNT', K('hb'), String(Date.now() - 180000), '+inf'], ['HGETALL', K('an')]]);
  const base = await controlHeavy(String(ver || 0));
  const links = await live.store.combos().catch(() => []);
  const clicks = {};
  links.filter((c) => c.kind === 'cl' && c.source === 'livequote').forEach((c) => { clicks[c.ref + '|' + c.campaign] = (clicks[c.ref + '|' + c.campaign] || 0) + c.n; });
  const anObj = toObj(an);
  const analytics = {};
  Object.keys(anObj).forEach((k) => { const [kind, s, ct] = k.split('|'); const key = s + '|' + ct; analytics[key] = analytics[key] || { session: s, ct, made: 0, shared: 0, saved: 0, clicks: 0 }; analytics[key][kind] = Number(anObj[k]); });
  Object.keys(clicks).forEach((key) => { const [s, ct] = key.split('|'); analytics[key] = analytics[key] || { session: s, ct, made: 0, shared: 0, saved: 0, clicks: 0 }; analytics[key].clicks = clicks[key]; });
  const counters = toObj(cnt);
  return Object.assign({}, base, {
    t: Date.now(),
    counters: { connected: Number(hb) || 0, words: Number(counters.words) || 0, questions: Number(counters.questions) || 0, qvotes: Number(counters.qvotes) || 0, pollvotes: Number(counters.pollvotes) || 0,
      wall: Number(counters.wall) || 0, takeaways: Number(counters.takeaways) || 0,
      cardsMade: Object.values(analytics).reduce((a, x) => a + x.made, 0), cardsShared: Object.values(analytics).reduce((a, x) => a + x.shared, 0), clicks: Object.values(analytics).reduce((a, x) => a + x.clicks, 0) },
    analytics: Object.values(analytics)
  });
}

/* ---- CSV exports ---- */
async function exportCsv(what) {
  const cfg = await live.readCfg();
  const list = live.sessionList(cfg.sess);
  const title = (id) => (list.find((s) => s.id === id) || {}).title || id;
  const sections = {};
  sections.wall = async () => csv(['id', 'time', 'name', 'what_they_are_building', 'status', 'optin_contact', 'contact'],
    (await all('wall')).sort((a, b) => a.ts - b.ts).map((w) => ({ id: w.id, time: iso(w.ts), name: w.name, what_they_are_building: w.line, status: w.status, optin_contact: w.optin ? 'yes' : 'no', contact: w.optin ? w.contact : '' })));
  sections.questions = async () => {
    const rows = [];
    for (const s of list) {
      const [qs, qv] = await run([['HGETALL', K('qs:' + s.id)], ['HGETALL', K('qv:' + s.id)]]);
      live.questionList(qs, qv, false).forEach((q) => rows.push({ id: q.id, session: s.id, session_title: s.title, time: iso(q.ts), name: q.name, question: q.text, status: q.status, pinned: q.pinned ? 'yes' : '', answered: q.answered ? 'yes' : '', votes: q.votes }));
    }
    return csv(['id', 'session', 'session_title', 'time', 'name', 'question', 'status', 'pinned', 'answered', 'votes'], rows);
  };
  sections.words = async () => {
    const rows = [];
    for (const id of Object.keys(CLOUDS)) {
      const [wc, wd] = await run([['ZREVRANGE', K('wc:' + id), '0', '-1', 'WITHSCORES'], ['HGETALL', K('wcd:' + id)]]);
      const d = toObj(wd);
      for (let i = 0; wc && i < wc.length; i += 2) rows.push({ cloud: CLOUDS[id].movement, word: d[wc[i]] || wc[i], count: wc[i + 1] });
    }
    return csv(['cloud', 'word', 'count'], rows);
  };
  sections.polls = async () => {
    const rows = [];
    for (const p of await all('polls')) {
      const v = await live.pollView(p, true);
      v.options.forEach((o, i) => rows.push({ poll: p.id, question: p.question, role: v.role, option: o, votes: v.counts[i], total: v.total }));
    }
    return csv(['poll', 'question', 'role', 'option', 'votes', 'total'], rows);
  };
  sections.takeaways = async () => csv(['id', 'time', 'session', 'session_title', 'first_name', 'takeaway', 'status'],
    (await all('tk')).sort((a, b) => a.ts - b.ts).map((t) => ({ id: t.id, time: iso(t.ts), session: t.session, session_title: title(t.session), first_name: t.name, takeaway: t.text, status: t.status })));
  sections.quotes = async () => csv(['id', 'session', 'session_title', 'speaker', 'quote', 'sponsor', 'sponsor_approved', 'published'],
    (await all('quotes')).sort((a, b) => a.ts - b.ts).map((q) => ({ id: q.id, session: q.session, session_title: title(q.session), speaker: q.speaker.name, quote: q.text, sponsor: q.sponsor || '', sponsor_approved: q.sponsor ? (q.approved ? 'yes' : 'no') : '', published: q.published ? 'yes' : 'no' })));
  sections.analytics = async () => { const st = await controlState(); return csv(['session', 'session_title', 'card_type', 'made', 'shared', 'saved', 'link_clicks'], st.analytics.map((a) => ({ session: a.session, session_title: title(a.session), card_type: a.ct, made: a.made, shared: a.shared, saved: a.saved, link_clicks: a.clicks }))); };
  if (what === 'all') {
    let out = '';
    for (const k of Object.keys(sections)) out += '# ' + k + '\r\n' + (await sections[k]()) + '\r\n';
    return out;
  }
  return sections[what] ? sections[what]() : null;
}

/* ---- operator actions ---- */
const OPS = {
  async 'session.set'(b) {
    const cfg = await live.readCfg();
    const list = live.sessionList(cfg.sess);
    if (!list.some((s) => s.id === b.id)) throw new Error('unknown session');
    const cmds = [live.cfgSet('session', b.id)];
    if (cfg.activity && cfg.activity.type === 'qa') cmds.push(live.cfgSet('activity', { type: 'none', since: Date.now() })); /* each session has its own Q&A */
    await run(cmds.concat(live.bumpCfg()));
  },
  async 'session.step'(b) {
    const cfg = await live.readCfg();
    const list = live.sessionList(cfg.sess);
    const i = list.findIndex((s) => s.id === cfg.session);
    const j = Math.max(0, Math.min(list.length - 1, i + (b.dir < 0 ? -1 : 1)));
    return OPS['session.set']({ id: list[j].id });
  },
  async 'session.add'(b) {
    const title = clean(b.title, 90);
    if (!title) throw new Error('title needed');
    const cfg = await live.readCfg();
    const sess = cfg.sess || {};
    const [seq] = await run([['INCR', K('cseq')]]);
    const id = 'c' + seq;
    const list = live.sessionList(sess);
    const entry = { id, title, format: live.FORMATS.indexOf(b.format) >= 0 ? b.format : 'Other', movement: live.MOVEMENTS[b.movement] ? b.movement : '', start: clean(b.start, 8), end: clean(b.end, 8),
      people: (Array.isArray(b.people) ? b.people : []).filter((s) => live.PEOPLE.has(s)), note: clean(b.note, 120) };
    sess.add = (sess.add || []).concat(entry);
    const order = list.map((s) => s.id);
    const at = Math.max(-1, order.indexOf(b.after));
    order.splice(at + 1, 0, id);
    sess.order = order;
    await saveSess(sess);
    return { id };
  },
  async 'session.edit'(b) {
    const cfg = await live.readCfg();
    const sess = cfg.sess || {};
    if (!live.sessionList(sess).some((s) => s.id === b.id)) throw new Error('unknown session');
    const patch = {};
    if (b.title !== undefined) patch.title = clean(b.title, 90);
    if (b.format !== undefined && live.FORMATS.indexOf(b.format) >= 0) patch.format = b.format;
    if (b.movement !== undefined) patch.movement = live.MOVEMENTS[b.movement] ? b.movement : '';
    if (b.people !== undefined) patch.people = (Array.isArray(b.people) ? b.people : []).filter((s) => live.PEOPLE.has(s));
    if (b.hidden !== undefined) patch.hidden = !!b.hidden;
    sess.over = Object.assign({}, sess.over, { [b.id]: Object.assign({}, (sess.over || {})[b.id], patch) });
    await saveSess(sess);
  },
  async 'activity.set'(b) {
    if (ACTIVITY_TYPES.indexOf(b.type) < 0) throw new Error('bad activity');
    const cfg = await live.readCfg();
    let id = b.id || '';
    if (b.type === 'cloud' && !CLOUDS[id]) throw new Error('bad cloud');
    if (b.type === 'qa') { id = id || cfg.session; if (!id) throw new Error('pick a session first'); }
    if (b.type === 'poll') { const [pj] = await run([['HGET', K('polls'), id]]); if (!pj) throw new Error('unknown poll'); }
    await run([live.cfgSet('activity', { type: b.type, id: b.type === 'none' || b.type === 'wall' ? '' : id, since: Date.now() }), ...live.bumpCfg()]);
  },
  async 'screen.set'(b) {
    if (SCREEN_MODES.indexOf(b.mode) < 0) throw new Error('bad screen mode');
    await run([live.cfgSet('screen', { mode: b.mode, id: clean(b.id, 20), results: !!b.results, since: Date.now() }), ...live.bumpCfg()]);
  },
  async 'screen.holding'() { await run([live.cfgSet('screen', { mode: 'holding', since: Date.now() }), ...live.bumpCfg()]); },
  async 'prompt.set'(b) {
    if (!CLOUDS[b.cloud]) throw new Error('bad cloud');
    const cfg = await live.readCfg();
    await run([live.cfgSet('prompts', Object.assign({}, cfg.prompts, { [b.cloud]: clean(b.text, 120) || CLOUDS[b.cloud].prompt })), ...live.bumpCfg()]);
  },
  async 'poll.create'(b) {
    const question = clean(b.question, 140);
    const options = (Array.isArray(b.options) ? b.options : []).map((o) => clean(o, 60)).filter(Boolean);
    if (!question || options.length < 2 || options.length > 5) throw new Error('a question and 2 to 5 options');
    const mk = async (pair) => {
      const [seq] = await run([['INCR', K('pseq')]]);
      return { id: 'p' + seq, question, options, open: false, show: false, pair: pair || null, session: clean(b.session, 24), created: Date.now() };
    };
    const first = await mk(null);
    const out = [first];
    if (b.swing) { const second = await mk({ role: 'after', with: first.id }); first.pair = { role: 'before', with: second.id }; out.push(second); }
    await run(out.map((p) => ['HSET', K('polls'), p.id, JSON.stringify(p)]).concat([['EXPIREAT', K('polls'), String(live.KEEP)]], live.bumpCfg()));
    return { ids: out.map((p) => p.id) };
  },
  async 'poll.set'(b) {
    const [pj] = await run([['HGET', K('polls'), b.id]]);
    const p = jp(pj, null);
    if (!p) throw new Error('unknown poll');
    if (b.open !== undefined) p.open = !!b.open;
    if (b.show !== undefined) p.show = !!b.show;
    await run([['HSET', K('polls'), p.id, JSON.stringify(p)], ...live.bumpCfg()]);
  },
  async 'poll.delete'(b) {
    const [pj] = await run([['HGET', K('polls'), b.id]]);
    const p = jp(pj, null);
    if (!p) return;
    const cmds = [['HDEL', K('polls'), p.id], ['DEL', K('pv:' + p.id)], ['DEL', K('pvd:' + p.id)]];
    const cfg = await live.readCfg();
    if (cfg.activity && cfg.activity.type === 'poll' && cfg.activity.id === p.id) cmds.push(live.cfgSet('activity', { type: 'none', since: Date.now() }));
    await run(cmds.concat(live.bumpCfg()));
  },
  async 'q.moderate'(b) {
    const key = K('qs:' + b.session);
    const [qj] = await run([['HGET', key, b.id]]);
    const q = jp(qj, null);
    if (!q) throw new Error('unknown question');
    const a = b.action;
    if (a === 'delete') { await run([['HDEL', key, q.id], live.bump()]); return; }
    if (a === 'approve') q.status = 'approved'; else if (a === 'reject') { q.status = 'rejected'; q.pinned = false; } else if (a === 'pending') q.status = 'pending';
    else if (a === 'pin') q.pinned = true; else if (a === 'unpin') q.pinned = false; else if (a === 'answered') q.answered = true; else if (a === 'unanswered') q.answered = false;
    else throw new Error('bad action');
    await run([['HSET', key, q.id, JSON.stringify(q)], live.bump()]);
  },
  async 'wall.moderate'(b) {
    const [wj] = await run([['HGET', K('wall'), b.id]]);
    const w = jp(wj, null);
    if (!w) throw new Error('unknown entry');
    if (b.action === 'delete') { await run([['HDEL', K('wall'), w.id], live.bump()]); return; }
    if (b.action === 'approve') w.status = 'approved'; else if (b.action === 'reject') w.status = 'rejected'; else if (b.action === 'pending') w.status = 'pending'; else throw new Error('bad action');
    await run([['HSET', K('wall'), w.id, JSON.stringify(w)], live.bump()]);
  },
  async 'tk.moderate'(b) {
    const [tj] = await run([['HGET', K('tk'), b.id]]);
    const t = jp(tj, null);
    if (!t) throw new Error('unknown takeaway');
    if (b.action === 'delete') { await run([['HDEL', K('tk'), t.id], ['DEL', K('tki:' + t.id)], live.bump()]); return; }
    if (b.action === 'approve') t.status = 'approved'; else if (b.action === 'reject') t.status = 'rejected'; else if (b.action === 'screen') t.status = 'screen';
    else if (b.action === 'unscreen') t.status = 'approved'; else throw new Error('bad action');
    await run([['HSET', K('tk'), t.id, JSON.stringify(t)], live.bump()]);
  },
  async 'quote.save'(b) {
    const text = clean(b.text, LIMITS.quote);
    if (text.length < 5) throw new Error('type the quote');
    const cfg = await live.readCfg();
    if (!live.sessionList(cfg.sess).some((s) => s.id === b.session)) throw new Error('pick a session');
    let speaker;
    if (b.speakerSlug && live.PEOPLE.has(b.speakerSlug)) { const p = live.personView(b.speakerSlug); speaker = { slug: p.slug, name: p.name, title: [p.title, p.company].filter(Boolean).join(', '), photo: p.photo }; }
    else { const name = clean(b.speakerName, 60); if (!name) throw new Error('who said it?'); speaker = { slug: '', name, title: clean(b.speakerTitle, 90), photo: '' }; }
    /* a speaker marked as representing a sponsor in the programme data always needs approval; the operator can also mark anyone else */
    const auto = b.speakerSlug && live.PEOPLE.has(b.speakerSlug) ? live.PEOPLE.get(b.speakerSlug).sponsor || '' : '';
    const sponsor = auto || clean(b.sponsor, 40);
    let q = null;
    if (b.id) { const [qj] = await run([['HGET', K('quotes'), b.id]]); q = jp(qj, null); }
    if (!q) { const [seq] = await run([['INCR', K('qtseq')]]); q = { id: 'o' + seq, ts: Date.now(), published: false, approved: false }; }
    Object.assign(q, { session: b.session, text, speaker, sponsor, by: 'operator' });
    if (q.sponsor && b.id && b.text !== undefined) q.approved = false;   /* an edited sponsor quote needs approving again */
    await run([['HSET', K('quotes'), q.id, JSON.stringify(q)], ['EXPIREAT', K('quotes'), String(live.KEEP)], ...live.bumpCfg()]);
    return { id: q.id };
  },
  async 'quote.flag'(b) {
    const [qj] = await run([['HGET', K('quotes'), b.id]]);
    const q = jp(qj, null);
    if (!q) throw new Error('unknown quote');
    if (b.approved !== undefined) q.approved = !!b.approved;
    if (b.published !== undefined) {
      if (b.published && q.sponsor && !q.approved) throw new Error('This speaker represents ' + q.sponsor + '. Tick “Sponsor-approved” before publishing.');
      q.published = !!b.published;
    }
    if (q.published && q.sponsor && !q.approved) q.published = false;
    await run([['HSET', K('quotes'), q.id, JSON.stringify(q)], ...live.bumpCfg()]);
  },
  async 'quote.delete'(b) { await run([['HDEL', K('quotes'), b.id], ...live.bumpCfg()]); },
  async 'handle.set'(b) {
    if (!live.PEOPLE.has(b.slug)) throw new Error('unknown speaker');
    const h = clean(b.handle, 40).replace(/^@+/, '').replace(/[^A-Za-z0-9_.]/g, '');
    await run([h ? ['HSET', K('handles'), b.slug, '@' + h] : ['HDEL', K('handles'), b.slug], ...live.bumpCfg()]);
  },
  async 'block.add'(b) { const w = clean(b.word, 40).toLowerCase(); if (w) await run([['SADD', K('blocked'), w], live.bump()]); },
  async 'block.remove'(b) { await run([['SREM', K('blocked'), clean(b.word, 40).toLowerCase()], live.bump()]); },
  async 'flag.release'(b) {
    const [fj] = await run([['HGET', K('flag'), b.id]]);
    const f = jp(fj, null);
    if (!f) return;
    await run([['ZINCRBY', K('wc:' + f.cloud), '1', f.norm], ['HSETNX', K('wcd:' + f.cloud), f.norm, live.display(f.norm)], ['HDEL', K('flag'), f.id], live.bump()]);
  },
  async 'flag.dismiss'(b) { await run([['HDEL', K('flag'), b.id], live.bump()]); },
  async 'rehearsal.seed'() { return require('./_live-seed').seed(); },
  async 'reset'(b) {
    if (b.confirm !== 'RESET') throw new Error('type RESET to confirm');
    let cursor = '0'; const keys = [];
    do {
      const [r] = await run([['SCAN', cursor, 'MATCH', K('*'), 'COUNT', '500']]);
      cursor = String(r[0]); (r[1] || []).forEach((k) => { if (k !== K('blocked') && k !== K('handles')) keys.push(k); });
    } while (cursor !== '0');
    for (let i = 0; i < keys.length; i += 100) await run([['DEL'].concat(keys.slice(i, i + 100))]);
    await run([live.cfgSet('rehearsal', ''), ...live.bumpCfg()]);
    return { deleted: keys.length };
  }
};

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res, 'DMC Live control')) return;
  if (!live.store.configured()) return fail(res, 'The store is not configured (KV_REST_API_URL / KV_REST_API_TOKEN).', 503);
  try {
    if (req.method === 'GET') {
      const q = req.query || {};
      if (q.export) {
        const body = await exportCsv(String(q.export));
        if (body === null) return fail(res, 'unknown export', 404);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="dmc-live-' + String(q.export).replace(/[^a-z]/g, '') + '.csv"');
        return res.status(200).send(body);
      }
      if (q.view === 'tki') {
        if (!/^t\d{1,9}$/.test(String(q.id))) return fail(res, 'bad id');
        const [img] = await run([['GET', K('tki:' + q.id)]]);
        return res.status(200).json({ img: img || '' });
      }
      return res.status(200).json(await controlState());
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return fail(res, 'method', 405); }
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const op = OPS[String(b.op)];
    if (!op) return fail(res, 'unknown action');
    const out = await op(b);
    return res.status(200).json(Object.assign({ ok: true }, out || {}));
  } catch (e) {
    console.error('live control error', e && e.message);
    return fail(res, e && e.message ? e.message : 'failed', 400);
  }
};
