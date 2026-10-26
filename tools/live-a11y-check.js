/* DMC Live accessibility check: axe-core (WCAG 2 A/AA and best practice) on every phone state, the card maker, every projector mode and every operator tab.
     BASE=http://localhost:4180 ADMIN_USER=... ADMIN_PASSWORD=... node tools/live-a11y-check.js
   Needs Playwright (npm i --no-save playwright) and a running copy of the site (Vercel dev, a preview, or a local server) whose store is a
   rehearsal or local one: it presses "Reset everything" first. Never run it against the live event. */
'use strict';
const ENV_USER = process.env.ADMIN_USER, ENV_PASS = process.env.ADMIN_PASSWORD;
if (!ENV_USER || !ENV_PASS) { console.error('Set ADMIN_USER and ADMIN_PASSWORD (the team login of the site under test).'); process.exit(2); }
const { chromium } = require('playwright'); const fs = require('fs');
const AXE = fs.readFileSync(process.env.AXE || require.resolve('axe-core/axe.min.js'), 'utf8');   // npm i --no-save axe-core
const B = (process.env.BASE || 'http://localhost:4180').replace(/\/$/, ''), AUTH = 'Basic ' + Buffer.from(ENV_USER + ':' + ENV_PASS).toString('base64');
const api = (op) => fetch(B + '/api/live-control', { method: 'POST', headers: { 'content-type': 'application/json', authorization: AUTH }, body: JSON.stringify(op) }).then(r => r.json());
(async () => {
  await api({ op: 'reset', confirm: 'RESET' }); await api({ op: 'rehearsal.seed' });
  const b = await chromium.launch(); let bad = 0;
  const run = async (name, p, setup) => { if (setup) await setup(p); await p.addScriptTag({ content: AXE }); const r = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] })); const v = r.violations; console.log(name + ': ' + (v.length ? v.length + ' violation(s)' : 'clean') + ' (' + r.passes.length + ' rules passed)'); v.forEach((x) => { bad++; console.log('  -', x.id, x.impact, x.help, x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')); }); };
  const ph = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  for (const [act, extra] of [['qa'], ['cloud', 'yourself'], ['poll'], ['wall']]) {
    const st = await (await fetch(B + '/api/live-control?view=state', { headers: { authorization: AUTH } })).json();
    if (act === 'poll') await api({ op: 'poll.set', id: st.polls[0].id, open: true });
    await api({ op: 'activity.set', type: act, id: act === 'cloud' ? 'yourself' : act === 'poll' ? st.polls[0].id : undefined });
    await ph.goto(B + '/live'); await ph.waitForTimeout(2600);
    await run('phone/' + act, ph);
  }
  await run('phone/card maker', ph, async (p) => { await p.click('#make'); await p.waitForSelector('#dmcm canvas'); await p.fill('#dmcm-t', 'Ship small, learn fast.'); await p.waitForTimeout(800); });
  const sc = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  for (const mode of ['holding', 'cloud', 'qa', 'poll', 'wall', 'finale']) { await api({ op: 'screen.set', mode, id: mode === 'poll' ? (await (await fetch(B + '/api/live-control?view=state', { headers: { authorization: AUTH } })).json()).polls[0].id : '' }); await sc.goto(B + '/live/screen'); await sc.waitForTimeout(2800); await run('screen/' + mode, sc); }
  const ct = await (await b.newContext({ viewport: { width: 1280, height: 900 }, httpCredentials: { username: ENV_USER, password: ENV_PASS } })).newPage();
  await ct.goto(B + '/live/control'); await ct.waitForTimeout(2500);
  for (const tab of ['Run', 'Questions', 'Build Wall', 'Takeaways', 'Polls', 'Official quotes', 'Words', 'Setup']) await run('control/' + tab, ct, async (p) => { await p.getByRole('tab', { name: new RegExp('^' + tab) }).click(); await p.waitForTimeout(500); });
  const cm = await (await b.newContext({ viewport: { width: 390, height: 800 }, httpCredentials: { username: ENV_USER, password: ENV_PASS } })).newPage();
  await cm.goto(B + '/live/control'); await cm.waitForTimeout(2500); await run('control/phone-width', cm);
  console.log(bad ? bad + ' violations' : 'all clean'); await b.close(); process.exit(bad ? 1 : 0);
})();
