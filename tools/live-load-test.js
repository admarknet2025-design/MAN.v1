/* DMC Live load test: a room of phones, two projector screens and two operators, for as long as you like.
     node tools/live-load-test.js --base http://localhost:4180 --devices 250 --minutes 10 [--stats http://localhost:4175/__stats]
   Needs ADMIN_USER / ADMIN_PASSWORD in the environment (the operators log in). It writes to whatever store the target uses, so point it at a
   local or rehearsal setup (and press "Reset" in /live/control afterwards), never at the live event.
   Each simulated phone polls every 2 s like the real page, sends a heartbeat every 2 minutes, and takes part in the programme the script runs:
   three word clouds, a Q&A, a before/after poll, the Build Wall, and quote cards (link, event and a takeaway preview for moderation). The operators
   run the programme, approve what is waiting, and send takeaways to the screen. Reports: requests, errors, latency per endpoint, how long phones
   took to see each operator action, and (with --stats, the fake store's counter) Redis commands per minute and the projection for a whole event day. */
'use strict';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://localhost:4180').replace(/\/$/, '');
const IDLE = process.argv.indexOf('--idle') > 0;   /* phones only poll and send heartbeats: the cost of an audience doing nothing */
const N = Number(arg('devices', 250)), MIN = Number(arg('minutes', 10)), STATS = arg('stats', '');
if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD) { console.error('Set ADMIN_USER and ADMIN_PASSWORD (the team login of the site under test).'); process.exit(2); }
const AUTH = 'Basic ' + Buffer.from(process.env.ADMIN_USER + ':' + process.env.ADMIN_PASSWORD).toString('base64');
const T0 = Date.now(), END = T0 + MIN * 60000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const lat = {}, codes = {};
let reqs = 0;
async function call(label, url, opts) {
  const t = Date.now(); reqs++;
  try {
    const r = await fetch(BASE + url, opts);
    const text = await r.text();
    (lat[label] = lat[label] || []).push(Date.now() - t);
    const k = label + ' ' + r.status; codes[k] = (codes[k] || 0) + 1;
    let j = null; try { j = JSON.parse(text); } catch (e) { /* not json */ }
    return { status: r.status, json: j };
  } catch (e) { const k = label + ' NETWORK'; codes[k] = (codes[k] || 0) + 1; return { status: 0, json: null }; }
}
const post = (label, path, body, auth) => call(label, path, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, auth ? { authorization: AUTH } : {}), body: JSON.stringify(body) });
const maxOf = (a) => a.reduce((m, x) => (x > m ? x : m), 0);
const q = (a, p) => { if (!a || !a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

/* ---- operator actions, with propagation timing ---- */
const pending = [];   /* { v, t0, lags: [] } */
async function op(body) {
  const t0 = Date.now();
  const r = await post('control op', '/api/live-control', body, true);
  const st = await call('control state', '/api/live-control?view=state', { headers: { authorization: AUTH } });
  if (st.json && st.json.v != null) pending.push({ v: st.json.v, t0, lags: [], kind: body.op });
  return r.json || {};
}

/* ---- the phones ---- */
const WORDS = ['trust', 'fear', 'time', 'money', 'clarity', 'focus', 'launch', 'impact', 'scale', 'ownership', 'curious', 'kind', 'burnout', 'doubt', 'profit', 'product', 'reach', 'honest', 'hungry', 'confidence'];
const QS = ['How do you decide which channel deserves budget first?', 'What is one metric you would stop reporting?', 'How small can a team be before it breaks?', 'Where does AI help most today?', 'How do you keep a team honest about results?'];
let phase = { name: 'start', activity: { type: 'none' } };
const room = { words: {}, qids: [], pollIds: [], cards: 0 };
const PREVIEW = 'data:image/jpeg;base64,' + 'A'.repeat(18000);
const seenV = [];

async function phoneLoop(i) {
  const d = 'ld' + String(i).padStart(8, '0') + 'xyz';
  const st = { v: -1, words: 0, asked: false, voted: new Set(), poll: new Set(), wall: false, cards: 0 };
  await sleep(Math.random() * 6000);                     /* people arrive over a few seconds */
  let nextBeat = Date.now() + Math.random() * 120000;
  while (Date.now() < END) {
    const r = await call('phone poll', '/api/live-state');
    const now = Date.now();
    const s = r.json;
    if (s && s.v != null) {
      if (s.v !== st.v) { pending.forEach((p) => { if (s.v >= p.v && !(p.seen || (p.seen = new Set())).has(i)) { p.seen.add(i); p.lags.push(now - p.t0); } }); st.v = s.v; }
      const a = s.activity || {};
      if (IDLE) { /* nothing to do */ } else {
      /* respond a little after seeing the prompt, like a person */
      if (a.type === 'cloud' && st.words < 3 && Math.random() < 0.5) { st.words++; post('word', '/api/live-submit', { t: 'word', d, k: 'k' + i + '-' + now, cloud: a.id, text: rnd(WORDS) }); }
      if (a.type === 'qa' && !st.asked && Math.random() < 0.12) { st.asked = true; post('question', '/api/live-submit', { t: 'q', d, k: 'q' + i + '-' + now, session: phase.session, text: rnd(QS), name: 'Dev' + i }); }
      if (a.type === 'qa' && a.questions && a.questions.length && Math.random() < 0.15) { const qq = rnd(a.questions); if (!st.voted.has(qq.id)) { st.voted.add(qq.id); post('upvote', '/api/live-submit', { t: 'qv', d, k: 'v' + i + '-' + qq.id + '-' + now, session: phase.session, id: qq.id }); } }
      if (a.type === 'poll' && a.poll && a.poll.open && !st.poll.has(a.poll.id) && Math.random() < 0.6) { st.poll.add(a.poll.id); post('poll vote', '/api/live-submit', { t: 'pv', d, k: 'p' + i + '-' + a.poll.id + '-' + now, poll: a.poll.id, opt: Math.floor(Math.random() * a.poll.options.length) }); }
      if (a.type === 'wall' && !st.wall && Math.random() < 0.15) { st.wall = true; post('wall', '/api/live-submit', { t: 'wall', d, k: 'w' + i + '-' + now, name: 'Dev' + i, line: 'Building something for Ghana number ' + i, optin: false }); }
      /* quote cards: link, a takeaway for moderation, and the event counters */
      if (phase.cards && st.cards < 2 && Math.random() < 0.02) {
        st.cards++; room.cards++;
        post('card link', '/api/live-submit', { t: 'link', d, session: phase.session, ct: 'takeaway' });
        post('card takeaway', '/api/live-submit', { t: 'tk', d, k: 't' + i + '-' + now, session: phase.session, text: 'My takeaway number ' + i + ' from this session', name: 'Dev', img: PREVIEW });
        post('card event', '/api/live-submit', { t: 'ev', d, k: 'e' + i + '-' + now, e: 'saved', session: phase.session, ct: 'takeaway' });
      }
      }
    }
    if (now > nextBeat) { nextBeat = now + 120000; post('heartbeat', '/api/live-submit', { t: 'hb', d }); }
    await sleep(2000 + Math.random() * 400);
  }
}
async function screenLoop() { while (Date.now() < END) { await call('screen poll', '/api/live-state?view=screen'); await sleep(2000 + Math.random() * 200); } }
async function operatorLoop(primary) {
  while (Date.now() < END) {
    const st = await call('control state', '/api/live-control?view=state', { headers: { authorization: AUTH } });
    if (primary && st.json) {
      const s = st.json;
      for (const x of (s.questions || []).filter((x) => x.status === 'pending' && !x.flagged).slice(0, 10)) await op({ op: 'q.moderate', session: x.s, id: x.id, action: 'approve' });
      for (const x of (s.wall || []).filter((x) => x.status === 'pending' && !x.flagged).slice(0, 10)) await op({ op: 'wall.moderate', id: x.id, action: 'approve' });
      for (const x of (s.takeaways || []).filter((x) => x.status === 'pending' && !x.flagged).slice(0, 6)) await op({ op: 'tk.moderate', id: x.id, action: Math.random() < 0.3 ? 'screen' : 'approve' });
    }
    await sleep(2500);
  }
}

(async () => {
  console.log('DMC Live load test: ' + N + ' phones, 2 screens, 2 operators, ' + MIN + ' min against ' + BASE);
  if (STATS) await fetch(STATS.replace('__stats', '__reset')).catch(() => {});
  const ok = await post('control op', '/api/live-control', { op: 'reset', confirm: 'RESET' }, true);
  if (!ok.json || !ok.json.ok) { console.error('operator login failed or store unavailable', ok); process.exit(1); }
  const poll = await op({ op: 'poll.create', question: 'Who owns growth?', options: ['Marketing', 'Product', 'Founder', 'Nobody'], swing: true });
  await op({ op: 'session.set', id: 's04' });
  const quote = await op({ op: 'quote.save', session: 's04', text: 'Distribution is a product feature.', speakerName: 'Test Speaker', speakerTitle: 'Founder' });
  if (quote.id) await op({ op: 'quote.flag', id: quote.id, published: true });
  phase.session = 's04';

  /* the programme, spread over the run */
  const steps = [['cloud', 'yourself'], ['cloud', 'team'], ['cloud', 'work'], ['qa'], ['poll', poll.ids && poll.ids[0]], ['poll', poll.ids && poll.ids[1]], ['wall'], ['none']];
  const slice = (MIN * 60000) / steps.length;
  const runProgramme = async () => {
    for (let k = 0; k < steps.length && Date.now() < END; k++) {
      const [type, id] = steps[k];
      if (type === 'poll') await op({ op: 'poll.set', id, open: true, show: true });
      if (type === 'qa') await op({ op: 'session.set', id: 's04' });   /* moving to a session ends its Q&A, so pick the session first */
      await op({ op: 'activity.set', type, id });
      if (type === 'poll') await op({ op: 'screen.set', mode: 'poll', id, results: true }); else await op({ op: 'screen.set', mode: 'follow' });
      phase.cards = k >= 2;
      await sleep(slice);
      if (type === 'poll') await op({ op: 'poll.set', id, open: false });
    }
  };
  const ticker = setInterval(() => { const m = Math.round((Date.now() - T0) / 60000); process.stdout.write('  ' + m + ' min, ' + reqs + ' requests\r'); }, 15000);
  const work = [IDLE ? sleep(MIN * 60000) : runProgramme(), screenLoop(), screenLoop(), operatorLoop(true), operatorLoop(false)];
  for (let i = 0; i < N; i++) work.push(phoneLoop(i));
  await Promise.all(work); clearInterval(ticker);
  await sleep(1500);

  const dur = (Date.now() - T0) / 1000;
  console.log('\n=== Results ===');
  console.log('Duration ' + dur.toFixed(0) + ' s, ' + reqs + ' requests (' + (reqs / dur).toFixed(1) + ' per second)');
  console.log('\nLatency (ms)          n      p50    p95    p99    max');
  Object.keys(lat).sort().forEach((k) => console.log(k.padEnd(18) + String(lat[k].length).padStart(7) + String(q(lat[k], .5)).padStart(8) + String(q(lat[k], .95)).padStart(7) + String(q(lat[k], .99)).padStart(7) + String(maxOf(lat[k])).padStart(7)));
  const bad = Object.keys(codes).filter((k) => !/ (200|409|429)$/.test(k));
  console.log('\nResponses: ' + Object.keys(codes).sort().map((k) => k + '=' + codes[k]).join(', '));
  console.log(bad.length ? 'NON-OK RESPONSES: ' + bad.map((k) => k + '=' + codes[k]).join(', ') : 'Every request answered 200, or an intended 409 (activity already closed) or 429 (per-device limit).');
  const lags = pending.reduce((a, p) => a.concat(p.lags), []);
  const seenAll = pending.filter((p) => p.lags.length >= N * 0.95);
  console.log('\nHow long phones took to show an operator action (' + pending.length + ' actions, ' + lags.length + ' observations):');
  console.log('  p50 ' + q(lags, .5) + ' ms, p95 ' + q(lags, .95) + ' ms, p99 ' + q(lags, .99) + ' ms, max ' + maxOf(lags) + ' ms');
  console.log('  ' + seenAll.length + '/' + pending.length + ' actions reached 95% of phones; target: within 3000 ms for most phones' + (q(lags, .95) <= 3000 ? ' (met at p95)' : ' (NOT met at p95)'));
  if (STATS) {
    const s = await (await fetch(STATS)).json();
    console.log('\nRedis (store counter): ' + s.commands + ' commands in ' + s.requests + ' round trips over ' + (dur / 60).toFixed(1) + ' min = ' + (s.commands / (dur / 60)).toFixed(0) + ' commands/min with ' + N + ' phones');
    console.log('Projected for a 5-hour event day at this load: ' + Math.round(s.commands / (dur / 60) * 300 / 1000) + 'k commands (Upstash free plan: 500k per month)');
    console.log('By command: ' + Object.keys(s.byCmd).sort((a, b) => s.byCmd[b] - s.byCmd[a]).slice(0, 8).map((k) => k + ' ' + s.byCmd[k]).join(', '));
  }
  process.exit(bad.length ? 1 : 0);
})();
