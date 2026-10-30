# DMC 2026 stage backdrop: design hand-off (from the homepage code)

Everything here was read from the site's source (`index.html`, `assets/styles.css`, `assets/app.js`, `assets/fonts/`), not from screenshots. Measured values are from the rendered homepage at 1440 × 900 (the hero is then exactly 1440 × 900, under a 68 px nav).

## 1. Fonts

**One family does everything in the hero and nav: Archivo (variable font, weight 100–900, width 62–125).** No other family is used on the homepage hero. It is **self-hosted**, not loaded from Google Fonts.

| Where | Selector(s) | Size (≥1445 px wide) | Weight | Width (`wdth`) | Letter-spacing | Transform | Line-height | Colour |
|---|---|---|---|---|---|---|---|---|
| **BUILT TO / SCALE** headline | `.hero-h1`, `.hero-h1 .accent` | `clamp(60px, 9vw, 130px)` = 130 px | 900 | **125** (max, expanded) | -0.02em | uppercase | 0.88 | cream `#F4EFE6`; "SCALE" is the gold gradient (section 2) |
| **DMC 2026** | `.hero-h2` | `clamp(18px, 3vw, 40px)` = 40 px | 700 | 100 (default) | 0.04em | none (typed in caps) | normal | cream at 62% (`#9C9994` flat on ink) |
| Tracked line, **MARKETERS & ADVERTISERS NETWORK · GHANA** | `.hero-ey` | 10 px | 700 | 100 | 0.28em | uppercase | normal | cream 62% |
| Tracked line, **A M·A·N EVENT · BRITISH COUNCIL, ACCRA · SAT 21 NOV 2026** | `.hero-conf` (with `.hero-conf-sp`) | `clamp(11px, 1.2vw, 14px)` = 14 px | 600 | 100 | 0.18em | uppercase | normal | cream 62% |
| "POWERED BY" (MojoPay credit) | `.hero-conf.sp-credit span` | 14 px (same as the line above) | 600 | 100 | 0.18em | uppercase | normal | cream 62% |
| Pill, **DMC 2026 — BUILT TO SCALE · NOW OPEN** | `.hero-pill span` | 11 px | 600 | 100 | 0.14em | uppercase | normal | cream 65% (`#A3A09A`) |
| "SCROLL TO EXPLORE" | `.hero-scroll` | 10 px | 700 | 100 | 0.22em | uppercase | normal | cream 62% |
| Nav links (EVENTS, ABOUT MAN, …) | `.nav-item>a`, `.nav-item>button` | 11 px | 600 | **110** | 0.14em | uppercase | normal | cream 62% |
| Buttons (EXPLORE DMC 2026, PARTNER WITH US, REGISTER) | `.btn`, `.btn-f`, `.btn-cr` | 11 px | 700 | **110** | 0.12em | uppercase | normal | `.btn-f`: text `#1C1C1C` on gold `#C9A24A`; `.btn-cr`: cream text and border; padding 11 × 24 px, 1.5 px border |
| Text links (MAN SESSIONS ↗, JOIN COMMUNITY ↗) | `.btn-txt` | 11 px | 700 | 100 | 0.12em | uppercase | normal | cream 62%; "Join Community" is teal `#2A7B74` (inline style) |

Notes
- Width is set with `font-variation-settings: 'wdth' N`. The browser still reports `font-stretch: 100%`, because the variation setting wins; use the `wdth` value in this table.
- Fluid sizes shrink on narrow screens (headline min 60 px at ~670 px wide). For print, scale from the ≥1445 px column: headline 130 : "DMC 2026" 40 : event line 14 : small lines 10–11 (so the headline cap-height is about 3× the "DMC 2026" line and about 9× the event line).
- Headline wrapping on the site: `Built To<br>Scale`, and at the 760 px content width the expanded letters wrap to three lines: **BUILT / TO / SCALE**, lines 0.88 apart.
- `Archivo Black` (a separate file, `archivo-black.woff2`) exists in the repo but is **not used on the homepage**; it is only used on the DMC Live pages.

**Where it loads from**
- Self-hosted: `/assets/fonts/archivo-normal.woff2` (also `archivo-italic.woff2`, and `archivo-cedi.woff2` for the ₵ sign only), declared in `assets/styles.css` lines 2–4 with `font-weight:100 900; font-stretch:62% 125%; font-display:swap`, preloaded in `index.html` (`<link rel="preload" href="/assets/fonts/archivo-normal.woff2" as="font" type="font/woff2" crossorigin>`). There is no Google Fonts request anywhere on the page.
- Equivalent Google Fonts query (not used by the site, for installing the full family): `https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap`, specimen page https://fonts.google.com/specimen/Archivo, source https://github.com/Omnibus-Type/Archivo.

**Licence:** SIL Open Font License 1.1, © 2020 The Archivo Project Authors (Omnibus-Type). The licence text is in `fonts/Archivo-OFL-LICENSE.txt` (copied from the Fontsource package of the same font; the repo itself only states "Archivo is SIL OFL" in `docs/studio.md` and does not carry Archivo's licence file). Printing artwork set in Archivo is permitted under the OFL.

**Files in `fonts/`**
- `archivo-normal.woff2`: the site's file as served (web format; most design apps cannot install it).
- `Archivo-Variable-latin.ttf`: the same font data converted to an installable variable TTF (axes: `wght` 100–900, `wdth` 62–125; 216 Latin glyphs, default instance SemiBold). Enough for all the hero text. For a complete character set, install the full Archivo variable family from Google Fonts or GitHub (links above).

## 2. Colours

Design tokens (`:root` in `assets/styles.css`, line 7):

| Token | Hex | Used on the homepage hero for |
|---|---|---|
| `--ink` | `#0D0D0D` | **Hero background**; nav background (at 95%); the left-to-right fade over the pattern |
| `--ob` (Obsidian) | `#1C1C1C` | Page background below the hero; text on gold buttons; pattern shape `g4` |
| `--cr` (Signal Cream) | `#F4EFE6` | "BUILT TO" headline; cream text/borders at full strength; chip behind the MojoPay logo; pattern uses none |
| cream at alpha | `rgba(244,239,230, .62)` ≈ **`#9C9994`** flat on `#0D0D0D` | **Grey "DMC 2026"**, small tracked lines, nav links, "Powered by", scroll hint, text links |
| cream at alpha | `.65` ≈ `#A3A09A` | pill text |
| white at alpha | `rgba(255,255,255,.12)` ≈ `#2A2A2A` | pill border |
| `--go` (Akan Gold) | `#C9A24A` | "SCALE" (gradient base), gold buttons and the nav REGISTER button (fill/border), pill dot, pattern shape `g3` |
| `--te` (Build Teal) | `#2A7B74` | **COMMUNITY / JOIN COMMUNITY** (nav item highlight and the link under the buttons, inline `style="color:var(--te)"`), pattern shape `g1` |
| `--co` (Pulse Coral) | `#D95F45` | pattern shape `g2` |
| MojoPay blue | `#0500CC` | MojoPay logo (sits on a cream chip) |
| `--cedar` `#8B6040`, `--bronze` `#B8721D`, `--silver` `#6E8492` | | defined but not used in the hero (sponsor tiers elsewhere) |

The **kente strip** (`.kente`, a section divider, not in the hero) repeats 18 px blocks of gold, teal, coral, cream, each followed by 2 px of obsidian (`#1C1C1C`).

**"SCALE" gradient** (`.shimmer`, added to `.accent` by `assets/app.js`):
```css
background: linear-gradient(90deg, #C9A24A 0%, #F5D87A 30%, #C9A24A 55%, #9E7520 78%, #C9A24A 100%);
background-size: 250% auto;           /* gradient is 2.5× the word's width */
-webkit-background-clip: text; background-clip: text;
-webkit-text-fill-color: transparent;  /* the gradient shows only through the letters */
animation: shimmer 3.5s linear infinite;   /* slides background-position 250% → -250% */
```
Linear, 90° (left to right), 5 stops: gold `#C9A24A` 0%, light gold `#F5D87A` 30%, gold `#C9A24A` 55%, dark gold `#9E7520` 78%, gold `#C9A24A` 100%. On the site only a 40% window of it is visible at once and it slides, so any frame has gold with one bright and one dark band. For a still backdrop, apply the same five stops across the width of the word SCALE (or the whole headline block).

## 3. The angled shape pattern (right side of the hero)

**How it is made:** four absolutely-positioned `<div>`s (`.g1`–`.g4`) inside `.hero-geo`, each a solid colour cut with a CSS `clip-path: polygon(…)` in **percentages**, and a CSS keyframe animation that morphs each polygon and its opacity. No SVG, canvas or image. There is no blend mode (normal alpha compositing). A separate overlay `.hero-geo-fade` darkens the pattern's left edge. Markup is in `source-excerpts/hero.html`, rules in `source-excerpts/hero.css`.

Default state (the 0% keyframe, which is what you see on load). Coordinates are % of the pattern box; stacking order bottom → top:

| Layer | Colour | Opacity | polygon |
|---|---|---|---|
| g1 | Build Teal `#2A7B74` | 0.85 | 35% 0%, 100% 0%, 100% 55%, 10% 0% |
| g2 | Pulse Coral `#D95F45` | 0.80 | 20% 0%, 100% 40%, 100% 75%, 0% 95% |
| g3 | Akan Gold `#C9A24A` | 0.75 | 0% 70%, 100% 68%, 100% 100%, 0% 100% |
| g4 | Obsidian `#1C1C1C` | **0.50** (the animation overrides the inline 0.8) | 0% 85%, 60% 75%, 100% 100%, 0% 100% |

Fade overlay on top: `linear-gradient(to right, #0D0D0D 0%, rgba(13,13,13,.6) 50%, transparent 100%)` over the **whole hero**, so over the pattern box (the right half) it runs from 60% `#0D0D0D` at its left edge to 0% at its right edge. Behind everything: hero background `#0D0D0D`.

**Files**
- `hero-pattern.svg`: the desktop default (1440 × 900 hero → pattern box **720 × 900**), as on the site: `#0D0D0D` background + four polygons (pixel coordinates, `fill` + `fill-opacity`) + the left fade as an SVG `linearGradient`. Plain attributes only, no CSS, scripts or external references. Checked against the live page with the animation paused at its first frame: colours match within ±1/255, differences only in edge anti-aliasing.
- `hero-pattern-shapes-only.svg`: the same polygons with no background and no fade (transparent), for placing on your own backdrop colour.
- `hero-pattern-stretchable.svg`: the same as `hero-pattern.svg` but in a 0–100 unit viewBox with `preserveAspectRatio="none"`; set any width/height and it stretches exactly like the site's percentage polygons.

**Rules to redraw it at another aspect ratio**
1. The pattern box is the hero's **right 50% × full height** (`right:0; top:0; width:50%; height:100%`). The hero is at least `100vh` tall (88vh at ≤900 px). At 1920 × 1080 the box is 960 × 1080.
2. Every vertex is a percentage of that box, so x and y scale **independently** (the shapes stretch with the box; they are not rescaled uniformly). Multiply each % by the box width / height. A 24 × 8 ft backdrop is 3:1; if the pattern fills the right half it is a 12 × 8 ft box (1.5:1, a wider box than the site's 0.8:1, so the angles flatten); either keep the percentages (use the stretchable SVG) or redraw the angles to taste.
3. At ≤900 px wide the box becomes full width at 30% opacity (mobile only).
4. **Animation** (all `ease-in-out infinite`; the shapes drift between these states, so any frame is "on brand"):
   - g1, 22 s: 0/100% = default above; 50% = `27% 0%, 100% 0%, 100% 64%, 4% 0%` at opacity 0.70
   - g2, 30 s: 0/100% = default; 40% = `13% 0%, 100% 34%, 100% 82%, 0% 100%` at 0.90; 70% = `26% 0%, 100% 47%, 100% 68%, 0% 88%` at 0.72
   - g3, 17 s: 0/100% = default; 50% = `0% 61%, 100% 75%, 100% 100%, 0% 100%` at 0.58
   - g4, 24 s: 0/100% = default (0.50); 50% = `0% 80%, 55% 70%, 100% 100%, 0% 100%` at 0.38
   - With "reduced motion" the animation is off and the inline styles apply (same as the table except g4 opacity 0.80).

## 4. Logos

**There is no vector (SVG) version of the Marketers & Advertisers Network logo in the codebase.** The only MAN logo files are raster PNGs, and I found no vector original in Drive either (searched for SVG/AI/EPS logo files):
- `logos/man-logo.png`: **599 × 175 px**, transparent background, **white** artwork only (`#FFFFFF`). This is the nav logo (shown 164 × 48 px).
- `logos/man-mark-favicon-512.png`: 512 × 512 px, white mark on `#1C1C1C`.

At 599 px wide this will not print sharply at backdrop size (a 4 ft wide logo would be about 12 dpi), so the designer needs the original vector artwork (.ai/.svg/.eps) from whoever created the M·A·N logo. I did not auto-trace the PNG, so as not to invent artwork.

Also included: `logos/mojopay-logo-blue.svg`, the cleaned MojoPay logo (viewBox `0 0 1144.63 192.72`, fill `#0500CC`, 3.4 KB) used in the hero's "Powered by" credit. It sits on a Signal Cream `#F4EFE6` chip (padding 7 × 12 px) because the blue is hard to read on the dark background.

## 5. Files

```
backdrop-handoff/
  README.md                          this file
  hero-pattern.svg                   720×900, background + 4 shapes + fade (desktop default)
  hero-pattern-shapes-only.svg       same shapes, transparent
  hero-pattern-stretchable.svg       same, 0–100 viewBox, preserveAspectRatio="none"
  fonts/
    archivo-normal.woff2             site font file (web)
    Archivo-Variable-latin.ttf       installable variable TTF made from it
    Archivo-OFL-LICENSE.txt          SIL OFL 1.1
  logos/
    man-logo.png                     599×175 white PNG (no SVG exists)
    man-mark-favicon-512.png         512×512 PNG
    mojopay-logo-blue.svg            sponsor logo, cleaned
  source-excerpts/
    hero.html                        verbatim nav + hero markup from index.html
    hero.css                         verbatim CSS: fonts, tokens, nav, buttons, hero, keyframes, gradient
```
