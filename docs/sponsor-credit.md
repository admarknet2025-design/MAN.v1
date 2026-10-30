# Sponsor credit: Powered by MojoPay, Tickets exclusively on MojoLife

Contract basis (Schedule C; clauses 8.2, 8.3, 8.4, 11.2): the MojoPay credit appears on all event marketing (flyers, social graphics, emails) and on all digital screens, MojoLife is named as the exclusive ticketing platform in all communications, and the logos are never altered, misused or misrepresented.

One shared lockup draws it everywhere, so every DMC 2026 asset matches the homepage hero. **MojoLife is named in words only: the line "Tickets exclusively on MojoLife". No MojoLife logo is drawn on any asset** (team decision), and nothing stands in for one.

## What every asset carries
| Element | Content |
|---|---|
| Lockup | POWERED BY + the MojoPay wordmark (`assets/partners26/mojopay-logo-blue.svg`, original blue `#0500CC`) on a cream tile |
| Ticket line | the text "Tickets exclusively on MojoLife" (two lines in narrow spaces, one on the projector), bold Archivo, in the tile row beside the lockup; no logo, no tile |

Label style is the homepage hero's (`.hero-conf` at 1440 wide): Archivo 600, 14 px, +0.18em tracking, uppercase, `rgba(244,239,230,.62)`. The tile is Signal Cream `#F4EFE6` with the hero's padding (12 px sides, 7 px top and bottom at a 26 px logo), and every other measurement scales from the tile width in the same proportions (`geometry()` in `assets/sponsor/lockup.js`). Two shapes: **horizontal** (label left of the tile, the hero's; used on the projector) and **stacked** (label above, for narrow spaces: flyer footer, Studio band, cards).

The hero's tile is cream, not white. If MojoPay confirm a pure white tile, change `TILE_COLOUR` in `assets/sponsor/config.js` and every asset follows.

## Files
- `assets/sponsor/config.js`: every constant. Minimums (marked "Defaults pending MojoPay Branding Guidelines"): MojoPay tile at least **16% of artwork width** on feed sizes, **22% on 9:16**, never under **140 px**; ticket-line text at least **1.4% of the artwork width** (never under 12 px).
- `assets/sponsor/lockup.js`: geometry, canvas drawing (browser and Node/Skia), the ticket line, HTML for the projector, the minimum-size check.
- `assets/sponsor/email.js`: the email footer.

Logo protection is structural: only the files named in `config.js` are drawn; they are never recoloured, stretched, cropped or rotated, always sit on the whole tile, and keep their aspect ratio. Clear space round a lockup is the height of the "m" in the wordmark (`clearSpace()`). The official SVG is untouched on disk; the renderers add a width and height to the copy they draw.

## Where it is drawn
| Asset | How |
|---|---|
| DMC Studio, every template and size | `frame()` in `lib/studio/render.js` (templates cannot opt out); sizes 1080×1350, 1080×1920, 1080×1080, 1200×627, 1600×900 |
| Make Your Flyer (`/dmc-2026#flyer`) and the speaker flyers | `assets/flyer.js` footer: "ORGANIZED BY", then the two lockups; replaced "PRESENTING PARTNER" |
| DMC Live quote cards | `tools/live-cards/cards.js` (rebuild with `node tools/build-live-cards.js`) |
| `/live/screen` | fixed bottom-left corner, outside the changing view |
| Link previews | `tools/og-dmc.js` → `assets/og-dmc-2026.png` (dmc-2026 and press pages), `assets/og-home-dmc-2026.png` (home page). `assets/og-image.png` is shared with non-DMC pages and is untouched |
| Emails | `assets/sponsor/email.js`: `renderEmail({ html, text })` appends the footer (MojoPay logo on the cream tile, the line "Tickets exclusively on MojoLife", the event details) to the HTML and plain-text parts, so a message cannot leave it out. No email is sent by this repo today; whatever sends DMC 2026 email must pass its message through `renderEmail()`. The logo is `assets/sponsor/mojopay-logo-blue-email.png`, a 600 px PNG of the official SVG (mail clients do not draw SVG) |
| "What I Built" cards | not built; see `docs/live.md` for the requirement |
| Captions | flyer, speaker-flyer, Studio and Live captions end "Tickets exclusively on MojoLife · mangh.org/dmc-2026…" |

## MojoLife logo
Not used. If the team later wants the official MojoLife logo beside the line, it needs the official file from MojoPay and a change to `lockup.js` (a tile at the MojoPay tile's height); until then the text line is the whole MojoLife credit.

## Test
`node tools/sponsor-check.js [outdir]` renders every Studio template at every size, the Live cards (every layout, both sizes, each movement colour), the flyer, the link previews and the projector page (several views at two sizes); it fails if a lockup is missing, a MojoPay tile is under the minimum, the MojoLife tile height differs, the ticket line is missing or too small, any MojoLife logo is drawn, a tile does not look like the official one in the pixels, an email lacks the MojoPay logo or "Tickets exclusively on MojoLife" (HTML and text parts), or Akan Gold appears on the projector page. It writes contact sheets to `outdir`.

## Gold
Gold is allowed on web, social and phone assets (flyer, Studio, Live phone and cards). `/live/screen` keeps rule D-09: no Akan Gold on the room screens.
