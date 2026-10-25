/* GET /t/<code> (rewritten to this function in vercel.json): the tracked short link behind every DMC Studio artwork.
   Logs the click (code, time, device class) to the attribution store, then 302-redirects to the DMC 2026 page with the
   referral and UTM parameters that the ticket checkout already captures:
     /dmc-2026?ref=<slug>&utm_source=<platform>&utm_medium=social&utm_campaign=<template>
   Link-preview crawlers (WhatsApp, Facebook, LinkedIn and so on) fetch the same URL; they are redirected but not counted. */
'use strict';

const store = require('./_store');

const CODE = /^[a-z0-9]{4,12}$/;
const BOT = /bot|crawler|spider|facebookexternalhit|whatsapp|slackbot|linkedinbot|twitterbot|telegram|discord|skypeuripreview|embedly|preview|curl|wget|python-requests|headless/i;
const IN_APP = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|BytedanceWebview|LinkedInApp/i;

function uaClass(ua) {
  ua = String(ua || '');
  if (BOT.test(ua) && !IN_APP.test(ua)) return 'bot';
  if (IN_APP.test(ua)) return 'in-app';
  return /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const code = String((req.query && req.query.code) || '').toLowerCase();
  let target = '/dmc-2026';
  if (CODE.test(code) && store.configured()) {
    try {
      const link = await store.getLink(code);
      if (link) {
        const q = 'ref=' + encodeURIComponent(link.slug) + '&utm_source=' + encodeURIComponent(link.platform) +
          '&utm_medium=social&utm_campaign=' + encodeURIComponent(link.template);
        target = '/dmc-2026?' + q;
        const ua = uaClass(req.headers['user-agent']);
        if (ua !== 'bot') {
          /* never hold the visitor up for the log: give the store a short window, then redirect regardless */
          await Promise.race([
            store.logClick(link, { code, ts: new Date().toISOString(), ua }),
            new Promise((r) => setTimeout(r, 1500)),
          ]).catch((e) => console.error('click log error', e && e.message));
        }
      }
    } catch (e) { console.error('short link error', e && e.message); }
  }
  res.setHeader('Location', target);
  res.status(302).end();
};
