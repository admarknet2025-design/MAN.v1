#!/usr/bin/env node
/* Builds lib/studio/data.json (speakers, programme sessions, partners) for DMC Studio from the live pages, so the
 * Studio never has its own copy of who is speaking. Run it after the speaker or programme markup changes:
 *
 *   node tools/build-studio-data.js
 *
 * Speakers and sessions come from dmc-2026.html. Partners are listed here because the pages only show them as logos;
 * tier and role wording is copied from the DMC 2026 pages and stays factual (name, logo, tier, role). */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'dmc-2026.html'), 'utf8');

const dec = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[“”"']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const MOVEMENTS = ['Build Yourself', 'Build Your Team', 'Build Your Work'];
const movementOf = (s) => MOVEMENTS.find((m) => s.indexOf(m) >= 0) || '';

/* speakers: each .spc card in the speakers grid */
const grid = html.slice(html.indexOf('<div class="sp-grid">'), html.indexOf('<p class="sp-note'));
const people = [];
grid.split('<div class="spc ').slice(1).forEach((card) => {
  const name = (card.match(/<div class="spn">([\s\S]*?)<\/div>/) || [])[1];
  if (!name || /^Keynote Speaker$/.test(dec(name))) return; /* the keynote slot is still TBC */
  const cat = dec((card.match(/<div class="spc-cat">([\s\S]*?)<\/div>/) || [])[1] || '');
  const role = dec((card.match(/<div class="sp-role">([\s\S]*?)<\/div>/) || [])[1] || '');
  const photo = (card.match(/src="\/assets\/speakers\/([^"]+)"/) || [])[1] || '';
  const n = dec(name);
  let title = '', company = '';
  if (role) {
    const first = role.split(' · ')[0];
    const i = first.indexOf(', ');
    if (i > 0) { title = first.slice(0, i); company = first.slice(i + 2); } else title = first;
  } else if (/^Host · /.test(cat)) { title = 'Host'; company = cat.replace(/^Host · /, ''); }
  people.push({
    slug: slugify(n).replace(/-?robotboy-?/, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
    name: n, title, company, photo, session: cat, movement: movementOf(cat)
  });
});

/* programme rows */
const sessions = [];
const sched = html.slice(html.indexOf('<div class="sched">'), html.indexOf('<p class="prog-note'));
sched.split('<div class="srow').slice(1).forEach((row, i) => {
  const t = [...row.matchAll(/<div class="(?:ti|ap)">([^<]+)<\/div>/g)].map((m) => m[1]);
  const title = dec((row.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1] || '');
  const badge = dec((row.match(/<span class="badge[^"]*">([\s\S]*?)<\/span>/) || [])[1] || '');
  const who = dec((row.match(/<div class="sd">([\s\S]*?)<\/div>/) || [])[1] || '');
  sessions.push({ id: 's' + String(i + 1).padStart(2, '0'), start: t[0], end: t[1], title, badge, speakers: who, movement: movementOf(title) });
});

/* the M·A·N team (home page): the alt text carries the fuller name, the card carries the role */
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const team = [];
idx.split('<div class="tc ').slice(1).forEach((card) => {
  const alt = dec((card.match(/<img[^>]*alt="([^"]*)"/) || [])[1] || '');
  const photo = (card.match(/src="\/assets\/speakers\/([^"]+)"/) || [])[1] || '';
  const role = dec((card.match(/<div class="tc-role">([\s\S]*?)<\/div>/) || [])[1] || '');
  const name = alt.split(',')[0].replace(/\s*\(.*$/, '').trim();
  if (name && photo) team.push({ slug: photo.replace(/\.\w+$/, ''), name, title: role, company: 'M·A·N', photo });
});

/* each person's session = the programme row that names them (the Enoch row only mentions him as host) */
people.forEach((p) => {
  const row = sessions.find((s) => s.speakers.indexOf(p.name) >= 0);
  p.session = row ? row.title : p.session.replace(/^Host · .*/, '');
  p.movement = row ? row.movement : '';
  p.sessionTime = row ? row.start + '–' + row.end : '';
});

/* Which speakers represent a sponsor or partner (DMC Live holds their official quotes until the operator ticks "Sponsor-approved").
   Matched on the company in the speaker's role; a few spellings are listed by hand. */
const SPONSOR_ALIASES = { 'mojo payments': 'MojoPay', 'mojopay': 'MojoPay', 'generation ghana': 'Generation Ghana', 'fido': 'FIDO', 'mnotify': 'mNotify',
  'kasad3': 'Kasad3', 'tech labari': 'Tech Labari', 'koin photography': 'Koin Photography' };
people.forEach((p) => {
  const key = (p.company || '').toLowerCase().trim();
  p.sponsor = SPONSOR_ALIASES[key] || '';
});

/* programme rows: who is on stage (people the site lists), and the format DMC Live shows */
const FORMAT = { Keynote: 'Keynote', Presentation: 'Presentation', Panel: 'Discussion' };
sessions.forEach((r) => {
  r.format = FORMAT[r.badge] || r.badge;
  const names = people.map((p) => p.name).filter((n) => r.speakers.indexOf(n) >= 0);
  r.people = names.map((n) => people.find((p) => p.name === n).slug);
});

const partners = [
  { slug: 'mojopay',          name: 'MojoPay',          logo: 'mojopay-blue.webp',      tier: 'Gold / Headline Sponsor', role: 'Title sponsor and official ticketing platform' },
  { slug: 'generation-ghana', name: 'Generation Ghana', logo: 'generation-ghana.webp',  tier: 'Silver Sponsor',          role: 'Partner presentation, 12:25' },
  { slug: 'fido',             name: 'FIDO',             logo: 'fido.webp',              tier: 'Silver Sponsor',          role: 'DMC 2026 sponsor' },
  { slug: 'mnotify',          name: 'mNotify',          logo: 'mnotify.webp',           tier: 'Programme Partner',       role: 'Partner spotlight, 13:45' },
  { slug: 'koin-photography', name: 'Koin Photography', logo: 'mista-koin.webp',        tier: 'Event Photography Partner', role: 'Partner spotlight, 13:55' },
  { slug: 'tech-labari',      name: 'Tech Labari',      logo: 'tech-labari.webp',       tier: 'Media Partner',           role: 'Partner spotlight, 14:30' },
  { slug: 'kasad3',           name: 'Kasad3',           logo: 'kasad3.webp',            tier: 'Media Partner',           role: 'Partner spotlight, 14:35' }
];

const out = {
  _note: 'Generated by tools/build-studio-data.js from dmc-2026.html. Do not edit by hand.',
  event: { name: 'DMC 2026', long: 'Digital Marketers’ Conference 2026', theme: 'Built To Scale', date: '2026-11-21', time: '10AM–3PM',
           venue: 'British Council Accra', host: 'M·A·N' },
  movements: MOVEMENTS, people, team, sessions, partners
};
fs.writeFileSync(path.join(ROOT, 'lib/studio/data.json'), JSON.stringify(out, null, 1) + '\n');
console.log(people.length + ' people, ' + team.length + ' team, ' + sessions.length + ' sessions, ' + partners.length + ' partners');
