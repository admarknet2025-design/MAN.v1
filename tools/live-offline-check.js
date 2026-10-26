/* DMC Live weak-network check: first-load size against the 150 KB budget, an outbox that survives offline and a reload, and a card maker that keeps working with no connection.
     BASE=http://localhost:4180 ADMIN_USER=... ADMIN_PASSWORD=... node tools/live-offline-check.js
   Needs Playwright (npm i --no-save playwright) and a running copy of the site (Vercel dev, a preview, or a local server) whose store is a
   rehearsal or local one: it presses "Reset everything" first. Never run it against the live event. */
'use strict';
const ENV_USER = process.env.ADMIN_USER, ENV_PASS = process.env.ADMIN_PASSWORD;
if (!ENV_USER || !ENV_PASS) { console.error('Set ADMIN_USER and ADMIN_PASSWORD (the team login of the site under test).'); process.exit(2); }
const { chromium } = require('playwright'); const zlib = require('zlib');
const B = (process.env.BASE || 'http://localhost:4180').replace(/\/$/, ''), AUTH = 'Basic ' + Buffer.from(ENV_USER + ':' + ENV_PASS).toString('base64');
const api = (op) => fetch(B + '/api/live-control', { method: 'POST', headers: { 'content-type': 'application/json', authorization: AUTH }, body: JSON.stringify(op) }).then(r => r.json());
const state = () => fetch(B + '/api/live-control?view=state&fresh=1', { headers: { authorization: AUTH } }).then(r => r.json());
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(x || ''))); if (!c) fails++; };
(async () => {
  await api({ op: 'reset', confirm: 'RESET' }); await api({ op: 'session.set', id: 's04' }); await api({ op: 'activity.set', type: 'cloud', id: 'team' });
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, acceptDownloads: true }); const p = await ctx.newPage();
  const res = []; p.on('response', async (r) => { try { const buf = await r.body(); res.push({ url: r.url().replace(B, ''), raw: buf.length, gz: zlib.gzipSync(buf).length }); } catch (e) {} });
  await p.goto(B + '/live'); await p.waitForTimeout(3000);
  const tot = res.reduce((a, r) => a + r.gz, 0), raw = res.reduce((a, r) => a + r.raw, 0);
  console.log(res.map((r) => '  ' + r.url.split('?')[0] + ' ' + r.raw + 'B raw / ' + r.gz + 'B gzip').join('\n'));
  ok('first load of /live (incl. one state poll) = ' + (tot / 1024).toFixed(1) + ' KB gzip, ' + (raw / 1024).toFixed(1) + ' KB raw; budget 150 KB', tot < 150 * 1024 && raw < 150 * 1024);
  ok('card maker not downloaded until needed', !res.some((r) => /live-cards/.test(r.url)));
  /* weak Wi-Fi: words typed while offline are kept and sent when the connection returns */
  await ctx.setOffline(true); await p.waitForTimeout(300);
  await p.fill('#wd', 'Trust'); await p.click('text=Add my word'); await p.waitForTimeout(800);
  ok('offline: submission shows "Sending 1…"', /Sending [12]/.test(await p.textContent('#sending')), await p.textContent('#sending'));
  await p.reload().catch(() => {});   // page itself is cached by the browser only if visited; ignore failure
  await ctx.setOffline(false); await p.goto(B + '/live'); await p.waitForTimeout(4500);
  ok('outbox survives a reload and is delivered once online', !/Sending/.test(await p.textContent('#sending')));
  let st = await state(); ok('server received the queued word exactly once', st.counters.words === 1, st.counters);
  /* the card maker keeps working with no connection once it has loaded */
  await p.click('#make'); await p.waitForSelector('#dmcm canvas'); await p.waitForTimeout(800);
  await ctx.setOffline(true);
  await p.fill('#dmcm-n', 'Kwesi'); await p.fill('#dmcm-t', 'Offline cards still work.'); await p.check('input[name="dmcm-l"][value="night"]', { force: true }); await p.check('input[name="dmcm-z"][value="9x16"]', { force: true }); await p.waitForTimeout(500);
  const dl = p.waitForEvent('download', { timeout: 15000 }); await p.click('#dmcm .acts .sec'); const d = await dl; ok('offline: card saves', /takeaway-9x16/.test(d.suggestedFilename()));
  ok('offline: caption still produced (fallback link)', /#DMC2026/.test(await p.inputValue('#dmcm-cap')));
  await p.waitForTimeout(600); ok('offline: takeaway queued to send later', /Sending [12]/.test(await p.textContent('#sending')), await p.textContent('#sending'));
  await ctx.setOffline(false); await p.waitForTimeout(6000);
  st = await state(); ok('queued takeaway reaches moderation after reconnect', st.takeaways.length === 1, st.takeaways);
  console.log(fails ? fails + ' failed' : 'all passed'); await b.close(); process.exit(fails ? 1 : 0);
})();
