# DMC Live

The in-event participation system for DMC 2026 (Saturday 21 November 2026, British Council, Accra). No app, no login, no ticket check. Everything is a page on mangh.org.

| Route | For | Access |
|---|---|---|
| `/live` | attendees' phones | public, noindex |
| `/live/screen` | the projector (16:9, full screen) | public, unlinked, noindex |
| `/live/control` | the operator (laptop or phone) | team login (`ADMIN_USER` / `ADMIN_PASSWORD`) |

Operator instructions: [live-operator-guide.md](live-operator-guide.md). This page is for whoever maintains the code.

## What it does

1. **Now & Next.** Current and next session from the site's own programme data (`lib/studio/data.json`, built from `dmc-2026.html` by `tools/build-studio-data.js`). The operator advances by hand (clock times are not locked). The quote-card button is always on the phone.
2. **Word clouds**, one per movement. Prompts editable. One or two words, three per phone per cloud, normalised (case, spaces, simple plurals), filtered before display. Animated cloud on the screen sized by frequency, in the movement's accent colour. Finale shows all three.
3. **Ask the panel.** 280 characters, optional name or "Anonymous", one upvote per phone per question, moderation queue (approve, reject, pin, answered), one Q&A per session, Interview mode (top three, large).
4. **Live polls** (2 to 5 options) and **Swing** (before/after pair; the screen shows the per-device shift, for example "34% changed their minds").
5. **Build Wall.** "What are you building?" (120 characters), optional contact with an opt-in tick box for the What I Built card. Approved entries scroll on the screen. CSV export.
6. **Quote cards.** Official quotes (verified by the operator, with speaker name, title, photo) and "My takeaway" cards (the attendee's own words, attributed to them). Three layouts, two sizes, drawn on the phone.

Brand rules enforced in code and by `tools/live-check.js`: Obsidian `#1C1C1C`, Signal Cream `#F4EFE6`, Build Teal `#2A7B74`, Pulse Coral `#D95F45`, Archivo (expanded, heavy), kente-strip dividers. Akan Gold (`#C9A24A`) is a small accent only, as on the DMC Studio flyers (added at the team's request on 26 October; the original brief said none): the fourth kente segment on every strip, the ring round the speaker photo or initials on cards, the opening quote mark on dark card panels, the tag chips on the screen, and the rings on the phone's speaker initials. It never fills a large area (cards are tested to stay under 3%), and the operator panel and the server stay gold-free, like the Studio's own page. Each movement has a fixed accent: Build Yourself teal, Build Your Team coral, Build Your Work cream.

## Realtime: why polling, not a hosted realtime service

**Recommendation: short polling with edge-cached reads, on the Vercel and Upstash setup the site already uses.** Nothing new to buy, host or sign up for.

- Phones and screens `GET /api/live-state` every 2 seconds (plus jitter, backing off when the connection is bad and pausing when the tab is hidden). The response carries `Cache-Control: public, s-maxage=1, stale-while-revalidate=2`, so Vercel's edge answers almost every poll, and the function runs about once a second per edge location whatever the audience size.
- Every change (a submission or an operator action) increments a `ver` counter. The function keeps its last answer per `ver`, so a rebuild happens only when something changed.
- A change reaches phones within about two to three seconds (cache one second, poll every two). That meets the "within 3 seconds" target without a socket.
- Phones send small JSON only, queue in `localStorage`, retry with a key so a retry never counts twice, and show "Sending…".

Compared with hosted realtime on a free tier (checked October 2026): Ably free allows 200 concurrent connections, Pusher Sandbox 100, Supabase Realtime free 200. The target is 250 phones plus 2 screens plus 2 operators, so each would need a paid plan, a second account, or fall over on the day. Polling has no connection ceiling, no extra vendor in the privacy notice, and degrades gracefully on weak Wi-Fi (a missed poll is just a late poll). The cost of polling is Redis command volume, handled below. If the programme later needs sub-second updates (a game show, a live buzzer), add a hosted realtime channel for that activity only, using the `takeover` slot below.

## Redis command budget (the thing to watch)

Upstash's free plan allows 500,000 commands a month. Design choices that keep Live inside it:

- Public state is rebuilt once per `ver` per function instance and cached at the edge for a second.
- The operator panel's heavy view (programme, queues, polls, quotes) is rebuilt once per `ver`; each poll otherwise costs five light reads.
- Heartbeats ("people connected") are sent every 2 minutes, not every poll.
- Per-device counters and idempotency markers use `EXPIREAT`, so nothing lingers.
- Only sessions that have questions are read by the panel (`qsess` set).

**Measured** (`tools/live-load-test.js`, local server with a simulated edge cache and a counting fake of the store; 250 phones, 2 screens, 2 operators, 10 minutes, the whole programme compressed into those 10 minutes: three clouds, Q&A, a before/after poll, the wall, about 470 quote cards, and an operator approving everything within seconds):

| | |
|---|---|
| Requests | 76,413 (127 a second), no errors; the only non-200 answers were intended per-device limits (429) and "already closed" (409) |
| Phones seeing an operator action | p50 1.6 s, p95 2.8 s, p99 3.1 s, 983 of 983 actions reached 95% of phones |
| Function time per request | p50 1 to 9 ms, p99 under 35 ms |
| Redis commands, busy (everything above) | about 6,900 a minute |
| Redis commands, audience idle (phones just polling and sending heartbeats) | about 500 a minute |

What that means for the 500,000-a-month free allowance: an idle five-hour day is about 150,000 commands, and each busy minute like the test costs about 7,000. Ninety busy minutes plus the rest idle comes to roughly 700,000, so **the free plan will probably not cover the event day plus the rehearsal.** The measurement is local: Vercel runs several edge locations and function instances, so the real count will be somewhat higher (each warm instance keeps its own cache), which the rehearsal will show on Upstash's usage page.


**This is the one thing that may need a paid plan.** Upstash's pay-as-you-go plan is about US$0.20 per 100,000 commands; a heavy event day is well under US$1, but it needs a card on the account and a budget cap. It has **not** been enabled. Decide before the rehearsal; the rehearsal itself will use part of the free allowance.

## Architecture

```
phone (/live)         ──GET /api/live-state (edge-cached 1 s)──▶  api/live-state.js ─┐
phone                 ──POST /api/live-submit (small JSON)─────▶  api/live-submit.js ├─▶ api/_live.js ─▶ Upstash Redis (live:v1:*)
screen (/live/screen) ──GET /api/live-state?view=screen────────▶  api/live-state.js ─┤     (shared with api/_store.js)
operator (/live/control) ─GET/POST /api/live-control (basic auth)▶ api/live-control.js ┘
pages: api/live-page.js serves lib/live/{phone,screen,control}.html (rewrites in vercel.json)
card maker: assets/live-cards.js (lazy, ~100 KB, fonts + QR + filter inside); screen QR: assets/live-qr.js
```

Functions on the Vercel Hobby plan are limited to 12; Live adds four (page, state, submit, control), making 11.

- **`api/_live.js`** shared logic and the key list. **`api/_live-seed.js`** rehearsal data. **`lib/live/filter-core.js`** the word filter, shared by the server and the phone's card maker so a takeaway is checked by the same code in both places. **`lib/live/blocklist.txt`** the editable list (English plus starter Ghanaian and Nigerian slang that needs a native-speaker review); the operator can add words live in Words → Extra blocked words.
- **Device identity**: a random id in `localStorage`, stored on the server only as a salted hash (`LIVE_SALT`, optional), with an expiry 30 days after the event. First names stay on the phone until used.
- **Abuse controls**: per-device limits (three words per cloud, one question per 15 seconds, one vote per question, one poll answer, three Build Wall entries, one takeaway per 4 seconds), a coarse per-network limit that tolerates a whole room on one Wi-Fi, the filter on everything, and moderation before anything but a filter-passing cloud word reaches a screen. Emoji and angle brackets are stripped from all text.
- **The sponsor rule** is enforced on the server, not just hidden in the panel: a quote whose speaker is marked as a sponsor's representative (in the programme data, or ticked by the operator) cannot be published without "Sponsor-approved", editing it withdraws the approval, and every public view filters it again. A takeaway card never names a sponsor's representative.
- **Takeover slot.** Phone and screen each have a `takeover` state (`TAKEOVERS` in `phone.html`, the same in `screen.html`) that, when set, replaces the activity with a full-screen handler. No handler exists yet. A later "Session 05" feature registers one without touching the rest.

## Environment variables

| Name | Needed | Notes |
|---|---|---|
| `ADMIN_USER`, `ADMIN_PASSWORD` | yes | already set for `/studio`; must be enabled for **Preview** as well as Production to use the preview's `/live/control` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | yes | already set (Upstash) |
| `LIVE_SALT` | optional | any random string; changes how device ids are hashed. Set it once before the event and keep it |

Nothing is committed. Without the Upstash variables `/api/live-state` answers 503 and the pages show "Reconnecting…".

## Privacy and retention

No tracking beyond the existing analytics. Device hashes and everything else expire 30 days after the event (`EXPIREAT`). Build Wall entries (with the opt-in contacts for the What I Built card) are kept 90 days after the event, then deleted; contacts are only in the wall CSV and only when the person ticked the box. Quote cards are never uploaded; a "My takeaway" card sends its text, first name and a small (about 20 KB) preview for moderation. `/privacy` has a "DMC Live, at the event" section.

## Testing

| Command | What it proves |
|---|---|
| `node tools/live-check.js` | word filter (false positives and evasions), normalisation, programme data, gold only where allowed, palette |
| `node tools/live-cards-check.js [dir]` | 114 card renders (shortest and longest text, long names, no photo, each movement colour, three layouts, both sizes), no text cut, gold under 3% of every card, a contact sheet, phone/server filter parity |
| `tools/live-dryrun.js` | all six features through the real phone, operator and screen pages, with screenshots |
| `tools/live-offline-check.js` | first load under 150 KB, offline outbox, card maker offline |
| `tools/live-a11y-check.js` | axe-core on every phone state, screen mode and operator tab |
| `tools/live-load-test.js` | 250 phones, 2 screens, 2 operators, 10 minutes, with latency, propagation time and Redis command counts |

The Playwright and load tools need a running site and the team login in `ADMIN_USER` / `ADMIN_PASSWORD`; they reset the store first, so never point them at the live event. **Rehearsal mode** (Setup → Start rehearsal data) fills the store with fake sessions, speakers' quotes (prefixed "[Rehearsal]"), words, questions, polls and wall entries, and stamps every phone, screen and card with REHEARSAL until "Reset everything".

## Rebuilding the card maker

`assets/live-cards.js` and `assets/live-qr.js` are built from `tools/live-cards/cards.js` (with `lib/live/filter-core.js`, `lib/live/blocklist.txt`, the font subsets in `tools/live-cards/fonts/` and `qrcode-generator`):

```
npm i --no-save esbuild && node tools/build-live-cards.js
```

Then bump `?v=` on the script tags in `lib/live/phone.html` and `lib/live/screen.html` (assets are cached for a year). The fonts are subsets of the Archivo files in `lib/studio/fonts` (OFL) plus a few Noto Sans glyphs for Ghanaian letters; they are embedded so cards render the same with no connection.

## Known limits

- Edge caching and Upstash behaviour are measured locally with a simulated edge; confirm on the Vercel preview during the rehearsal.
- The word-filter slang list is a starting point and needs review by Twi, Ga and Ewe speakers; the operator can add words live.
- Photos exist for most speakers; a speaker with no photo gets a monogram on official cards.
- One operator action at a time: two operators pressing different buttons at once is fine, but they see each other's changes only after the next poll (about 2.5 seconds).
