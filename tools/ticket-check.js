#!/usr/bin/env node
/* Checks the live MojoTickets host the ticket pop-up depends on, so a change on their side shows up before the event.
     node tools/ticket-check.js
   Fails if: the event is missing or its date/venue changed; the embed page can no longer be framed by mangh.org; embed.js stopped being served;
   or the message the pop-up listens for is gone from the embed page's script. Needs network access to tickets.mojo-pay.com. */
'use strict';
const HOST = 'https://tickets.mojo-pay.com', SLUG = 'digital-marketers-conference-2026';
let bad = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || extra === undefined ? '' : ' ' + JSON.stringify(extra))); if (!cond) bad++; };
const get = async (p) => { const r = await fetch(HOST + p, { redirect: 'follow' }); return { r, t: await r.text() }; };
(async () => {
  const ev = await get('/api/v1/embed/events/' + SLUG);
  let d = {}; try { const j = JSON.parse(ev.t); d = j.data || j; } catch (e) { /* reported below */ }
  ok('event is published on ' + HOST, ev.r.status === 200 && d.slug === SLUG, ev.r.status);
  ok('event starts 2026-11-21 at British Council', /^2026-11-21/.test(d.starts_at || '') && /British Council/i.test(d.venue_name || ''), d);
  const page = await get('/embed/events/' + SLUG);
  const csp = page.r.headers.get('content-security-policy') || '';
  ok('embed page can be framed by mangh.org', page.r.status === 200 && !page.r.headers.get('x-frame-options') && (/frame-ancestors[^;]*(\*|mangh\.org)/.test(csp)), { xfo: page.r.headers.get('x-frame-options'), csp });
  const js = await get('/embed.js');
  ok('embed.js is served', js.r.status === 200 && /mojotickets:checkout:complete/.test(js.t));
  const m = /src="([^"]*\/build\/assets\/app-[^"]+\.js)"/.exec(page.t);
  if (m) {
    const app = await get(new URL(m[1]).pathname);
    ok('embed app still posts mojotickets:checkout:complete with a reference', /postMessage\(\{type:`mojotickets:checkout:complete`,reference:/.test(app.t));
  } else ok('embed app script found on the embed page', false);
  console.log(bad ? bad + ' problem(s)' : 'the ticket host is as the pop-up expects');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(2); });
