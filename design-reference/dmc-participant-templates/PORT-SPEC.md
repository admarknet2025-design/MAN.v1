# DMC 2026 — Participant Templates · Port Spec · Round 2

Source of truth: `DMC Badge.dc.html` and `DMC Brief.dc.html`. States board: `DMC 2026 Templates.dc.html` (tabs: Badge 4:5, Badge 9:16, Brief 4:5, Brief 9:16, Partner rows, Gloss review). Round 1 is kept as `DMC Badge R1.dc.html`, `DMC Brief R1.dc.html` and `DMC 2026 Port Spec R1.md`.

Conventions are the same as round 1. Units are px on a 1080-wide canvas, rects are **x, y, w, h**, and text **y is the top of the CSS line box**. Canvas baseline: `baseline = y + LH/2 + (A − D)/2`, where A and D are `fontBoundingBoxAscent/Descent`. Tracking: `ctx.letterSpacing = em × size + 'px'`. Anything not restated here (name fitting, role truncation, QR rules, Badge nameplate formula, R1 §0 field rules) is **unchanged from round 1**.

---

## 0. Global

### 0.1 Type: Archivo only, with four pinned axis settings

| Pin | Style | wdth | wght | Used for |
|---|---|---|---|---|
| **D** | normal | 125 | 900 | BUILT / TO, level word, CREATIVE BRIEF, Brief headline, APPROVED, monogram |
| **DI** | **italic (true italic face)** | 125 | 900 | SCALE |
| **B** | normal | 100 | 500 / 600 / 700 / 800 | all body text and labels, name (800), role (500) |
| **BI** | italic | 100 | 500 | 9:16 Badge tagline only |

- SCALE uses the **true italic** from Archivo's `ital` axis. It is not a skew. Its advance is identical to the roman (4.291em).
- Canvas: set `ctx.fontStretch = 'expanded'` **after** assigning `ctx.font`, because assigning `ctx.font` resets it. Or pin static woff2 files for D, DI, B (500–800) and BI.
- The webfont request uses the axis ranges `0,100..125,500..900;1,100..125,500..900`. Only the values in the table are ever rendered.

**Measured advances** (DOM, Chrome, tracking −0.02em included):

| String | Pin | @100px | Badge 4:5 @76 | Badge 9:16 @86 | Brief @72 |
|---|---|---|---|---|---|
| BUILT | D | 371.7 (3.717em) | **282.5** | **319.7** | — |
| TO | D | 181.5 (1.815em) | **137.9** | **156.1** | — |
| SCALE | DI | 429.1 (4.291em) | **326.1** | **369.0** | — |
| BUILT TO SCALE | D + DI | 1036.3 | — | — | 746.1 |
| DMC 2026 | D | 642.4 | — | — | 462.5 |

Other measured widths: CREATIVE BRIEF D@40 = 434.0. Level words D@100: MYSELF 543.9, MY TEAM 619.3, MY WORK 645.3. Pill "DMC 2026 · ACCRA" B600@30 tr .16 = 349.5. Eyebrow "DIGITAL MARKETERS’ CONFERENCE" B700@20 tr .28 = 528.9, @18 = 476.0. "British Council, Accra" B600@32 = 318.7. "Sat 21 Nov 2026, 10:00 AM" B600@32 = 394.9.

### 0.2 Palette

Round-1 tokens are unchanged. The added values all come from the website hero:

| Token | Value | Use |
|---|---|---|
| Hero ink | `#0D0D0D` | Ground (Badge, Brief 9:16, Brief 4:5 header band) |
| Foil light | `#F5D87A` | SCALE foil stop only |
| Foil dark | `#9E7520` | SCALE foil stop only |
| Cream α | `rgba(244,239,230,α)` | Pill α .72, eyebrow α .60, tile label α .65, tagline α .72 |
| Tile fill | `rgba(255,255,255,.05)` (= `#191919` on ink) | Info tiles |
| Tile rule | `rgba(201,162,74,.18)` | Info tile top border |
| Pill border | `rgba(255,255,255,.12)` | Pill |

The obsidian partner band (`#1C1C1C`) and round-1 neutrals are unchanged. Gloss uses white and black alpha only (§7).

---

## 1. The hero element (planes, fade, foil)

The planes come from `02-HERO-ELEMENT-SPEC.md`, rest state, and are copied verbatim into `assets/hero-geo.svg`. The templates draw **g1 and g2 only** (see Decision D1).

| Layer | Fill | α | Polygon (% of container) |
|---|---|---|---|
| g1 | `#2A7B74` | .85 | 35 0 · 100 0 · 100 55 · 10 0 |
| g2 | `#D95F45` | .80 | 20 0 · 100 40 · 100 75 · 0 95 |
| ~~g3~~ | `#C9A24A` | .75 | dropped |
| ~~g4~~ | `#1C1C1C` | .80 | dropped |
| Fade | linear, `(x,0) → (x+w,0)` | — | 0: `#0D0D0D` α1 · 0.5: α.6 · 1: α0 |

**Container rect and absolute polygons per format.** Use `drawHeroGeo(ctx, x, y, w, h)` from the hero spec, and skip layers 3 and 4.

| Format | Container x, y, w, h | g1 (px) | g2 (px) |
|---|---|---|---|
| Badge 4:5 | 540, 0, 540, 1110 | (729,0) (1080,0) (1080,610.5) (594,0) | (648,0) (1080,444) (1080,832.5) (540,1054.5) |
| Badge 9:16 | 540, 0, 540, 1356 | (729,0) (1080,0) (1080,745.8) (594,0) | (648,0) (1080,542.4) (1080,1017) (540,1288.2) |
| Brief 4:5 (header band) | 576, 0, 504, 196 | (752.4,0) (1080,0) (1080,107.8) (626.4,0) | (676.8,0) (1080,78.4) (1080,147) (576,186.2) |
| Brief 9:16 (backdrop) | 540, 0, 540, 1356 | as Badge 9:16 | as Badge 9:16 |

Every container is `right:0; top:0` and ends at the kente strip (or at the header band on Brief 4:5), so the planes never touch the partner band. **No text is drawn inside any container rect.** Clearances are in §6.

**Foil (SCALE).** Fill the text with `createLinearGradient(tx, 0, tx + span, 0)`. Stops: 0 `#C9A24A` · .30 `#F5D87A` · .55 `#C9A24A` · .78 `#9E7520` · 1 `#C9A24A`. `span = advance + 0.08em`, which covers the italic overhang (the DOM uses `padding-right:.08em` with `background-clip:text`). Badge 4:5: tx 64, span 332.2. Badge 9:16: tx 64, span 375.9. This is one static frame of the site shimmer.

**Headline.** Pins D and DI, LH = 0.85 × size, tracking −0.02em, uppercase. BUILT and TO are Cream `#F4EFE6`. SCALE is foil.

---

## 2. The Badge · 4:5 (1080×1350)

**Layer order:** ground → planes → fade → strap → strap shading [E] → crimp sheen [S] → stitches → left column → card cast shadow [H] → card → cream sheen [S] → slot → slot inner shadow [E] → slot lip [E] → colour block → photo or monogram → photo sheen [S] → corner glare [S] → photo hi/lo lines [E] → rim + top specular [E] → cut-out with shadow [H] → clip contact shadow [H] → hardware → hardware specular [E] → nameplate → kente → band.
[S] = sheen, [E] = edge, [H] = shadow group (§7).

| Element | x | y | w | h | Font / size / LH | Colour |
|---|---|---|---|---|---|---|
| Ground | 0 | 0 | 1080 | 1350 | — | `#0D0D0D` |
| Planes + fade | 540 | 0 | 540 | 1110 | §1 | — |
| Strap | 644 | 0 | 144 | 244 | strap pattern, 100% | — |
| Stitches L / R | 651 / 779 | 0 | 2 | 236 | dash [6,6] | Cream α.55 |
| Pill box | 64 | 48 | ≈431 (auto) | 58 | border 2, pad 0 28, square corners | border `rgba(255,255,255,.12)` |
| · Gold dot | 94 | 71 | 12 | 12 | circle | `#C9A24A` |
| · Pill text | 120 | 48 | 349.5 | 58 | B600 30 / LH 30, tr .16em, centred vertically | Cream α.72 |
| Eyebrow | 64 | 130 | ≤320 | 56 | B700 20 / 28, tr .28em, two lines "DIGITAL MARKETERS’" / "CONFERENCE" | Cream α.60 |
| BUILT | 64 | 214 | 282.5 | 64.6 | D 76 / 64.6 | `#F4EFE6` |
| TO | 64 | 278.6 | 137.9 | 64.6 | D 76 | `#F4EFE6` |
| SCALE | 64 | 343.2 | 326.1 | 64.6 | DI 76 | foil |
| "I’M BUILDING" | 64 | 444 | — | 28 | B800 24 / 28, tr .06em | level text |
| Level word | 64 | 474 | ≤320 (MY WORK 296.8) | 46 | D 46 / 46 | level text |
| Info tile ×3 | 64 | 552 / 622 / 692 | 320 | 68 | top rule 2px | fill `rgba(255,255,255,.05)`, rule `rgba(201,162,74,.18)` |
| · Tile label | 82 | tile + 11.5 | — | 15 | B700 15 / 15, tr .2em: DATE / TIME / VENUE | Cream α.65 |
| · Tile value | 82 | tile + 32.5 | ≤284 | 26 | B800 24 / 26: "Sat 21 November 2026" / "10AM – 3PM" / "British Council" | `#F4EFE6` |
| QR tile | 64 | 788 | 132 | 132 | r8, pad 10 | `#F4EFE6` |
| QR modules | 74 | 798 | 112 | 112 | ECC M | `#1C1C1C` |
| "SCAN TO / REGISTER" | 216 | 800 | — | 48 | B700 18 / 24, tr .14em | `#B9B4AB` |
| URL | 64 | 940 | 220 | 22 | B600 22 / 22 | `#F4EFE6` |
| Hashtags | 64 | 980 | — | 56 | B600 22 / 28, two lines | `#B9B4AB` |
| Card | 416 | 344 | 600 | 736 | roundRect r28 | `#F4EFE6` |
| Slot | 656 | 364 | 120 | 18 | r9 | `#1C1C1C` |
| Colour block / photo | 436 | 408 | 560 | **Hb** | r18, cover (0.5, 0.3) | level fill |
| Monogram | centred in block | | | | D 180, ≤2 initials | level ink |
| Cut-out (pop-out) | 436 | 312 | 560 | Hb + 96 | clip rect, contain, bottom-centre | — |
| Hardware | 636 | 233 | 160 | 150 | `assets/lanyard-hardware.svg` | — |
| Hardware specular | 636 | 233 | 160 | 150 | `assets/hardware-specular.svg` × E | white |
| Nameplate | 444 | 408 + Hb + 24 | 544 | — | as R1 (chip, name, role, session) | as R1 |
| Kente | 0 | 1110 | 1080 | 24 | pattern | — |
| Band | 0 | 1134 | 1080 | 216 (16.0%) | §6 | `#1C1C1C` |

`plateH` and `Hb` are as R1: `Hb = 736 − 64 − plateH`. Short state: Hb = 432. Long state: Hb = 360.

---

## 3. The Badge · 9:16 (1080×1920)

Same layer order. Safe zones: y < 250 holds planes, strap and hardware only. y ≥ 1580 holds hashtags and weave only.

| Element | x | y | w | h | Font / size / LH | Colour |
|---|---|---|---|---|---|---|
| Ground | 0 | 0 | 1080 | 1920 | — | `#0D0D0D` |
| Planes + fade | 540 | 0 | 540 | 1356 | §1 | — |
| Strap / stitches | 672 (679 / 807) | 0 | 144 | 200 (192) | as R1 | — |
| Pill box | 64 | 250 | ≈402 | 56 | border 2, pad 0 24, gap 12 | as 4:5 |
| · Dot / text | 90 / 114 | 272 / 250 | 12 / 326.2 | 12 / 56 | B600 **28**, tr .16em | `#C9A24A` / Cream α.72 |
| Eyebrow | 64 | 334 | — | 56 | as 4:5 | Cream α.60 |
| BUILT / TO / SCALE | 64 | 420 / 493.1 / 566.2 | 319.7 / 156.1 / 369.0 | 73.1 | D / D / DI 86, LH 73.1 | Cream / Cream / foil |
| Tagline | 64 | 672 | 376 | 102 (3 lines) | BI 26 / 34, “…building.” | Cream α.72 |
| "I’M BUILDING" | 64 | 812 | — | 28 | B800 24 / 28, tr .06em | level text |
| Level word | 64 | 842 | ≤376 (MY WORK 335.6) | 52 | D 52 / 52 | level text |
| Info tiles | 64 | 926 / 996 / 1066 | 376 | 68 | as 4:5 | as 4:5 |
| QR tile / modules | 64 / 74 | 1166 / 1176 | 132 / 112 | — | as 4:5 | — |
| "SCAN TO / REGISTER" | 216 | 1178 | — | 48 | as 4:5 | `#B9B4AB` |
| URL | 216 | 1256 | 220 | 22 | B600 22 | `#F4EFE6` |
| Card | 472 | 300 | 544 | 1040 | r28 | `#F4EFE6` |
| Slot / lip | 684 / 694 | 320 / 338 | 120 / 100 | 18 / 2 | — | — |
| Block | 492 | 364 | 504 | Hb = 1040 − 64 − plateH | r18 | level fill |
| Cut-out | 492 | 268 | 504 | Hb + 96 | — | — |
| Hardware (+ specular) | 664 | 189 | 160 | 150 | — | — |
| Nameplate | 500 | 364 + Hb + 24 | 488 | — | as R1 | — |
| Kente | 0 | 1356 | 1080 | 24 | — | — |
| Lower fill | 0 | 1380 | 1080 | 540 | — | `#1C1C1C` |
| Band content | 0 | 1380 | 1080 | 200 (10.4%) | §6 | — |
| Hashtags | 64 | 1604 | — | 28 | B600 28, "#DMC2026  ·  #BuiltToScale" | `#B9B4AB` |
| Weave field | 0 | 1660 | 1080 | 260 | field pattern, offset y −220, α .6 | — |

---

## 4. The Brief · 4:5 (1080×1350)

**Layer order:** paper → header band → planes → fade → pill → CREATIVE BRIEF → paper sheen [S] → paper edge highlight [E] → body text and rules → rows → headshot (shadow [H], print sheen [S], top line [E]) → clip + clip highlight [E] → stamp (matte) → footer → kente → band.

All body coordinates are given absolute. The body origin is (64, 196) and its width is 952.

| Element | x | y | w | h | Font / size / LH | Colour |
|---|---|---|---|---|---|---|
| Paper | 0 | 0 | 1080 | 1350 | — | `#F4EFE6` |
| Header band | 0 | 0 | 1080 | 196 | — | `#0D0D0D` |
| Planes + fade | 576 | 0 | 504 | 196 | §1 | — |
| Pill | 64 | 40 | ≈431 | 58 | as Badge 4:5 (text 30) | — |
| "CREATIVE BRIEF" | 64 | 122 | 434.0 | 40 | D 40 / 40 | `#F4EFE6` |
| Eyebrow | 64 | 226 | 476.0 | 18 | B700 18 / 18, tr .28em, one line | `#5A5650` |
| "JOB NO. DMC-2026" | right at 1016 | 226 | 210.1 | 18 | B700 18, tr .14em | `#5A5650` |
| Headline line 1 | 64 | 262 | 746.1 | 61.2 | D 72 "BUILT TO " + DI 72 "SCALE", LH 61.2 | `#1C1C1C` |
| Headline line 2 | 64 | 323.2 | 462.5 | 61.2 | D 72 "DMC 2026" | `#D95F45` |
| Gold rule | 64 | 404 | 952 | 2 | — | `#C9A24A` |
| Rows block | 64 | 406 | 952 | — | label column 220, gap 16, **value x 300** | — |
| Row rules | 64 | row bottom − 1.5 | 952 | 1.5 | — | `#C9A24A` (gold hairline) |
| Row labels | 64 | CLIENT: row y + 28; others centred | — | 20 | B700 20, tr .14em | `#2A7B74` |
| CLIENT chip / name / role / session | 300 | row y + 20 / + 70 / name bottom + 8 / role bottom + 10 | Vw | — | as R1 | as R1 |
| Headshot frame | 848 | 426 | 160 | 192 | rotate 3° about centre, pad 8, photo 144×176 | `#FFFFFF` |
| Clip outer / inner | 886 / 893 | 408 / 424 | 26 / 12 | 84 / 54 | stroke 5 r13 / stroke 4 r6, rotate 3° | `#8E8A84` |
| OBJECTIVE tag chip | 300 | centred | auto | 44 | B700 26 / 1, pad 0 16, square | level fill / ink |
| CHANNEL tag chip | 300 | centred | ≈142 | 34 | B700 16, tr .14em, "IN PERSON", 1.5 border, pad 0 12 | `#1C1C1C` |
| CHANNEL value | chip + 14 | centred | 318.7 (ends ≈769) | 40 | B600 32 / 40, "British Council, Accra" | `#1C1C1C` |
| BUDGET value | 300 | centred | 283.1 | 40 | B600 32, "GH₵{ticketPrice}, approved" | `#1C1C1C` |
| DEADLINE value | 300 | centred | 394.9 (ends 695) | 40 | B600 32 | `#1C1C1C` |
| TURNAROUND value | 300 | centred | 347.2 | 40 | "5 hours. No extensions." | `#1C1C1C` |
| Stamp | 820 | BUDGET centre − 40 | 200 | 80 | rotate −6° about centre, α .92. Outer stroke 5 r8; inner stroke 1.5 r4 inset 8; "APPROVED" D 24 at +17; "DMC 2026 · 21.11.26" B700 13 tr .14em at +48 | `#D95F45`, matte |
| QR tile | 64 | 988 | 112 | 112 | r8, 2px `#1C1C1C` border, pad 8 → modules 92 | `#F4EFE6` |
| "SCAN TO REGISTER" | 200 | 996 | — | 18 | B700 18, tr .14em | `#2A7B74` |
| URL | 200 | 1026 | — | 26 | B600 26 | `#1C1C1C` |
| Hashtags | 200 | 1070 | — | 22 | B600 22 | `#5A5650` |
| Kente / band | 0 | 1110 / 1134 | 1080 | 24 / 216 | §6 | — |

**Row geometry** (rows run 406 → 980; the footer starts at 988):

```
Vw         = photo ? 528 : 716
roleLines  = measure(role, 500 34) > Vw ? 2 : 1;  if roleLines = 2 and Hc(2) + 5×52 > 574 → roleLines = 1
Hc         = max(photo ? 240 : 0, 20 + 36 + 14 + round(lines × size × 1.02) + 8 + roleLines × 40 + (session ? 44 : 0) + 20)
rowH       = clamp(floor((574 − Hc) / 5), 52, 64)
row n y    = 406 + Hc + (n − 1) × rowH
```

---

## 5. The Brief · 9:16 (1080×1920)

| Element | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Ground | 0 | 0 | 1080 | 1920 | `#0D0D0D` |
| Planes + fade | 540 | 0 | 540 | 1356 | replaces the R1 weave backdrop |
| Pill | 64 | 250 | ≈431 | 58 | text 30 |
| "CREATIVE BRIEF" | 64 | 332 | 434.0 | 40 | D 40, Cream |
| Sheet cast shadow | 40 | 404 | 1000 | 932 | r6, shadow 0 / 10 / blur 30 / `rgba(0,0,0,.52 × H)` |
| Sheet | 40 | 404 | 1000 | 932 | `#F4EFE6` r6 |
| Body origin | 88 | 404 | 904 | — | Every row of §4 from Eyebrow to Hashtags, at body-relative offsets (§4 y − 196); Hashtags move to y 1604 |
| Eyebrow / job no. | 88 / right at 992 | 434 | — | 18 | — |
| Headline | 88 | 470 / 531.2 | — | 61.2 | — |
| Gold rule | 88 | 612 | 904 | 2 | — |
| Rows | 88 | 614 | 904 | — | **label column 196**, gap 16 → **value x 300**. Vw = photo ? 504 : 692. Same Hc / rowH formula (574) |
| Headshot / clip | 824 / 862, 869 | 634 / 616, 632 | — | — | as 4:5, shifted |
| Stamp | 796 | BUDGET centre − 40 | 200 | 80 | right edge 996 |
| QR / labels | 88 / 224 | 1196 / 1216, 1248 | 112 | — | — |
| Kente / lower fill | 0 | 1356 / 1380 | 1080 | 24 / 540 | `#1C1C1C` |
| Band content | 0 | 1380 | 1080 | 200 | §6 |
| Hashtags | 64 | 1604 | — | 28 | `#B9B4AB` |
| Weave field | 0 | 1660 | 1080 | 260 | α .6, offset y −220 |

---

## 6. Partner band (shared, flat, never glossed)

Rows 1 and 2 are as R1 §5. "POWERED BY" sits with the unaltered blue MojoPay on a white tile (300 wide, the largest logo). "ORGANIZED BY" sits with the white M·A·N logo.

| Row | Tile w | Gap | Row w | x positions | Logos |
|---|---|---|---|---|---|
| **Six** (`partners7 = false`) | **148** | 12 | 948 | 64 + i × 160 | FIDO · mNotify · Generation Ghana · Kasad3 · Tech Labari · Mista.Koin |
| **Seven (default)** (`partners7 = true`) | **125** | 12 | 947 | 64 + i × 137 | the six + Jobberman |

Tiles are 58 h on 4:5 (y 1272) and 54 h on 9:16 (y 1508), with r6, fill `#FFFFFF`, logo pad 8/12 and contain fit. Kasad3 uses pad 4/12 with cover fit. Band share: 16.0% (4:5) and 10.4% (9:16).

**Interim logos:** MojoPay (fill `#0500CC` set by us), M·A·N, FIDO and Mista.Koin (cropped from the old flyer).

**Clearance from text to planes** (no text is on any plane): Badge 4:5 pill ends at x 495 (container at 540, 45 clear). Badge 9:16 pill ends at 466 (74). Brief 4:5 CREATIVE BRIEF ends at 498, against container 576 (78). Brief 9:16 CREATIVE BRIEF ends at 498, against 540 (42). Left-column text is always ≤ x 440.

---

## 7. Gloss

**Principle:** a flat world with glossy objects. The planes, headline, pill, tiles, QR, partner band and stamp get no gloss. Every gloss layer is built from white or black alpha only.

### 7.1 The GLOSS constant

```js
const GLOSS = {            // multipliers = ctx.globalAlpha per layer group
  off:      { sheen: 0,    edge: 0,    shadow: 0    },
  soft:     { sheen: 0.45, edge: 0.45, shadow: 0.6  },
  standard: { sheen: 0.7,  edge: 0.75, shadow: 0.85 },   // default
  high:     { sheen: 1,    edge: 1,    shadow: 1    }
};
```

The base alphas below are the **high** values. They already respect the caps (cream ≤ 0.20, photo ≤ 0.12), so no setting can exceed them. At standard, the peak sheen is 0.14 on cream and 0.084 over the photo. For shadow layers, the multiplier scales the shadow colour's alpha.

### 7.2 Badge gloss layers

Card-local coordinates: (0, 0) is the card's top-left. The card is W×H (600×736 or 544×1040). The block is at (20, 64), size bw × Hb. "135° linear" means `createLinearGradient(cx, cy, cx + D, cy + D)` with `D = (W + H)/2`, so `t = (x + y)/(W + H)`. This is identical to CSS `linear-gradient(135deg …)`.

| # | Layer | Group | Clip | Gradient / shape | Stops (t : α) | Blur | Offset |
|---|---|---|---|---|---|---|---|
| 1 | Card cast shadow | H | none (drawn under card) | fill card roundRect with shadow | `rgba(0,0,0,.58)` | 56 | 0, 32 |
| 2 | Card contact shadow | H | none | same, second pass | `rgba(0,0,0,.36)` | 10 | 0, 6 |
| 3 | Clear-coat band, cream | S | card roundRect r28 | 135° linear, white | s0 : 0 · s0+120 : **.20** · s0+240 : 0 | — | — |
| 4 | Hairline streak, cream | S | card | same gradient | s0+296 : 0 · s0+300 : **.20** · s0+304 : 0 | — | — |
| 5 | Clear-coat band + streak, photo | S | block roundRect r18 | same geometry as 3 and 4, in card coords | peaks **.12** | — | — |
| 6 | Photo corner glare | S | block | radial at block (0, 0), r = 0.2 × bw (112 / 100) | 0 : .12 → 1 : 0 | — | — |
| 7 | Photo top highlight | E | block | 1px line at block y 0 | white .40 | — | — |
| 8 | Photo bottom shadow | E | block | 1px line at block y Hb − 1 | black .32 | — | — |
| 9 | Plastic rim | E | card | stroke roundRect inset 1, width 2, r27; linear (0,0) → (W,H) in bbox | 0 : w .60 · .38 : w 0 · .62 : k 0 · 1 : k .22 | — | — |
| 10 | Top-edge specular | E | card | stroke path: arc of top-left radius (r26.5) + top edge to x 420 (4:5) / 380 (9:16), width 2, round cap; linear (0 → path w) | 0 : w .90 · .55 : w .35 · 1 : w 0 | — | — |
| 11 | Slot inner shadow | E | slot r9 | 7px vertical gradient from slot top | 0 : k .70 → 1 : k 0 | — | — |
| 12 | Slot lip highlight | E | none | rect slot.x+10, slot.y+18, 100×2; horizontal | 0 : w 0 · .5 : w .90 · 1 : w 0 | — | — |
| 13 | Strap cylinder | E | strap rect | horizontal across 144 | 0 : k .42 · .22 : k 0 · .42 : w .12 · .60 : w 0 · .76 : k 0 · 1 : k .46 | — | — |
| 14 | Crimp sheen | S | strap rect, bottom 72px | vertical | 0 : w 0 → 1 : w .18 | — | — |
| 15 | Hardware specular | E | none | `assets/hardware-specular.svg` (crimp bevel, two rivet glints, ring arc, clip edge, bail) | as drawn (w .35–.90) | — | — |
| 16 | Clip contact shadow | H | none | radial ellipse 80×18, centre (hw.x + 80, hw.y + 147) | 0 : k .45 → .7 : k 0 | — | — |
| 17 | Pop-out cut-out shadow | H | cut-out rect | shadow on `drawImage(cutout)` | `rgba(0,0,0,.40)` | 12 | 0, 12 |

**Keeping the band off the face.** The face zone is the block's x 20–80% and y 0–60%. Its largest x + y is `faceMax = 20 + 0.8·bw + 64 + 0.6·Hb`. The band starts at `s0 = faceMax + 80`, so band and streak are always further down-right than any face pixel. Short 4:5 (Hb 432): s0 = 871 → t .652 / .742 / .832, streak .875–.881. Short 9:16 (Hb 736): s0 = 1009 → t .637 / .713 / .789, streak .824–.829.

**Draw order rule:** sheen layers are drawn before all nameplate text and before the chip.

### 7.3 Brief gloss layers

| Layer | Group | Clip | Gradient | Stops | Blur / offset |
|---|---|---|---|---|---|
| Paper sheen (4:5) | S | 0,196,1080,914 | 135° linear | .06 : 0 · .22 : **.14** · .38 : 0 | — |
| Sheet sheen (9:16) | S | sheet roundRect r6 | 135° linear | same | — |
| Paper edge (4:5) | E | — | 1px line at y 196 | white .80 | — |
| Sheet edge (9:16) | E | sheet | 1px line along top (white .80) + 1px along left (white .50) | — | — |
| Sheet cast shadow (9:16) | H | — | — | `rgba(0,0,0,.52)` | 30 / 0, 10 |
| Headshot shadow | H | — | rotated frame | `rgba(28,28,28,.26)` | 14 / 0, 6 |
| Headshot print sheen | S | photo 144×176 | 135° linear | .70 : 0 · .77 : **.20** · .84 : 0 (lower-right corner, off the face) | — |
| Headshot top line | E | photo | 1px | white .50 | — |
| Clip highlight | E | — | inset capsule strokes 1.5px, top and left only (24×82 r12 and 10×52 r5) | white .75 / .70 | — |
| Stamp | — | — | **matte, no gloss** | — | — |

At standard, the Brief paper peaks at 0.098.

### 7.4 Contrast at the brightest sheen pixel (worst case = high)

| Text | Ground at brightest pixel | Ratio (standard → high) |
|---|---|---|
| Name `#1C1C1C` | cream + white .14 / .20 = `#F6F1EA` / `#F6F2EB` | 15.17 → **15.30** |
| Role `#3A3A3A` | same | 10.13 → **10.21** |
| Session `#1C1C1C` | same | 15.17 → **15.30** |
| Chip label Cream on `#1C1C1C` | the chip is drawn above the sheen | **14.88** (unchanged) |
| Brief name / values `#1C1C1C` | cream + .098 / .14 | 15.09 → 15.17 |
| Brief labels `#2A7B74` (20/700, large) | cream + .14 | 4.44 → 4.49 |
| Brief eyebrow `#5A5650` | cream + .14 | 6.45 → 6.49 |

Gloss always raises luminance on cream, so contrast for dark text only improves.

### 7.5 Grain

The optional 256px grain tile is **not used**. There was no visible banding at 1080 output, and the gradients span a large area at low alpha. If banding appears in the canvas port, add a 256×256 monochrome noise tile at α .03, clipped to the card only.

---

## 8. Contrast table

| Pair | Ratio | Note |
|---|---|---|
| Cream on ink `#0D0D0D` | 16.97 | headline, CREATIVE BRIEF |
| Pill text Cream α.72 (`#B3B0A9`) on ink | 8.97 | site uses α.55 (5.60) |
| Eyebrow Cream α.60 (`#98958F`) on ink | 6.48 | site uses α.35 (2.92, fails) |
| Tagline Cream α.72 on ink | 8.97 | site uses α.38 |
| Tile value Cream on tile `#191919` | 15.34 | — |
| Tile label Cream α.65 on tile (`#A7A49E`) | 7.08 | site uses α.32 |
| Foil stops on ink: `#C9A24A` / `#F5D87A` / `#9E7520` | 8.10 / 13.87 / **4.65** | darkest stop still passes 4.5 |
| Level text on ink: `#5C9890` / Gold / Coral | 5.88 / 8.10 / 5.25 | — |
| `#B9B4AB` on `#1C1C1C` (band labels, hashtags) | 8.26 | — |
| Obsidian on Cream | 14.88 | — |
| `#3A3A3A` / `#5A5650` on Cream | 9.93 / 6.36 | — |
| Teal labels on Cream | 4.38 | large text |
| Coral "DMC 2026" on Cream | 3.23 | headline scale only |
| MojoPay `#0500CC` on white | 11.18 | — |
| **Text over planes** | **none** | No text sits in any container rect (§6) |

**Objects against the planes** (brightest plane pixel next to each object):

| Pair | Ratio |
|---|---|
| Strap Cream warp vs plane behind strap (`#4B2C24` 4:5, `#4F2E25` 9:16) | 10.90 / 10.49 |
| Card cream edge vs brightest adjacent plane (`#B4614B`, coral at right edge) | 3.88 |
| Card cream vs plane above card (`#904F3D` 4:5, `#256A64` 9:16) | 5.46 / 5.54 |
| Photo block vs card cream: Teal / Gold / Coral | 4.38 / 2.10 / 3.23 |
| Teal block vs teal plane / Coral block vs coral plane (if adjacent) | 1.13 / 1.20 |

The block never touches a plane: the cream card frames it by ≥ 20px on every side, and the cast shadow adds a dark edge on the left and bottom. The low "same-hue" ratios therefore never occur at an edge, and the block always reads as a print inside the card.

---

## 9. Collision QA (all states, gloss = standard)

Every state was checked by measuring the DOM text rects in each frame. Overlaps between stacked headline lines (LH 0.85) and between two-line name rows are expected line-box overlaps, not ink collisions.

| Check | Result |
|---|---|
| APPROVED stamp vs any value text, Brief 4:5 (all 5 states) | **clear**. Stamp bounding box left edge 816; CHANNEL ends 769 (47 clear); DEADLINE ends 695 (121 clear) |
| APPROVED stamp, Brief 9:16 (all 5 states) | **clear** after the label column was narrowed to 196. CHANNEL ends 769 vs stamp box 792 (23); DEADLINE 695 (97) |
| Headshot vs name/role (long name + headshot) | clear: Vw 528 / 504 keeps the text 188px left of the frame |
| SCALE vs card (4:5) | SCALE ink ends ≈396, card at 416 |
| Pill vs card top (9:16) | pill ends x 466 / y 306; card at x 472 |
| Gloss vs text | all sheen layers are drawn under text; QR, band and stamp are never glossed |
| Rows vs footer (Brief) | rows end ≤ 980; footer starts at 988 |

---

## 10. Assets

| File | Notes |
|---|---|
| `assets/hero-geo.svg` | Supplied hero element, verbatim (all four layers + fade). The templates draw g1, g2 and the fade from the same values. |
| `assets/hardware-specular.svg` | **New.** 160×150 overlay aligned to `lanyard-hardware.svg`: white highlights only, drawn at globalAlpha = edge. |
| `assets/lanyard-hardware.svg`, strap, field and kente tiles | Unchanged from R1 |
| `assets/approved-stamp.svg` | R1 master. The round-2 stamp is 200×80 and drawn in code (§4). |
| `assets/logos/*` | Interim as listed in §6 |

---

## 11. Decisions (rules bent, and why)

- **D1. g3 (gold band) and g4 (obsidian band) are dropped.** The kente strip and the obsidian partner band already sit exactly where the hero's gold and obsidian bottom bands would, and they do the same job: a warm stripe, then a dark base. Keeping g3 would butt a second gold band against the kente and muddy it. It would also show only as slivers behind the card.
- **D2. The pill reads "DMC 2026 · ACCRA", not "DMC 2026 · British Council, Accra".** At the requested ≥30px, the full line measures 708px plus padding, which would cross the strap and the planes on the Badge. "British Council" is still on the VENUE tile (Badge) and the CHANNEL row (Brief). The same short pill is used on the Brief for consistency.
- **D3. Pill and eyebrow alphas are raised** (pill .55 → .72, eyebrow .35 → .60, tile label .32 → .65, tagline .38 → .72). The site's values fail WCAG at social-post sizes; the eyebrow at .35 is 2.92:1.
- **D4. The eyebrow wraps to two lines on the Badge.** One line (529px) would enter the planes. The Brief keeps one line at 18px.
- **D5. Headline sizes are 76 (Badge 4:5) and 86 (Badge 9:16).** They are capped by the left column: SCALE must end before the card (x 416 / 472), and the card cannot shrink.
- **D6. The Brief headline is "BUILT TO SCALE" on one line, plus "DMC 2026" in Coral, all at 72.** It is not stacked three high, which would push the rows into the footer. It is Obsidian on cream with SCALE in the true italic, and never gold on cream.
- **D7. The Brief's pill and CREATIVE BRIEF move to the hero ground** (the header band on 4:5, the backdrop on 9:16). The eyebrow and JOB NO. sit on the cream.
- **D8. No tagline on the Brief.** There is no room left in either format without shortening rows.
- **D9. Tag chips on the Brief.** OBJECTIVE becomes a level-fill tag chip (same wording). CHANNEL becomes an "IN PERSON" outline chip plus "British Council, Accra" (same words, split).
- **D10. The headshot shrinks from 180×216 to 160×192, and the rows from 58–70 to 52–64.** Both make room for the header band. Role drops to one line only in the rare speaking + long-name + long-role case.
- **D11. The 9:16 Brief label column is 196 (was 220).** This guarantees the stamp clears "Accra".
- **D12. The stamp is smaller (200×80, rotated −6°) and anchored to the right edge of the BUDGET row.** This fixes the R1 QA collisions.
- **D13. The 9:16 bottom weave field stays.** It sits in the Stories UI zone, so it is identity rather than content. The planes replace only the backdrop.
- **D14. The pop-out shadow uses a CSS `drop-shadow` filter in the DOM reference only**, because the DOM has no other way to shadow alpha. In canvas it is simply `shadowBlur`/`shadowOffset` on `drawImage` (§7.2 #17).
- **D15. The rim gradient uses bounding-box units** (its isolines follow the card's anti-diagonal). The canvas equivalent is `createLinearGradient(0, 0, W, H)` on the card bounds. The difference is under 1% alpha at any edge pixel.
- **D16. Stamp and level word use pin D (900 wdth 125)** in place of round-1 Archivo Black, so only Archivo is loaded.
- Carried from R1 and unchanged: palette hexes vs the Wave One PDF, Gold and Coral as fills, Archivo 800 for names, white logo tiles, the single vertical strap, the dynamic block height, MojoPay fill, and the level-line wording. The "TURNAROUND: 5 hours. No extensions." row is kept, as the brief now confirms.
