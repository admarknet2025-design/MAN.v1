# DMC Studio (`/studio`)

A team tool for on-brand DMC 2026 social artwork with trackable links. Pick a template, enter the details, and get the
artwork in every platform size, a caption per platform, and one tracked short link per platform.

- Address: `https://mangh.org/studio`. Not linked anywhere on the site, `noindex`, disallowed in `robots.txt`.
- Login: HTTP Basic auth, the same `ADMIN_USER` / `ADMIN_PASSWORD` as `/admin/attribution`. If either variable is missing the
  route answers 503 instead of opening up.

## Templates
| Template | Inputs | Accent |
|---|---|---|
| Speaker / panelist | Pick from the site's speaker list or the M·A·N team (name, title, company, photo, session and time fill in) or type; role (Speaker, Panelist, Host, Moderator, Emcee); movement | Movement colour (session bar) |
| I'm attending | Name, title, company, photo, optional "I'm building…" line; the M·A·N team can be picked | Teal |
| Sponsor / partner | One of the seven partners on the site, or a custom name with an uploaded logo. Name, logo, tier, role only; no quotes or claims | Teal |
| Quote card | Quote (260 characters), speaker name, title, company, photo | Movement colour |
| Countdown | Nothing. "X days to go" is worked out each time an image is rendered (Accra date, event day 21 Nov 2026) | Coral |
| Early bird | Price (default GH₵100, from the ticket page) and last day (default 2026-10-31). "N days left" is worked out each time an image is rendered; on the last day it says LAST DAY, and after it the Studio refuses to render. Check the price and date against the ticket page whenever they change | Coral number, gold tag |
| Session card | A row of the programme (or custom): title, time, speakers (their site photos appear as a row of faces) | Movement colour |

Movement colours: Build Yourself = Teal, Build Your Team = Coral, Build Your Work = Cream. Anything else is Teal. They colour the session bar, session chip and quote rule; the tag chips are gold.

All templates share one frame (header with the M·A·N logo, kente divider, date/venue/site footer, corner triangles) in `lib/studio/render.js`, so they look like a set.

## Sizes and files
One click renders seven files (five sizes; the story size is rendered three times, each with its own QR code):

| File suffix | Size | Use | QR |
|---|---|---|---|
| `ig-feed` | 1080×1350 | Instagram and Facebook feed | none |
| `ig-story` | 1080×1920 | Instagram story | Instagram link |
| `wa-status` | 1080×1920 | WhatsApp status | WhatsApp link |
| `tiktok-cover` | 1080×1920 | TikTok and Reels covers | TikTok link |
| `square` | 1080×1080 | Square | none |
| `linkedin-link` | 1200×627 | LinkedIn and Facebook link posts | none |
| `x` | 1600×900 | X | none |

Names look like `dmc26_speaker_isaac-newton-acquah_ig-feed.png`. "Download all" gives a ZIP of the seven PNGs plus a
`…_captions.txt` with every caption and tracked link.

Story, WhatsApp status and TikTok art keep clear of the platform's top (200 px) and bottom (290 px) overlays. The QR sits in the bottom
right corner above the footer.

## Rendering
Images are drawn **on the server** (`api/studio-render.js` → `lib/studio/render.js`) with `@napi-rs/canvas` (Skia), using static
Archivo files embedded in `lib/studio/fonts/` (Archivo Regular, Medium, SemiBold, Bold, and Expanded ExtraBold and Black, cut from
the site's variable font with fontTools and with the cedi sign ₵ from the site's cedi font merged in; Archivo is SIL OFL). The same code and fonts run for everyone, so a PNG is identical whoever
asks for it. A full set takes about a second.

Dependencies are in `package.json` (`@napi-rs/canvas`, `qrcode-generator`); Vercel installs them on deploy.
`vercel.json` includes the fonts, speaker photos, partner logos and the M·A·N logo in the render function and redirects `/lib/*` and
`/package*.json` away from the public site.

## Photos
- Site speakers and the M·A·N team load their existing site photo into the cropper. Anyone else: **Upload photo**, then drag and zoom.
- The crop is made in the browser (800×800 JPEG) and sent only to render. **Uploaded photos stay in the browser** unless "Save to
  library" is ticked. The Studio asks for a tick on "I have this person's permission to use their photo" before it will render an
  uploaded photo, and "Save to library" only unlocks after that tick.
- The library lives in the same Redis store as the attribution log (`lib:v1:*`, photos as 480×480 JPEG data URLs). People can be
  removed from the list in the Studio.
- **Background removal is not included.** The only free option that runs locally is a roughly 40 MB in-browser model fetched
  from a third-party CDN, which would add an outside dependency to a team tool, so it was left out.

## Tracked links
For each artwork the Studio asks `/api/studio-links` for six links (Instagram, Facebook, LinkedIn, X, TikTok, WhatsApp):
`https://mangh.org/t/<code>`. The code maps to `{ person slug, template, platform, campaign }`; asking again for the same
combination returns the same code, so regenerating does not create new ones.

`/t/<code>` (`api/t.js`):
1. logs the click (code, time, device class `mobile`, `desktop` or `in-app`; no IP address or personal data) to the store;
2. answers `302` to `/dmc-2026?ref=<slug>&utm_source=<platform>&utm_medium=social&utm_campaign=<template>`;
3. link-preview crawlers (WhatsApp, Facebook, LinkedIn, X, Slack, Telegram and so on) are redirected but **not counted**.
   An unknown code goes to `/dmc-2026`.

The ticket checkout (`assets/ticket-checkout.js`) already saves `ref` and `utm_*` when the page opens and logs them when
MojoTickets reports an order started, so a person's click and their checkout starts line up on `ref`, `utm_source`
(platform) and `utm_campaign` (template). Slugs: speakers and the team use the photo name (`isaac-newton-acquah`), partners their
partner slug, sessions their programme id (`s04`), attendees a slug of the name, countdown and early bird use their own name.

If the store is not configured the Studio still renders: the images have no QR and the captions carry the plain page link, with a
warning that those clicks are not tracked.

## Captions
Tone (professional, friendly, high energy) and length (short, standard) are chosen once; each platform gets its own caption with
`#DMC2026 #BuiltToScale`, the platform handle, and the tracked link. Instagram and TikTok say "Link in bio" (Instagram also points
to the QR on the story) and show the tracked link to put in the bio. Handles: X `@mangh`; Instagram, Facebook and TikTok `@admarknet`;
LinkedIn `linkedin.com/company/mangh`. X captions drop to the short form if they would pass 280 characters. Sponsor captions state
only name, tier and role.

## Dashboard (`/admin/attribution`)
Now also shows clicks and checkouts started **by person, by platform, by template** and as a person × platform × template table,
plus the 200 most recent clicks. **Download summary CSV** (`/admin/attribution-summary.csv`: person, platform, template, clicks,
checkouts_started) sits next to the existing checkouts CSV. "Started per click" is a guide, not a sales rate: *checkout started* never
means *paid*. Match order references with MojoPay's paid-orders export.

## Environment variables (Vercel, Preview and Production)
| Name | Purpose |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) | Redis store for links, clicks, checkouts and the photo library. Upstash for Redis from the Vercel Marketplace, free plan |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Team login for `/studio` and `/admin/attribution` |

To set up the store (about two minutes, free): Vercel dashboard → project `man-v1` → **Storage** → **Create database** → **Upstash for Redis**
(Marketplace) → **Free** plan → connect it to the project for **Production, Preview and Development**. Vercel then adds `KV_REST_API_URL`
and `KV_REST_API_TOKEN` (the code reads those, or the `UPSTASH_REDIS_REST_*` pair). From a terminal the same thing is
`vercel integration add upstash` in the linked project. Add `ADMIN_USER` and `ADMIN_PASSWORD` under Settings → Environment Variables,
then redeploy so the new variables are picked up. Nothing is provisioned by this branch. Free-plan usage: a click is about 4 commands, a new set about 20.

## Retention (matches /privacy)
Ticket-order records, click records, tracked-link records and their counters are deleted automatically by **21 November 2027**
(12 months after DMC 2026): `api/_store.js` sets an expiry on every key it writes (`KEEP_UNTIL`). Saved library photos are the exception:
they stay until someone removes the person in the Studio. If the retention period changes, change `KEEP_UNTIL` and the wording on `/privacy` together.

## Colours and the touch of gold
Obsidian, Signal Cream, Build Teal and Pulse Coral carry the artwork. Akan Gold (#C9A24A) is a **touch**, as on the public "Make
Your Flyer": the fourth kente segment, the photo ring, the speaker/sponsor tag, the "Built To Scale" label, the thin wedge under the
corner triangles, the slim bar down the left edge, the quote mark and the edge lines of the partner band. It is never a large fill and
is never used as text on cream. `node tools/studio-check.js` renders every template at every size (without photos or uploaded logos) and
fails if gold-like pixels cover more than 3 % of any image (today the most is about 2.4 %), or if the gold colour appears anywhere
outside `lib/studio/render.js`. The Studio's own page (`/studio`) and the dashboard stay gold-free.

## Sponsor and partner band
Every image ends with the band the public flyer has, with the roles the site gives each company: **Title sponsor** MojoPay and
"Organised by" M·A·N, then **Sponsors and partners** FIDO, Generation Ghana, mNotify, Kasad3, Tech Labari and Koin Photography
(logos from `assets/partners26/`, each on a cream tile). Feed and story use two rows; square and the wide sizes use one row. To change
the line-up, edit `BAND_PARTNERS` and the title-sponsor line in `lib/studio/render.js`.

## Keeping the data current
Speakers, programme rows, the team and partners come from `lib/studio/data.json`, generated from `dmc-2026.html` and `index.html`:

    node tools/build-studio-data.js

Run it whenever the speaker or programme markup changes (for example when a photo is added).

## Data needed from the team
- Photos for Simon Alangdee and Ian Hutchful (until then their cards use initials), and the keynote speaker once announced.
- Larger partner logos: Kasad3's file is 163×129 pixels and looks soft at story size. MojoPay, FIDO and the rest are fine.
- A decision on the sponsor tier wording for mNotify and Koin Photography (the cards use "Programme Partner" and "Event Photography Partner", copied from the home page).
