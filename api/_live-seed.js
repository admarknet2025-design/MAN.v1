/* Rehearsal mode: fills DMC Live with fake activity so the operator can practise (and so the screens have something to show).
   Everything seeded is labelled: quotes start with "[Rehearsal]", the phone and screen show a REHEARSAL banner, and cards made in
   rehearsal carry a REHEARSAL band, so a rehearsal quote can never be mistaken for something a speaker said.
   "Reset" in the panel wipes it all before the event. */
'use strict';

const live = require('./_live');
const { K, run } = live;

const WORDS = {
  yourself: [['Fear', 14], ['Time', 12], ['Confidence', 10], ['Budget', 9], ['Doubt', 8], ['Focus', 7], ['Skills', 7], ['Network', 5], ['Courage', 5], ['Habit', 4], ['Clarity', 4], ['Mindset', 4], ['Visibility', 3], ['Consistency', 3], ['Direction', 2], ['Ego', 2], ['Burnout', 2], ['Patience', 1]],
  team: [['Trust', 15], ['Curious', 11], ['Honest', 9], ['Fearless', 8], ['Kind', 8], ['Hungry', 7], ['Diverse', 6], ['Aligned', 6], ['Bold', 5], ['Generous', 4], ['Fast', 4], ['Creative', 3], ['Humble', 3], ['Loyal', 2], ['Open', 2], ['Reliable', 2], ['Joyful', 1]],
  work: [['Brand', 13], ['Podcast', 10], ['Platform', 9], ['Course', 8], ['Agency', 8], ['App', 7], ['Campaign', 6], ['Community', 6], ['Newsletter', 5], ['Studio', 5], ['Product', 4], ['Book', 3], ['Marketplace', 3], ['Pitch', 3], ['Portfolio', 2], ['Launch', 2], ['Show', 1]]
};
const QUESTIONS = [
  ['How do you decide which channel deserves budget first?', 'Ama', 'approved', 14], ['What is one metric you would stop reporting tomorrow?', 'Kojo', 'approved', 11],
  ['How small can a marketing team be before it breaks?', 'Anonymous', 'approved', 9], ['Where does AI help you most today, and where does it get in the way?', 'Efua', 'approved', 8],
  ['How do you keep a team honest about results?', 'Yaw', 'approved', 6], ['Is a personal brand still worth building in 2027?', 'Nana', 'approved', 3],
  ['What would you do with a first GH₵10,000 marketing budget?', 'Akosua', 'pending', 0], ['How do you hire your first marketer?', 'Anonymous', 'pending', 0],
  ['Can you recommend a book on pricing?', 'Selorm', 'pending', 0], ['This is a test of a rude word: shit', 'Anonymous', 'pending', 0]
];
const WALL = [
  ['Ama', 'A podcast on Ghanaian small business stories'], ['Kojo', 'A WhatsApp-first CRM for market traders'], ['Efua', 'A creator marketplace for Accra'], ['Yaw', 'My agency’s first in-house product'],
  ['Nana', 'A newsletter on marketing in West Africa'], ['Akosua', 'A course on pricing for freelancers'], ['Selorm', 'A brand for locally made skincare'], ['Kwabena', 'A photo studio that also teaches'],
  ['Adwoa', 'An AI tool for writing in Twi'], ['Mawuli', 'A community for first-time founders'], ['Esi', 'A loyalty app for coffee shops'], ['Kofi', 'A sports media brand'],
  ['Abena', 'A marketing team that ships every week'], ['Yaa', 'A research panel for SMEs'], ['Fiifi', 'A merch line for creators'], ['Dede', 'A local ad network for taxis'],
  ['Kwesi', 'A better way to book event photographers'], ['Afia', 'A video series on career moves']
];
const TAKEAWAYS = [['Ama', 'Start with the customer, not the channel.'], ['Kojo', 'Small teams win by saying no more often.'], ['Efua', 'Measure what changes a decision.'],
  ['Yaw', 'Trust is a growth strategy.'], ['Nana', 'Ship it, then improve it in public.'], ['Akosua', 'A pitch is a story with a price.'], ['Selorm', 'Your first 100 customers are your marketing team.'], ['Kwabena', 'Consistency beats campaigns.']];
const POLL_OPTIONS = ['Yes', 'No', 'Not sure'];

async function seed() {
  const cfg = await live.readCfg();
  const list = live.sessionList(cfg.sess);
  const sid = (list.find((s) => s.id === 's04') || list[3] || list[0]).id;
  const cmds = [];
  const ex = (key) => cmds.push(['EXPIREAT', K(key), String(live.KEEP)]);
  const dh = (i) => live.hashDevice('rehearsal-device-' + i);

  cmds.push(live.cfgSet('rehearsal', '1'), live.cfgSet('session', sid), live.cfgSet('activity', { type: 'qa', id: sid, since: Date.now() }), live.cfgSet('screen', { mode: 'follow', since: Date.now() }));

  Object.keys(WORDS).forEach((cloud) => WORDS[cloud].forEach(([w, n]) => {
    const norm = live.normaliseWord(w);
    cmds.push(['ZINCRBY', K('wc:' + cloud), String(n), norm], ['HSETNX', K('wcd:' + cloud), norm, w]);
  }));
  ['wc:yourself', 'wc:team', 'wc:work', 'wcd:yourself', 'wcd:team', 'wcd:work'].forEach(ex);

  const stamp = Date.now();
  QUESTIONS.forEach(([text, name, status, votes], i) => {
    const id = 'q' + (900 + i);
    cmds.push(['HSET', K('qs:' + sid), id, JSON.stringify({ id, s: sid, text, name, ts: stamp - (QUESTIONS.length - i) * 60000, status, flagged: /shit/.test(text) })]);
    if (votes) cmds.push(['HSET', K('qv:' + sid), id, String(votes)]);
  });
  cmds.push(['SADD', K('qsess'), sid]);
  ex('qs:' + sid); ex('qv:' + sid); ex('qsess');

  /* a swing pair of polls with 90 fake devices; about a third change their minds */
  const q = 'Can a marketing team scale without AI?';
  const before = { id: 'p901', question: q, options: POLL_OPTIONS, open: false, show: true, pair: { role: 'before', with: 'p902' }, session: sid, created: stamp };
  const after = { id: 'p902', question: q, options: POLL_OPTIONS, open: true, show: false, pair: { role: 'after', with: 'p901' }, session: sid, created: stamp };
  cmds.push(['HSET', K('polls'), before.id, JSON.stringify(before)], ['HSET', K('polls'), after.id, JSON.stringify(after)]);
  const tallyB = [0, 0, 0], tallyA = [0, 0, 0];
  for (let i = 0; i < 90; i++) {
    const b = i % 10 < 4 ? 0 : i % 10 < 8 ? 1 : 2;
    const a = i % 3 === 0 ? (b + 1) % 3 : b;
    tallyB[b]++; tallyA[a]++;
    cmds.push(['HSET', K('pvd:p901'), dh(i), String(b)], ['HSET', K('pvd:p902'), dh(i), String(a)]);
  }
  tallyB.forEach((n, i) => cmds.push(['HSET', K('pv:p901'), String(i), String(n)]));
  tallyA.forEach((n, i) => cmds.push(['HSET', K('pv:p902'), String(i), String(n)]));
  ['polls', 'pv:p901', 'pv:p902', 'pvd:p901', 'pvd:p902'].forEach(ex);

  WALL.forEach(([name, line], i) => {
    const id = 'w' + (900 + i);
    const optin = i % 3 === 0;
    cmds.push(['HSET', K('wall'), id, JSON.stringify({ id, name, line, contact: optin ? name.toLowerCase() + '@example.com' : '', optin, ts: stamp - (WALL.length - i) * 30000, status: i < 14 ? 'approved' : 'pending', flagged: false })]);
  });
  cmds.push(['EXPIREAT', K('wall'), String(live.KEEP_WALL)]);

  TAKEAWAYS.forEach(([name, text], i) => {
    const id = 't' + (900 + i);
    cmds.push(['HSET', K('tk'), id, JSON.stringify({ id, session: sid, text, name, ts: stamp - (TAKEAWAYS.length - i) * 20000, status: i < 3 ? 'screen' : 'pending', flagged: false })]);
  });
  ex('tk');

  const s = list.find((x) => x.id === sid);
  const speakers = s && s.people && s.people.length ? s.people : ['alex-offei-lartey'];
  const mk = (id, slug, text, published, approved) => {
    const p = live.personView(slug);
    const spon = (live.PEOPLE.get(slug) || {}).sponsor || '';
    return ['HSET', K('quotes'), id, JSON.stringify({ id, session: sid, text: '[Rehearsal] ' + text, speaker: { slug, name: p.name, title: [p.title, p.company].filter(Boolean).join(', '), photo: p.photo }, sponsor: spon, approved, published, ts: stamp, by: 'rehearsal' })];
  };
  cmds.push(mk('o901', speakers[0], 'This sentence is invented for rehearsal and was not said on stage.', true, false));
  if (speakers[1]) cmds.push(mk('o902', speakers[1], 'This is another invented rehearsal line.', true, true));
  if (speakers[2]) cmds.push(mk('o903', speakers[2], 'A sponsor’s rehearsal line, waiting for approval.', false, false));
  ex('quotes');

  cmds.push(['HSET', K('cnt'), 'words', '163', 'questions', '10', 'qvotes', '51', 'pollvotes', '180', 'wall', String(WALL.length), 'takeaways', String(TAKEAWAYS.length)]);
  for (let i = 0; i < 118; i++) cmds.push(['ZADD', K('hb'), String(Date.now() - (i % 60) * 1000), dh(i)]);
  ex('hb'); ex('cnt');
  cmds.push(...live.bumpCfg());
  for (let i = 0; i < cmds.length; i += 200) await run(cmds.slice(i, i + 200));
  return { session: sid };
}

module.exports = { seed };
