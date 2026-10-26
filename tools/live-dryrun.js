/* DMC Live dry run: all six features through the real phone page, projector page and operator panel (plus the card maker, the sponsor rule, moderation and the CSV exports), with screenshots in $SHOTS (default ./live-shots).
     BASE=http://localhost:4180 ADMIN_USER=... ADMIN_PASSWORD=... node tools/live-dryrun.js
   Needs Playwright (npm i --no-save playwright) and a running copy of the site (Vercel dev, a preview, or a local server) whose store is a
   rehearsal or local one: it presses "Reset everything" first. Never run it against the live event. */
'use strict';
const ENV_USER = process.env.ADMIN_USER, ENV_PASS = process.env.ADMIN_PASSWORD;
if (!ENV_USER || !ENV_PASS) { console.error('Set ADMIN_USER and ADMIN_PASSWORD (the team login of the site under test).'); process.exit(2); }
const { chromium } = require('playwright');
const fs = require('fs'); const SHOTS = process.env.SHOTS || 'live-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const B = (process.env.BASE || 'http://localhost:4180').replace(/\/$/, ''), AUTH = 'Basic ' + Buffer.from(ENV_USER + ':' + ENV_PASS).toString('base64');
const J = (r) => r.json().catch(() => ({}));
const api = (op) => fetch(B + '/api/live-control', { method: 'POST', headers: { 'content-type': 'application/json', authorization: AUTH }, body: JSON.stringify(op) }).then(J);
const state = () => fetch(B + '/api/live-control?view=state&fresh=1', { headers: { authorization: AUTH } }).then(J);
const sub = (d, body) => fetch(B + '/api/live-submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ d, k: Math.random().toString(36).slice(2, 12) }, body)) }).then(async (r) => ({ status: r.status, ...(await J(r)) }));
const dev = (n) => 'dev' + String(n).padStart(6, '0') + 'abcd';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = []; const ok = (name, cond, extra) => { checks.push([name, !!cond]); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(extra || ''))); };
const edge = async () => (await fetch(B + '/api/live-state?bust=' + Math.random())).json();
(async () => {
  const b = await chromium.launch();
  const mk = async (name, opts) => { const c = await b.newContext(opts); const p = await c.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(name + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(name + ': ' + m.text()); }); return p; };
  const phone = await mk('phone', { viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, acceptDownloads: true, hasTouch: true, isMobile: true });
  const screen = await mk('screen', { viewport: { width: 1920, height: 1080 } });
  const ctl = await mk('control', { viewport: { width: 1280, height: 900 }, httpCredentials: { username: ENV_USER, password: ENV_PASS } });
  const shot = (p, n) => p.screenshot({ path: SHOTS + '/' + n + '.png' });

  console.log('reset', await api({ op: 'reset', confirm: 'RESET' }));
  await api({ op: 'rehearsal.seed' }); await api({ op: 'reset', confirm: 'RESET' });   // seed then clear: proves reset leaves a clean slate
  let st = await state(); ok('reset leaves nothing', st.polls.length === 0 && st.questions.length === 0 && st.wall.length === 0);
  await phone.goto(B + '/live'); await screen.goto(B + '/live/screen'); await ctl.goto(B + '/live/control'); await sleep(2500);
  await shot(screen, '01-screen-holding'); await shot(phone, '01-phone-start');
  ok('screen holding slide shows join link', (await screen.textContent('body')).includes('mangh.org/live'));
  ok('screen has QR svg', await screen.$('svg[aria-label^="QR"]'));

  /* 1. Now & Next through the real panel */
  await ctl.getByRole('button', { name: /^(start|next session)/i }).click(); await sleep(400);
  st = await state(); ok('control: next session sets first session', st.session === 's01', st.session);
  await api({ op: 'session.set', id: 's04' }); await sleep(2800);
  await shot(phone, '02-phone-now-next'); await shot(ctl, '02-control-run');
  ok('phone shows current session', (await phone.textContent('#now')).includes('Build Yourself: Panel'));
  ok('phone shows next session', (await phone.textContent('#next')).startsWith('Next:'));

  /* 2. word clouds: three movements, 250-ish words from many devices, filter, cap, plurals */
  await api({ op: 'activity.set', type: 'cloud', id: 'yourself' }); await sleep(2800);
  await shot(phone, '03-phone-cloud');
  await phone.fill('#wd', 'Fear'); await phone.click('text=Add my word'); await sleep(300);
  await phone.fill('#wd', 'time management'); await phone.click('text=Add my word'); await phone.fill('#wd', 'Fears'); await phone.click('text=Add my word'); await sleep(800);
  ok('phone: fourth word blocked after three', (await phone.inputValue('#wd')) === '' && await phone.isDisabled('text=Add my word'));
  const words = ['fear', 'fear', 'time', 'time', 'time', 'confidence', 'money', 'money', 'doubt', 'burnout', 'burnout', 'burnout', 'burnout', 'clarity', 'focus', 'fear', 'impostor syndrome', 'f*ck', 'shit'];
  for (let i = 0; i < words.length; i++) await sub(dev(100 + i), { t: 'word', cloud: 'yourself', text: words[i] });
  for (let i = 0; i < 4; i++) { const r = await sub(dev(300), { t: 'word', cloud: 'yourself', text: 'extra' + 'abcd'[i] }); if (i === 3) ok('server: 4th word per device refused', r.status === 429, r); }
  st = await state(); ok('profanity held for review, not shown', st.flagged.length >= 2, st.flagged.length);
  ok('operator counters count responses', st.counters.words > 15, st.counters);
  await sleep(2500);
  const sc = await (await fetch(B + '/api/live-state?view=screen&x=' + Math.random())).json();
  const fear = (sc.cloud.words.find((w) => w.w.toLowerCase() === 'fear') || {}).n;
  ok('plural folded: Fear + Fears counted together (phone 2x + 3 others = 5)', fear === 5, sc.cloud.words);
  ok('flagged words not in cloud', !sc.cloud.words.some((w) => /f.ck|shit/i.test(w.w)));
  await sleep(1500); await shot(screen, '04-screen-cloud-yourself');
  for (const [c, ws] of [['team', ['trust', 'trust', 'trust', 'honest', 'hungry', 'kind', 'kind', 'curious', 'diverse', 'ownership', 'ownership']], ['work', ['impact', 'impact', 'launch', 'launch', 'launch', 'scale', 'scale', 'product', 'profit', 'profit', 'reach']]]) {
    await api({ op: 'activity.set', type: 'cloud', id: c }); await sleep(1500);
    for (let i = 0; i < ws.length; i++) await sub(dev(500 + i), { t: 'word', cloud: c, text: ws[i] });
    await sleep(2500); await shot(screen, '04-screen-cloud-' + c);
  }
  await api({ op: 'screen.set', mode: 'finale' }); await sleep(3500); await shot(screen, '05-screen-finale');
  await api({ op: 'screen.set', mode: 'follow' });
  const closed = await sub(dev(301), { t: 'word', cloud: 'yourself', text: 'late' }); ok('word for a cloud that is not open is refused (409)', closed.status === 409, closed);

  /* 3. Ask the Panel */
  await api({ op: 'activity.set', type: 'qa' }); await sleep(2800);
  await phone.fill('#qt', 'How do you decide which channel deserves budget first?'); await phone.click('text=Send my question'); await sleep(500);
  ok('first name asked once, only when needed (on the first question)', await phone.isVisible('#nd-in'));
  await phone.fill('#nd-in', 'Ama Mensah'); await phone.click('#nd-ok'); await sleep(1200);
  await shot(phone, '06-phone-qa-sent');
  const qs = ['What is one metric you would stop reporting tomorrow?', 'Where does AI help most, and where does it get in the way?', 'You are all useless idiots and this is bullshit', 'How small can a team be before it breaks?'];
  for (let i = 0; i < qs.length; i++) await sub(dev(700 + i), { t: 'q', session: 's04', text: qs[i], name: i === 3 ? 'Anonymous' : 'Kojo' });
  st = await state();
  ok('questions land pending (none shown yet)', st.questions.length === 5 && st.questions.every((q) => q.status === 'pending'));
  ok('a rude question is marked flagged for the operator', st.questions.some((q) => q.flagged && /bullshit/.test(q.text)));
  let pub = await edge(); ok('phones see no unapproved questions', pub.activity.questions.length === 0, pub.activity.questions);
  await ctl.getByRole('button', { name: /^Questions/ }).click(); await sleep(2800); await shot(ctl, '07-control-questions');
  for (const q of st.questions.filter((q) => !q.flagged)) await api({ op: 'q.moderate', session: 's04', id: q.id, action: 'approve' });
  await api({ op: 'q.moderate', session: 's04', id: st.questions.find((q) => q.flagged).id, action: 'reject' });
  const byText = (t) => st.questions.find((q) => q.text.indexOf(t) === 0);
  for (let i = 0; i < 6; i++) await sub(dev(800 + i), { t: 'qv', session: 's04', id: byText('What is one metric').id });
  const dup = await sub(dev(800), { t: 'qv', session: 's04', id: byText('What is one metric').id }); ok('second upvote from the same device does not count', dup.already === true, dup);
  await api({ op: 'q.moderate', session: 's04', id: byText('How small').id, action: 'pin' });
  await sleep(2800); pub = await edge();
  ok('only approved questions show, ranked (pinned first)', pub.activity.questions.length === 4 && pub.activity.questions[0].pinned && pub.activity.questions[1].votes === 6, pub.activity.questions.map((q) => [q.votes, q.pinned]));
  await shot(phone, '08-phone-qa-list');
  await api({ op: 'screen.set', mode: 'qa' }); await sleep(3000); await shot(screen, '08-screen-qa');
  await api({ op: 'screen.set', mode: 'interview' }); await sleep(3000); await shot(screen, '09-screen-interview');
  await api({ op: 'screen.set', mode: 'follow' });
  await api({ op: 'session.set', id: 's06' }); await sleep(2500);
  st = await state(); ok('moving to the next session ends that session\'s Q&A (one per session)', st.activity.type === 'none', st.activity);

  /* 4. polls + swing */
  const r1 = await api({ op: 'poll.create', question: 'Who owns growth in your company?', options: ['Marketing', 'Product', 'The founder', 'Nobody yet'], swing: true, session: 's06' });
  ok('swing creates two linked polls', r1.ids && r1.ids.length === 2, r1);
  const [pb, pa] = r1.ids;
  await api({ op: 'poll.set', id: pb, open: true }); await api({ op: 'activity.set', type: 'poll', id: pb }); await sleep(2800);
  await shot(phone, '10-phone-poll');
  const before = [0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3];
  for (let i = 0; i < before.length; i++) await sub(dev(900 + i), { t: 'pv', poll: pb, opt: before[i] });
  const dupv = await sub(dev(900), { t: 'pv', poll: pb, opt: 1 }); ok('one answer per device per poll', dupv.already === true, dupv);
  await api({ op: 'poll.set', id: pb, show: true }); await sleep(2800); await shot(screen, '11-screen-poll-before');
  await api({ op: 'poll.set', id: pb, open: false });
  await api({ op: 'poll.set', id: pa, open: true }); await api({ op: 'activity.set', type: 'poll', id: pa });
  const after = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 0, 0];   // devices 900..919 answer again: some change their mind
  for (let i = 0; i < after.length; i++) await sub(dev(900 + i), { t: 'pv', poll: pa, opt: after[i] });
  await api({ op: 'poll.set', id: pa, show: true }); await api({ op: 'screen.set', mode: 'poll', id: pa, results: true }); await sleep(3200); await shot(screen, '12-screen-poll-swing');
  const sw = (await (await fetch(B + '/api/live-state?view=screen&y=' + Math.random())).json());
  const changed = before.filter((v, i) => v !== after[i]).length;
  ok('swing: percent changed minds matches per-device truth (' + changed + '/20)', sw.mode === 'poll' && sw.swing && Math.round(sw.swing.changed / sw.swing.both * 100) === Math.round(changed / 20 * 100), sw.swing);
  await api({ op: 'screen.set', mode: 'follow' });

  /* 5. Build Wall */
  await api({ op: 'activity.set', type: 'wall' }); await sleep(2800);
  await phone.fill('#wl', 'A WhatsApp-first invoicing tool for market traders'); await phone.check('#wo'); await phone.fill('#wc', 'ama@example.com');
  await phone.click('text=Put it on the wall'); await sleep(500);
  ok('name not asked again', !(await phone.isVisible('#nd-in'))); await sleep(1200);
  await shot(phone, '13-phone-wall-sent');
  const wl = ['Building a creator payout tool for Ghana', 'Scaling a skincare brand in Kumasi', 'An AI assistant for church admins', 'Growth agency for fintechs', 'This is shit and spam'];
  for (let i = 0; i < wl.length; i++) await sub(dev(1000 + i), { t: 'wall', name: ['Kofi', 'Efua', 'Yaw', 'Nana', 'Troll'][i], line: wl[i], optin: i === 1, contact: i === 1 ? '@efua_builds' : '' });
  st = await state(); ok('wall entries wait for approval', st.wall.length === 6 && st.wall.every((w) => w.status === 'pending'));
  for (const w of st.wall) await api({ op: 'wall.moderate', id: w.id, action: w.flagged ? 'reject' : 'approve' });
  await api({ op: 'screen.set', mode: 'wall' }); await sleep(3200); await shot(screen, '14-screen-wall');
  const csvAll = await (await fetch(B + '/api/live-control?export=wall', { headers: { authorization: AUTH } })).text();
  ok('wall CSV includes opted-in contact only', /ama@example.com/.test(csvAll) && /@efua_builds/.test(csvAll) && !/Kofi.*@/.test(csvAll), csvAll.slice(0, 400));
  await api({ op: 'screen.set', mode: 'follow' }); await api({ op: 'activity.set', type: 'none' });

  /* 6. quote cards */
  await api({ op: 'session.set', id: 's04' });
  st = await state();
  const sponsor = st.people.find((p) => p.sponsor), plain = st.people.find((p) => !p.sponsor && st.sessions.find((s) => s.id === 's04').speakers.some((x) => x.slug === p.slug));
  const q1 = await api({ op: 'quote.save', session: 's04', text: 'We stopped chasing channels and started chasing customers.', speakerSlug: plain.slug });
  const q2 = await api({ op: 'quote.save', session: 's04', text: 'Distribution is a product feature.', speakerSlug: st.sessions.find((s) => s.id === 's04').speakers.find((x) => x.sponsor).slug });
  await api({ op: 'quote.flag', id: q1.id, published: true });
  const blockedPub = await api({ op: 'quote.flag', id: q2.id, published: true });
  ok('sponsor rep quote cannot be published without approval', blockedPub.error && /Sponsor-approved/.test(blockedPub.error), blockedPub);
  await sleep(2800); let ps = await edge();
  ok('phones see only the verified, non-sponsor quote', ps.quotes.length === 1 && ps.quotes[0].id === q1.id, ps.quotes);
  const allq = await (await fetch(B + '/api/live-state?view=sessions&z=' + Math.random())).json();
  ok('card maker data also hides the unapproved sponsor quote', allq.quotes.length === 1);
  await api({ op: 'quote.flag', id: q2.id, approved: true }); await api({ op: 'quote.flag', id: q2.id, published: true }); await sleep(2800); ps = await edge();
  ok('sponsor quote appears once approved', ps.quotes.length === 2, ps.quotes.length);
  await api({ op: 'quote.save', id: q2.id, session: 's04', text: 'Distribution is a product feature, always.', speakerSlug: st.sessions.find((s) => s.id === 's04').speakers.find((x) => x.sponsor).slug });
  await sleep(2800); ps = await edge(); ok('editing a sponsor quote withdraws it until re-approved', ps.quotes.length === 1, ps.quotes.length);
  await api({ op: 'quote.flag', id: q2.id, approved: true, published: true });
  await phone.reload(); await sleep(2800); await shot(phone, '15-phone-quotes');

  /* the maker, as an attendee: official from the list, then a takeaway */
  await phone.click('#quotes button >> nth=0'); await phone.waitForSelector('#dmcm canvas'); await sleep(1200); await shot(phone, '16-maker-official');
  ok('maker opens on the official quote tab from a quote tap', await phone.isChecked('input[name="dmcm-type"][value="official"]'));
  const dl1 = phone.waitForEvent('download'); await phone.click('#dmcm .acts .sec'); const d1 = await dl1; ok('official card saves as PNG', /dmc2026-quote-4x5\.png/.test(d1.suggestedFilename()), d1.suggestedFilename());
  await phone.check('input[name="dmcm-type"][value="takeaway"]', { force: true }); await sleep(300);
  const t0 = Date.now();
  await phone.fill('#dmcm-t', 'Customers first, channels second. I will talk to five this week.'); await sleep(500); await shot(phone, '17-maker-takeaway');
  await phone.check('input[name="dmcm-z"][value="9x16"]', { force: true }); await sleep(500);
  const dl2 = phone.waitForEvent('download'); await phone.click('#dmcm .acts .sec'); const d2 = await dl2;
  ok('takeaway card (9:16) saves as PNG', /takeaway-9x16\.png/.test(d2.suggestedFilename()));
  const took = Date.now() - t0; ok('open-to-saved takeaway took ' + (took / 1000).toFixed(1) + 's (target < 30s, scripted so a floor)', took < 30000);
  const cap = await phone.inputValue('#dmcm-cap'); ok('caption has tags and tracked link', /#DMC2026 #BuiltToScale/.test(cap) && /\/t\/[a-z0-9]+/.test(cap) && /Customers first/.test(cap), cap);
  await phone.fill('#dmcm-t', 'This is bullshit'); await sleep(500); ok('filtered words are not drawn on a card', (await phone.textContent('#dmcm .msg')).includes('can’t go on a card') && await phone.isDisabled('#dmcm .acts .sec'));
  await phone.click('#dmcm .x'); await sleep(2500);
  st = await state(); const tk = st.takeaways;
  ok('takeaway reached the moderation queue with a preview', tk.length === 1 && tk[0].status === 'pending');
  const tki = await (await fetch(B + '/api/live-control?view=tki&id=' + tk[0].id, { headers: { authorization: AUTH } })).json(); ok('preview is a small jpeg', /^data:image\/jpeg/.test(tki.img) && tki.img.length < 60000, tki.img.length);
  const clicks = await fetch(B + '/t/' + cap.match(/\/t\/([a-z0-9]+)/)[1], { redirect: 'manual' }); ok('tracked link redirects to the event page with livequote source', /utm_source=livequote/.test(clicks.headers.get('location') || ''), clicks.headers.get('location'));
  await api({ op: 'tk.moderate', id: tk[0].id, action: 'screen' }); await api({ op: 'screen.set', mode: 'takeaways' }); await sleep(3200); await shot(screen, '18-screen-takeaways');
  const sc2 = await (await fetch(B + '/api/live-state?view=screen&w=' + Math.random())).json(); ok('screen shows first name only', sc2.takeaways && sc2.takeaways[0].name === 'Ama' && !('session' in sc2.takeaways[0]), sc2.takeaways);
  await api({ op: 'screen.set', mode: 'quote', id: q1.id }); await sleep(3200); await shot(screen, '19-screen-quote');
  await api({ op: 'screen.holding' }); await sleep(2800); await shot(screen, '20-screen-holding-emergency');
  ok('emergency holding slide works', (await screen.textContent('body')).includes('mangh.org/live'));
  st = await state(); const an = st.analytics.map((a) => a.ct + ':' + a.made + '/' + a.shared + '/' + a.saved).join(' ');
  ok('analytics recorded cards made/saved by session and type', st.analytics.length >= 2, an);
  await ctl.reload(); await sleep(2500); await shot(ctl, '21-control-final');
  const errs = [].concat(phone.errs, screen.errs, ctl.errs); ok('no page errors in any view', !errs.length, errs);
  console.log('\n' + checks.filter((c) => c[1]).length + '/' + checks.length + ' checks passed');
  await b.close(); process.exit(checks.every((c) => c[1]) ? 0 : 1);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
