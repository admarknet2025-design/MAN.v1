/* POST /api/live-submit — everything a phone can send in DMC Live. Public, no login: a random device id (kept on the phone) is the only
   identity, and it is stored only as a salted hash that expires 30 days after the event.

   body: { t: type, d: device id, ... }
     hb      heartbeat (people connected)
     word    { cloud, text }                 one or two words, three per device per cloud, filtered
     q       { session, text, name }         a question for the moderation queue
     qv      { session, id }                 one upvote per device per question
     pv      { poll, opt }                   one answer per device per poll
     wall    { name, line, contact, optin }  Build Wall entry for the moderation queue
     tk      { session, text, name, img }    "My takeaway" card made: moderation queue (img is a small preview)
     ev      { e, session, ct }              analytics: cards made / shared / saved (e = made | shared | saved)
     link    { session, ct }                 tracked short link (/t/<code>, source livequote) for a card
   Every response is small JSON: { ok: true, ... } or { error: "code" }. */
'use strict';

const crypto = require('crypto');
const live = require('./_live');
const { origin } = require('./_auth');

const { K, run, LIMITS } = live;
const CARD_TYPES = ['official', 'takeaway'];
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,80}\.[^\s@]{2,}$/;

const count = (kind) => [['HINCRBY', K('cnt'), kind, '1'], ['EXPIREAT', K('cnt'), String(live.KEEP)]];
const fail = (res, code, status) => res.status(status || 400).json({ error: code });
const sessionKnown = (cfg, id) => typeof id === 'string' && /^[a-z0-9-]{1,24}$/.test(id) && live.sessionList(cfg.sess).some((s) => s.id === id);

function cleanContact(raw) {
  const c = live.clean(raw, LIMITS.contact);
  if (!c) return '';
  if (EMAIL.test(c)) return c;
  const handle = /^@?[A-Za-z0-9_.-]{2,40}$/.exec(c);
  if (handle) return '@' + c.replace(/^@/, '');
  const url = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]{2,60}\/?$/i.exec(c);
  return url ? c : '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 'post only', 405); }
  if (!live.store.configured()) return fail(res, 'not configured', 503);
  const b = req.body && typeof req.body === 'object' ? req.body : null;
  if (!b || JSON.stringify(b).length > 100000) return fail(res, 'bad body');
  if (!live.validDevice(b.d)) return fail(res, 'bad device');
  const dh = live.hashDevice(b.d);
  const t = String(b.t || '');

  try {
    /* coarse flood guard per network address: generous, because a whole room can share one Wi-Fi address */
    if (t !== 'hb') {
      const ip = String(req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || '').split(',')[0].trim();
      const ipKey = crypto.createHash('sha256').update(live.hashDevice('ip' + ip)).digest('hex').slice(0, 12) + ':' + Math.floor(Date.now() / 60000);
      const [n] = await run([['INCR', K('rl:ip:' + ipKey)], ['EXPIRE', K('rl:ip:' + ipKey), '120']]);
      if (Number(n) > 1800) return fail(res, 'slow down', 429);
    }

    if (t === 'hb') {
      const cmds = [['ZADD', K('hb'), String(Date.now()), dh]];
      if (Math.random() < 0.02) cmds.push(['EXPIREAT', K('hb'), String(live.KEEP)]);
      await run(cmds);
      return res.status(200).json({ ok: true });
    }

    const cfg = await live.readCfgCached();
    const act = cfg.activity || { type: 'none' };

    /* a phone that retried after a dropped connection sends the same key again: answer "ok" without doing it twice */
    if (b.k !== undefined && ['word', 'q', 'wall', 'tk', 'qv', 'pv', 'ev'].indexOf(t) >= 0) {
      if (!/^[A-Za-z0-9_-]{8,40}$/.test(String(b.k))) return fail(res, 'bad key');
      if (!(await live.rateOk('idem', b.k, 600))) return res.status(200).json({ ok: true, duplicate: true });
    }

    if (t === 'word') {
      const cloud = String(b.cloud || '');
      if (!live.CLOUDS[cloud]) return fail(res, 'bad cloud');
      if (!(act.type === 'cloud' && act.id === cloud)) return fail(res, 'closed', 409);
      const nw = live.normaliseWord(b.text);
      if (!nw) return fail(res, 'one or two words');
      const [used] = await run([['HINCRBY', K('dev:' + dh + ':w'), 'cloud-' + cloud, '1']]);
      if (Number(used) > LIMITS.wordsPerDevice) return fail(res, 'limit', 429);
      const text = live.clean(b.text, LIMITS.word * 2);
      if (!(await live.isClean(text)) || !(await live.isClean(nw))) {
        const [fid] = await run([['INCR', K('fseq')]]);
        await run([['HSET', K('flag'), 'f' + fid, JSON.stringify({ id: 'f' + fid, kind: 'word', cloud, text, norm: nw, ts: Date.now() })], ['EXPIREAT', K('flag'), String(live.KEEP)], ...count('words'), live.bump()]);
        return res.status(200).json({ ok: true, left: LIMITS.wordsPerDevice - Number(used) });
      }
      await run([['ZINCRBY', K('wc:' + cloud), '1', nw], ['HSETNX', K('wcd:' + cloud), nw, live.display(nw)], ['EXPIREAT', K('wc:' + cloud), String(live.KEEP)],
        ['EXPIREAT', K('wcd:' + cloud), String(live.KEEP)], ['EXPIREAT', K('dev:' + dh + ':w'), String(live.KEEP)], ...count('words'), live.bump()]);
      return res.status(200).json({ ok: true, left: LIMITS.wordsPerDevice - Number(used) });
    }

    if (t === 'q') {
      if (!sessionKnown(cfg, b.session)) return fail(res, 'bad session');
      if (!(act.type === 'qa' && act.id === b.session)) return fail(res, 'closed', 409);
      const text = live.clean(b.text, LIMITS.question);
      if (text.length < 3) return fail(res, 'too short');
      if (!(await live.rateOk('q', dh, 15))) return fail(res, 'wait a moment', 429);
      const name = live.clean(b.name, LIMITS.name) || 'Anonymous';
      const flagged = !(await live.isClean(text + ' ' + name));
      const [seq] = await run([['INCR', K('qseq')]]);
      const id = 'q' + seq;
      await run([['HSET', K('qs:' + b.session), id, JSON.stringify({ id, s: b.session, text, name, ts: Date.now(), status: 'pending', flagged })],
        ['EXPIREAT', K('qs:' + b.session), String(live.KEEP)], ['SADD', K('qsess'), b.session], ['EXPIREAT', K('qsess'), String(live.KEEP)], ...count('questions'), live.bump()]);
      return res.status(200).json({ ok: true, id, pending: true });
    }

    if (t === 'qv') {
      if (!sessionKnown(cfg, b.session) || !/^q\d{1,9}$/.test(String(b.id))) return fail(res, 'bad question');
      const [qj] = await run([['HGET', K('qs:' + b.session), b.id]]);
      const q = live.jp(qj, null);
      if (!q || q.status !== 'approved') return fail(res, 'not found', 404);
      const [added] = await run([['SADD', K('qvt:' + b.session + ':' + b.id), dh], ['EXPIREAT', K('qvt:' + b.session + ':' + b.id), String(live.KEEP)]]);
      if (Number(added) === 1) await run([['HINCRBY', K('qv:' + b.session), b.id, '1'], ['EXPIREAT', K('qv:' + b.session), String(live.KEEP)], ...count('qvotes'), live.bump()]);
      return res.status(200).json({ ok: true, already: Number(added) !== 1 });
    }

    if (t === 'pv') {
      const pid = String(b.poll || '');
      if (!/^p\d{1,6}$/.test(pid)) return fail(res, 'bad poll');
      const [pj] = await run([['HGET', K('polls'), pid]]);
      const poll = live.jp(pj, null);
      if (!poll) return fail(res, 'not found', 404);
      if (!poll.open) return fail(res, 'closed', 409);
      const opt = Number(b.opt);
      if (!Number.isInteger(opt) || opt < 0 || opt >= poll.options.length) return fail(res, 'bad option');
      const [fresh] = await run([['HSETNX', K('pvd:' + pid), dh, String(opt)]]);
      if (Number(fresh) === 1) await run([['HINCRBY', K('pv:' + pid), String(opt), '1'], ['EXPIREAT', K('pv:' + pid), String(live.KEEP)], ['EXPIREAT', K('pvd:' + pid), String(live.KEEP)], ...count('pollvotes'), live.bump()]);
      return res.status(200).json({ ok: true, already: Number(fresh) !== 1 });
    }

    if (t === 'wall') {
      if (act.type !== 'wall') return fail(res, 'closed', 409);
      const line = live.clean(b.line, LIMITS.line);
      if (line.length < 3) return fail(res, 'too short');
      const [used] = await run([['HINCRBY', K('dev:' + dh + ':w'), 'wall', '1']]);
      if (Number(used) > 3) return fail(res, 'limit', 429);
      const name = live.clean(b.name, LIMITS.name) || 'Someone';
      const optin = b.optin === true;
      const contact = optin ? cleanContact(b.contact) : '';
      if (optin && !contact) return fail(res, 'contact');
      const flagged = !(await live.isClean(line + ' ' + name));
      const [seq] = await run([['INCR', K('wseq')]]);
      const id = 'w' + seq;
      await run([['HSET', K('wall'), id, JSON.stringify({ id, name, line, contact, optin, ts: Date.now(), status: 'pending', flagged })],
        ['EXPIREAT', K('wall'), String(live.KEEP_WALL)], ['EXPIREAT', K('dev:' + dh + ':w'), String(live.KEEP)], ...count('wall'), live.bump()]);
      return res.status(200).json({ ok: true, id, pending: true });
    }

    if (t === 'tk') {
      if (!sessionKnown(cfg, b.session)) return fail(res, 'bad session');
      const text = live.clean(b.text, LIMITS.takeaway);
      if (text.length < 3) return fail(res, 'too short');
      if (!(await live.rateOk('tk', dh, 4))) return fail(res, 'wait a moment', 429);
      const name = live.clean(b.name, LIMITS.name).split(' ')[0] || 'Someone';
      const flagged = !(await live.isClean(text + ' ' + name));
      const [seq] = await run([['INCR', K('tseq')]]);
      const id = 't' + seq;
      const cmds = [['HSET', K('tk'), id, JSON.stringify({ id, session: b.session, text, name, ts: Date.now(), status: 'pending', flagged })], ['EXPIREAT', K('tk'), String(live.KEEP)],
        ['HINCRBY', K('an'), 'made|' + b.session + '|takeaway', '1'], ['EXPIREAT', K('an'), String(live.KEEP)], ...count('takeaways'), live.bump()];
      if (typeof b.img === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.img) && b.img.length <= LIMITS.previewBytes) {
        cmds.push(['SET', K('tki:' + id), b.img], ['EXPIREAT', K('tki:' + id), String(live.KEEP)]);
      }
      await run(cmds);
      return res.status(200).json({ ok: true, id });
    }

    if (t === 'ev') {
      const k = String(b.e || '');
      if (['made', 'shared', 'saved'].indexOf(k) < 0 || CARD_TYPES.indexOf(b.ct) < 0 || !sessionKnown(cfg, b.session)) return fail(res, 'bad event');
      /* official-quote cards are counted here; takeaway "made" is counted when the card reaches moderation (tk) */
      if (k === 'made' && b.ct === 'takeaway') return res.status(200).json({ ok: true });
      await run([['HINCRBY', K('an'), k + '|' + b.session + '|' + b.ct, '1'], ['EXPIREAT', K('an'), String(live.KEEP)]]);
      return res.status(200).json({ ok: true });
    }

    if (t === 'link') {
      if (CARD_TYPES.indexOf(b.ct) < 0 || !sessionKnown(cfg, b.session)) return fail(res, 'bad link');
      const code = await live.store.linkFor({ slug: b.session, template: b.ct, platform: 'livequote', campaign: b.ct });
      return res.status(200).json({ ok: true, url: origin(req) + '/t/' + code });
    }

    return fail(res, 'unknown type');
  } catch (e) {
    console.error('live submit error', e && e.message);
    return fail(res, 'unavailable', 502);
  }
};
