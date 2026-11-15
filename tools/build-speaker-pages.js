#!/usr/bin/env node
/* Builds one profile page per DMC 2026 speaker, at mangh.org/speakers/<slug>, so a social post about a speaker can link
 * straight to them. Run it after the speaker cards or the programme change, after build-studio-data.js:
 *
 *   node tools/build-studio-data.js && node tools/build-speaker-pages.js && python3 tools/stamp-assets.py
 *
 * Who gets a page: people in lib/studio/data.json with a `page` (speakers and panelists; build-studio-data.js decides).
 * What it reads: the speaker cards on dmc-2026.html (name, role line, bios, photo) and data.json (session, time, level),
 * so nothing about a speaker is typed twice. It copies the nav, sticky ticket bar and footer from dmc-2026.html.
 *
 * What it writes:
 *   speakers/<slug>.html               the page (served at /speakers/<slug> because vercel.json has cleanUrls)
 *   assets/speakers/og/<slug>.jpg      its link preview (1200x627): the DMC Studio Speaker artwork, LinkedIn size,
 *                                      so the preview carries Powered by MojoPay and the partner band like all Studio art
 *   dmc-2026.html                      a "Speaker profile" link on each of those speakers' cards
 *   sitemap.xml                        one <url> per page
 * Pages for people who no longer have a `page` are deleted, so the folder always matches the list. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/studio/data.json'), 'utf8'));
const SITE = 'https://mangh.org';
const TICKETS = 'https://tickets.mojo-pay.com/events/digital-marketers-conference-2026';
const OUT = path.join(ROOT, 'speakers');
const OG = path.join(ROOT, 'assets/speakers/og');

const dec = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LEVEL = { 'Build Yourself': 'yourself', 'Build Your Team': 'team', 'Build Your Work': 'work' };
const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);

/* the profile links this script adds to the cards come out first, so reruns start from the same markup */
let html = fs.readFileSync(path.join(ROOT, 'dmc-2026.html'), 'utf8').replace(/<a class="sp-page"[^>]*>[^<]*<\/a>/g, '');
const cut = (from, to, incl) => { const a = html.indexOf(from), b = html.indexOf(to, a); if (a < 0 || b < 0) throw new Error('dmc-2026.html has changed shape near ' + from); return html.slice(a, b + (incl ? to.length : 0)); };

/* pieces of dmc-2026.html reused on every page */
const gtag = html.slice(0, html.indexOf('<title>'));
const icons = (html.match(/<link rel="(?:icon|apple-touch-icon)"[^>]*>\n/g) || []).join('');
const chrome = cut('<a class="skip-link"', '<main id="main" tabindex="-1">', true);
const footer = cut('<footer>', '</footer>', true);

/* the speaker cards, keyed by name */
const grid = cut('<div class="sp-grid">', '<p class="sp-note');
const cards = {};
grid.split('\n').filter((l) => l.indexOf('<div class="spc ') >= 0).forEach((line) => {
  const name = dec((line.match(/<div class="spn">([\s\S]*?)<\/div>/) || [])[1]);
  if (!name) return;
  const img = line.match(/<img src="\/assets\/speakers\/([^"]+)"[^>]*width="(\d+)" height="(\d+)"/) || [];
  cards[name] = {
    line,
    cat: (line.match(/<div class="spc-cat">([\s\S]*?)<\/div>/) || [])[1] || '',
    role: (line.match(/<div class="sp-role">([\s\S]*?)<\/div>/) || [])[1] || '',
    bio: (line.match(/<div class="sp-bio">([\s\S]*?)<\/div>/) || [])[1] || '',
    full: ((line.match(/<details class="sp-more">[\s\S]*?<\/summary>([\s\S]*?)<\/details>/) || [])[1] || '').trim(),
    photo: img[1], w: img[2], h: img[3]
  };
});

const speakers = DATA.people.filter((p) => p.page).map((p) => {
  const c = cards[p.name];
  if (!c) throw new Error('no speaker card for ' + p.name);
  const row = DATA.sessions.find((s) => s.title === p.session && s.people.indexOf(p.slug) >= 0) || {};
  const kind = row.badge === 'Panel' ? 'Panelist' : row.badge === 'Keynote' ? 'Keynote Speaker' : 'Speaker';
  return Object.assign({}, p, { c, row, kind, url: SITE + p.page, file: p.page.replace(/^\/speakers\//, '') });
});

function sessionLine(s) {
  const t = s.row.start ? s.row.start + '–' + s.row.end : s.sessionTime;
  return { title: s.session || 'DMC 2026', time: t };
}

function page(s, others, ogFile, ogVer) {
  const sl = sessionLine(s);
  const lvl = LEVEL[s.movement] || (s.row.badge === 'Keynote' ? 'keynote' : ''); /* the keynote sits outside the levels: Akan Gold */
  const titleTxt = s.name + ' · ' + s.kind + ' · DMC 2026';
  const who = [s.title, s.company].filter(Boolean).join(', ');
  const desc = s.name + (who ? ' (' + who + ')' : '') + ' speaks at DMC 2026 — Built To Scale: ' + sl.title + ', ' + sl.time +
    ', Sat 21 Nov 2026, British Council Accra. Tickets GH₵ 150, exclusively on MojoLife.';
  const ogImg = SITE + '/assets/speakers/og/' + ogFile + '?v=' + ogVer;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Person', '@id': s.url + '#person', name: s.name, url: s.url,
    image: SITE + '/assets/speakers/' + s.c.photo, jobTitle: s.title || undefined,
    worksFor: s.company ? { '@type': 'Organization', name: s.company } : undefined,
    description: dec(s.c.bio) || undefined,
    performerIn: { '@id': SITE + '/dmc-2026#event' }
  };
  const bio = s.c.full || (s.c.bio ? '<p>' + s.c.bio + '</p>' : '');
  const more = others.map((o) => '<li><a class="spk-o" href="' + o.page + '"><img src="/assets/speakers/' + o.c.photo + '" alt="" width="' + o.c.w +
    '" height="' + o.c.h + '" loading="lazy" decoding="async"><span class="spk-on">' + esc(o.name) + '</span><span class="spk-os">' + esc(o.kind) +
    ' · ' + esc(sessionLine(o).time) + '</span></a></li>').join('');
  return `${gtag}<title>${esc(titleTxt)} | M·A·N</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${s.url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#1C1C1C">
${icons}<meta property="og:type" content="profile">
<meta property="og:site_name" content="Marketers &amp; Advertisers Network">
<meta property="og:locale" content="en_GH">
<meta property="og:title" content="${esc(s.name + ' · ' + s.kind + ' at DMC 2026 — Built To Scale')}">
<meta property="og:description" content="${esc(sl.title + ' · ' + sl.time + ' · Sat 21 Nov 2026, British Council Accra. Tickets GH₵ 150, exclusively on MojoLife.')}">
<meta property="og:url" content="${s.url}">
<meta property="og:image" content="${ogImg}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="627">
<meta property="og:image:alt" content="${esc(s.name + ', ' + s.kind + ' at DMC 2026 — Built To Scale. 21 November 2026, British Council Accra.')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(s.name + ' · ' + s.kind + ' at DMC 2026')}">
<meta name="twitter:description" content="${esc(sl.title + ' · ' + sl.time + ' · Sat 21 Nov 2026, British Council Accra.')}">
<meta name="twitter:image" content="${ogImg}">
<link rel="preload" href="/assets/fonts/archivo-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/styles.css">
<link rel="stylesheet" href="/assets/speaker-page.css">
<script type="application/ld+json">
${JSON.stringify(ld, null, 1)}
</script>
</head>
<!-- Generated by tools/build-speaker-pages.js from dmc-2026.html and lib/studio/data.json. Do not edit by hand. -->
<body data-page="dmc26">
<div id="page-dmc26" class="page active">
${chrome}

<section class="spk-sec">
  <div class="c">
    <a class="spk-back" href="/dmc-2026#speakers">← All DMC 2026 speakers</a>
    <article class="spk" itemscope itemtype="https://schema.org/Person">
      <div class="spk-photo"><img src="/assets/speakers/${s.c.photo}" alt="${esc(s.name)}" width="${s.c.w}" height="${s.c.h}" fetchpriority="high" decoding="async" itemprop="image"></div>
      <div class="spk-info">
        <span class="spk-kind">${esc(s.kind)} · DMC 2026</span>
        <h1 itemprop="name">${esc(s.name)}</h1>
        ${s.c.role ? '<p class="spk-role">' + s.c.role + '</p>' : ''}
        <div class="spk-sess${lvl ? ' lv-' + lvl : ''}">
          ${s.movement ? '<span class="spk-lvl">' + esc(s.movement) + '</span>' : ''}
          <span class="spk-st">${esc(sl.title)}</span>
          <span class="spk-sw">Sat 21 Nov 2026 · ${esc(sl.time)} · British Council, Accra</span>
        </div>
        <div class="spk-bio" itemprop="description">${bio}</div>
        <div class="spk-cta">
          <a class="btn btn-f" href="${TICKETS}" target="_blank" rel="noopener noreferrer">Get Tickets — GH₵ 150 →</a>
          <a class="btn btn-cr" href="/dmc-2026#programme">Full Programme</a>
          <button type="button" class="btn btn-cr spk-share" data-url="${s.url}" data-title="${esc(s.name + ' at DMC 2026 — Built To Scale')}">Share this page</button>
        </div>
        <p class="spk-copied" role="status" aria-live="polite"></p>
      </div>
    </article>
  </div>
</section>

<div class="kente"></div>

<section class="spk-more">
  <div class="c">
    <h2>More DMC 2026 speakers</h2>
    <ul class="spk-list">${more}</ul>
  </div>
</section>

</main>
${footer}
</div>
<script src="/assets/analytics.js" defer></script>
<script src="/assets/ticket-checkout.js" defer></script>
<script src="/assets/app.js" defer></script>
<script src="/assets/speaker-page.js" defer></script>
</body>
</html>
`;
}

async function ogImage(s) {
  const R = require(path.join(ROOT, 'lib/studio/render'));
  const { createCanvas, loadImage } = require('@napi-rs/canvas');
  const sl = sessionLine(s);
  const png = await R.render({ template: 'speaker', size: 'linkedin-link', sitePhoto: s.c.photo,
    fields: { name: s.name, title: s.title, company: s.company, role: s.kind === 'Panelist' ? 'Panelist' : 'Speaker', session: sl.title, time: sl.time, movement: s.movement } });
  const img = await loadImage(png);
  const cv = createCanvas(img.width, img.height);
  cv.getContext('2d').drawImage(img, 0, 0);
  return cv.toBuffer('image/jpeg', 88);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(OG, { recursive: true });
  const keep = new Set();
  for (const s of speakers) {
    const jpg = await ogImage(s);
    fs.writeFileSync(path.join(OG, s.file + '.jpg'), jpg);
    const others = speakers.filter((o) => o !== s);
    fs.writeFileSync(path.join(OUT, s.file + '.html'), page(s, others, s.file + '.jpg', hash(jpg)));
    keep.add(s.file);
  }
  for (const f of fs.readdirSync(OUT)) if (/\.html$/.test(f) && !keep.has(f.replace(/\.html$/, ''))) fs.unlinkSync(path.join(OUT, f));
  for (const f of fs.readdirSync(OG)) if (/\.jpg$/.test(f) && !keep.has(f.replace(/\.jpg$/, ''))) fs.unlinkSync(path.join(OG, f));

  /* a "Speaker profile" link on each speaker's card on /dmc-2026 (removed first, so reruns don't duplicate it) */
  for (const s of speakers) {
    const line = s.c.line, end = line.lastIndexOf('</div></div>');
    const fresh = line.slice(0, end) + '<a class="sp-page" href="' + s.page + '">Speaker profile →</a>' + line.slice(end);
    if (html.split(line).length !== 2) throw new Error('card not unique for ' + s.name);
    html = html.replace(line, () => fresh);
  }
  fs.writeFileSync(path.join(ROOT, 'dmc-2026.html'), html);

  /* sitemap */
  const smP = path.join(ROOT, 'sitemap.xml');
  let sm = fs.readFileSync(smP, 'utf8').replace(/ *<url><loc>https:\/\/mangh\.org\/speakers\/[^<]*<\/loc>[^\n]*\n/g, '');
  const today = new Date().toISOString().slice(0, 10);
  sm = sm.replace('</urlset>', speakers.map((s) => '  <url><loc>' + s.url + '</loc><lastmod>' + today + '</lastmod></url>\n').join('') + '</urlset>');
  fs.writeFileSync(smP, sm);
  console.log(speakers.length + ' speaker pages: ' + speakers.map((s) => s.page).join(' '));
})().catch((e) => { console.error(e.message); process.exit(1); });
