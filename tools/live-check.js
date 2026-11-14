/* Checks for DMC Live that need no server, no browser and no store:  node tools/live-check.js
   The word filter (false positives and evasions), word normalisation, plain-text cleaning, the programme data the sponsor rule relies on,
   and where Akan Gold may appear and that nothing outside the brand palette does. Exits 1 on any failure. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const live = require('../api/_live');
const { compile, hits } = require('../lib/live/filter-core');

let fails = 0, passes = 0;
const ok = (name, cond, extra) => { if (cond) passes++; else { fails++; console.log('FAIL ' + name + (extra ? ' ' + JSON.stringify(extra) : '')); } };

/* ---- the filter ---- */
const lines = fs.readFileSync(path.join(root, 'lib/live/blocklist.txt'), 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
const LIST = { words: compile(lines) };
const blocked = (t) => !!hits(t, LIST);
['Scunthorpe', 'therapist', 'grape', 'Hancock', 'shiitake mushrooms', 'class assessment', 'Essex', 'cocktail party', 'Dickens', 'passion', 'bass guitar', 'analytics', 'Build Your Team', 'trust', 'ɛyɛ den', 'Nkwa ɛnyɛ', 'Ghana must go', 'twelve', 'Mumuni'].forEach((t) => ok('allowed: ' + t, !blocked(t)));
['fuck', 'FUCK you', 'f*ck', 'f**k', 'f u c k', 'fuuuuck', 'sh1t', 'shit', 'bullshit', 'a$$hole', 'b!tch', 'motherfucker', 'what the fucking hell', 'kwasia', 'Kwasea', 'wo maame', 'ashawo', 'You bastard'].forEach((t) => ok('blocked: ' + t, blocked(t)));
ok('every list entry blocks itself', lines.every((l) => blocked(l.replace(/^\*/, ''))), lines.filter((l) => !blocked(l.replace(/^\*/, ''))));

/* ---- words and text ---- */
const nw = live.normaliseWord;
ok('plural folds', nw('Teams') === 'team' && nw('Fears') === 'fear' && nw('Stories') === 'story' && nw('Business') === 'business' && nw('Focus') === 'focus');
ok('one or two words only', nw('time management') === 'time management' && nw('way too many words') === null && nw('') === null && nw('a') === null);
ok('display case', live.display('time management') === 'Time Management');
ok('clean strips angle brackets, controls and emoji but keeps ™ © and Twi letters', live.clean('Hi <b>there</b> 🚀👩🏾‍💻 ™ © ɔɛɖʋ\u0007', 100) === 'Hi b there /b ™ © ɔɛɖʋ', live.clean('Hi <b>there</b> 🚀👩🏾‍💻 ™ © ɔɛɖʋ\u0007', 100));
ok('clean caps length', live.clean('x'.repeat(500), 40).length === 40);

/* ---- the programme data the sponsor rule relies on ---- */
const slugs = new Set(live.DATA.people.map((p) => p.slug));
ok('every session speaker exists', live.DATA.sessions.every((s) => (s.people || []).every((x) => slugs.has(x))));
const sponsors = live.DATA.people.filter((p) => p.sponsor).map((p) => p.name + ' (' + p.sponsor + ')');
ok('sponsor representatives are flagged in the data', sponsors.length >= 3 && sponsors.some((s) => /MojoPay/.test(s)), sponsors);
ok('every session has a start time and a format', live.DATA.sessions.every((s) => s.start && (s.format || s.badge)));

/* ---- Akan Gold: a small accent on the audience-facing pages and cards only (as on the DMC Studio flyers) ---- */
const files = ['lib/live', 'api', 'tools/live-cards', 'assets'].flatMap((d) => {
  const dir = path.join(root, d);
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && /(live|_live).*\.(js|html|txt|css)$|^(phone|screen|control|cards|filter-core|blocklist)\./.test(e.name)).map((e) => path.join(dir, e.name));
}).concat([path.join(root, 'tools/live-cards-check.js'), path.join(root, 'tools/live-load-test.js')]);
/* D-09 (no gold on the room screens) was retired on 14 Nov 2026 at the organiser's request: every Live page now uses the flyers' look,
   where gold is an accent only (the pill's dot, the foil SCALE, hairlines). tools/sponsor-check.js caps its share of the projector's pixels. */
const GOLD_OK = new Set(['lib/live/phone.html', 'lib/live/screen.html', 'lib/live/control.html', 'tools/live-cards/cards.js', 'assets/live-cards.js', 'tools/live-cards-check.js']);
const goldIn = files.filter((f) => /c9a24a/i.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
ok('gold appears only on the Live pages and the card maker, as an accent (rule D-09 retired 14 Nov 2026)', goldIn.every((f) => GOLD_OK.has(f)), goldIn);
ok('gold is used on the phone page and the cards', ['lib/live/phone.html', 'tools/live-cards/cards.js'].every((f) => goldIn.indexOf(f) >= 0), goldIn);
const hex = new Set();
files.filter((f) => /\.(html|js)$/.test(f) && !/live-check|live-cards-check/.test(f)).forEach((f) => (fs.readFileSync(f, 'utf8').match(/#[0-9a-fA-F]{6}\b/g) || []).forEach((h) => hex.add(h.toUpperCase())));
const palette = new Set(['#1C1C1C', '#F4EFE6', '#2A7B74', '#D95F45', '#C9A24A', '#FFFFFF', '#000000', '#262626', '#303030', '#0500CC', '#A29F99',
  '#0D0D0D', '#5C9890', '#F5D87A', '#9E7520', '#E6C566']);   // the flyers' tokens: ink ground, the lighter teal used as text on obsidian, and the gold-foil gradient stops   // #0500CC is the MojoPay wordmark inside the embedded official logo file, never a Live colour; #A29F99 is the label cream flattened for email (sponsor/config.js)
ok('only brand colours and neutral greys appear as hex values', [...hex].every((h) => palette.has(h)), [...hex].filter((h) => !palette.has(h)));

console.log(passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
