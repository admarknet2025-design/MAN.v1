/* DMC Live word filter: the matching rules, shared by the server (api/_live.js) and the phone's card maker (bundled into
   assets/live-cards.js), so a takeaway is checked on the phone by exactly the code that checks it on the server.
   No dependencies. The list itself is lib/live/blocklist.txt plus whatever the operator adds in /live/control. */
'use strict';

function plain(s) {
  return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/ɔ/g, 'o').replace(/ɛ/g, 'e').replace(/ŋ/g, 'n').replace(/ɖ/g, 'd').replace(/ƒ/g, 'f').replace(/ʋ/g, 'v');
}
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '+': 't' };
/* lower-case, strip accents, undo common character swaps (f*ck, sh1t, a$$), keep letters and single spaces, cap repeated letters at two */
function squash(s) {
  return plain(s).split('').map((c) => LEET[c] || c).join('').replace(/[^a-z ]/g, '').replace(/ +/g, ' ').trim().replace(/(.)\1{2,}/g, '$1$1');
}
/* words as the filter sees them: "f u c k" (three or more single letters in a row) becomes one word */
function tokens(text) {
  const raw = squash(text).split(' ').filter(Boolean);
  const out = []; let run1 = [];
  const flush = () => { if (run1.length >= 3) out.push(run1.join('')); else run1.forEach((x) => out.push(x)); run1 = []; };
  raw.forEach((t) => { if (t.length === 1) run1.push(t); else { flush(); out.push(t); } });
  flush();
  return out;
}
const unrepeat = (t) => t.replace(/(.)\1+/g, '$1');

/* list lines (blocklist.txt format, comments already removed) -> entries the matcher uses */
function compile(lines) {
  return lines.map((w) => { const deep = w.charAt(0) === '*'; const t = deep ? w.slice(1) : w; return { w: squash(t), c: unrepeat(squash(t).replace(/ /g, '')), deep }; }).filter((x) => x.c);
}

/* An entry matches a whole word, or that word with a common ending (fucks, fucking, bitchy, shitty), so "Scunthorpe", "therapist",
   "grape" and "Hancock" are safe. Entries starting with "*" are the worst words and match anywhere inside a word. Entries with a space
   ("wo maame") match as a phrase. Returns the entry that matched, or "". */
const ENDINGS = new Set(['', 's', 'es', 'ed', 'er', 'ers', 'ing', 'in', 'ings', 'y', 'ie', 'ies', 'ier', 'iest', 'ish', 'up', 'off', 'face', 'head', 'hole', 'wit']);
function hits(text, list) {
  /* masked swear words (f*ck, f**k, sh#t): a masking symbol stands for any letter, so "f**k" is checked against "fuck" */
  const masked = String(text).toLowerCase().split(/\s+/).filter((t) => /[*#%_]/.test(t) && /[a-z]/.test(plain(t)));
  for (const tok of masked) {
    const re = new RegExp('^' + plain(tok).replace(/[^a-z*#%_]/g, '').replace(/[*#%_]/g, '.') + '$');
    for (const e of list.words) { if (e.w.indexOf(' ') < 0 && e.w.length >= 3 && re.test(e.w)) return e.w; }
  }
  return hits1(text, list);
}
function hits1(text, list) {
  const toks = tokens(text).map(unrepeat);
  const phrase = squash(text);
  for (const e of list.words) {
    if (e.w.indexOf(' ') > 0) { if (phrase.indexOf(e.w) >= 0) return e.w; continue; }
    if (e.deep) { if (toks.some((t) => t.indexOf(e.c) >= 0)) return e.w; continue; }
    if (toks.some((t) => t === e.c || (t.indexOf(e.c) === 0 && ENDINGS.has(t.slice(e.c.length))))) return e.w;
  }
  return '';
}

module.exports = { plain, squash, tokens, compile, hits };
