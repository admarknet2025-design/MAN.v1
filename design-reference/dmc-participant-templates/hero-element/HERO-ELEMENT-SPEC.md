# The DMC 2026 hero element (from mangh.org): exact source

Found in our earlier website build (`man-website-merged.html`, 14 Oct version). The live site has moved on since, so the repo's CSS is authoritative; the geometry below was checked against a screenshot of the live DMC hero and matches. The home hero and the DMC 2026 hero both use it. In the repo, search for `hero-geo`, `.g1`–`.g4`, `hero-geo-fade` and `.h26-`.

## 1. The angular planes ("hero-geo")
Container: absolutely positioned, `right:0; top:0; width:50%; height:100%; overflow:hidden`. Four layers, each `position:absolute; inset:0` with a `clip-path` polygon in **percent of the container**. Bottom to top:

| Layer | Fill | Opacity | Polygon (x% y%) |
|---|---|---|---|
| g1 | Teal `#2A7B74` | 0.85 | 35 0, 100 0, 100 55, 10 0 |
| g2 | Coral `#D95F45` | 0.80 | 20 0, 100 40, 100 75, 0 95 |
| g3 | Gold `#C9A24A` | 0.75 | 0 70, 100 68, 100 100, 0 100 |
| g4 | Obsidian `#1C1C1C` | 0.80 | 0 85, 60 75, 100 100, 0 100 |

**Fade overlay** on top (`.hero-geo-fade`, inset 0): `linear-gradient(to right, #0D0D0D 0%, rgba(13,13,13,.6) 50%, transparent 100%)`.
**Hero ground:** `--ink #0D0D0D`.

**On the website the planes animate** (slow morph, 17–30 s loops). A flyer is static, so use the REST state above. Alternate "mid" state if a variant is wanted: g1 `27 0, 100 0, 100 64, 4 0` @ .70 · g2 `13 0, 100 34, 100 82, 0 100` @ .90 · g3 `0 61, 100 75, 100 100, 0 100` @ .58 · g4 `0 80, 55 70, 100 100, 0 100` @ .38.

`hero-geo.svg` is this element (rest state), stretchable to any container (`preserveAspectRatio="none"` = the same behaviour as the CSS percentages).

## 2. Canvas port (no clip-path needed)
```js
function drawHeroGeo(ctx, x, y, w, h) {            // container rect on the flyer
  const P = (pts) => { const p = new Path2D(); pts.forEach(([px,py],i)=>{ const X=x+px/100*w, Y=y+py/100*h; i?p.lineTo(X,Y):p.moveTo(X,Y); }); p.closePath(); return p; };
  const layers = [
    ['#2A7B74', .85, [[35,0],[100,0],[100,55],[10,0]]],
    ['#D95F45', .80, [[20,0],[100,40],[100,75],[0,95]]],
    ['#C9A24A', .75, [[0,70],[100,68],[100,100],[0,100]]],   // optional on a flyer
    ['#1C1C1C', .80, [[0,85],[60,75],[100,100],[0,100]]],    // optional on a flyer
  ];
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (const [c, a, pts] of layers) { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fill(P(pts)); }
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#0D0D0D'); g.addColorStop(.5, 'rgba(13,13,13,.6)'); g.addColorStop(1, 'rgba(13,13,13,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
}
```

## 3. The headline treatment ("h26-t1 / h26-t2")
- Both lines: `font-weight:900; font-variation-settings:'wdth' 125; line-height:.85; letter-spacing:-.02em; text-transform:uppercase`.
- `BUILT / TO`: Cream `#F4EFE6`.
- `SCALE`: `font-style: italic`, gold foil gradient (the site's "shimmer", static snapshot): `linear-gradient(90deg, #C9A24A 0%, #F5D87A 30%, #C9A24A 55%, #9E7520 78%, #C9A24A 100%)` applied to the text. On the site it animates; a flyer uses one frame.
- Pill: `padding 6px 14px; border 1px solid rgba(255,255,255,.10)`; gold dot 7px; text 10px / 600 / `letter-spacing .16em`, uppercase, `rgba(244,239,230,.55)`. Copy: "DMC 2026 · British Council, Accra".
- Eyebrow: 10px / 700 / `.28em`, uppercase, `rgba(244,239,230,.35)`. Copy: "Digital Marketers' Conference" (as on the live page today; the 14 Oct source file still says "Marketing", which has since been corrected).
- Tagline: italic, `rgba(244,239,230,.38)`: "The organisations scaling in Ghana aren't waiting. They're building."
- Info tiles (`.hm`): 2-column grid, 2px gap; each tile `background rgba(255,255,255,.05); padding 12px 14px; border-top 1px solid rgba(201,162,74,.18)`; label 9px / 700 / `.2em` uppercase `rgba(244,239,230,.32)`; value 13px / 800 Cream.

## 4. Notes
- These sizes are the website's (px at desktop). Scale up proportionally for a 1080-wide canvas; keep the ratios.
- On canvas, expanded width needs `ctx.fontStretch = 'expanded'` (Chrome) or a static woff2 pinned at wdth 125 / weight 900 for other browsers. See the tested note in the build prompt.
- Gold is allowed on web/social assets. g3 (gold band) and g4 (obsidian band) sit at the bottom of the hero and may be dropped on the flyer if they clash with the kente strip and partner band.
