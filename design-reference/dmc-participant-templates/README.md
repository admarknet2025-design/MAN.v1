# DMC 2026 participant templates, round 2: handoff for Claude Code

Round 2 supersedes round 1. `PORT-SPEC.md` is authoritative (coordinates, pinned type, hero planes, foil, gloss layers, band, contrast, decisions).

- `assets/`: weave strap, weave field and kente tiles; lanyard hardware + `hardware-specular.svg`; `hero-geo.svg`; approved-stamp.svg; interim logos in `assets/logos/`.
- `hero-element/HERO-ELEMENT-SPEC.md`: the website hero element the planes and foil come from (the repo's CSS is authoritative if it differs).
- `reference-markup/`: the Claude Design components (readable HTML with exact values; they need Claude Design's runtime to render).
- `reference-renders/`: visual targets at exact canvas size.

## Read before porting
1. **QR tiles are blank** in the renders (generated at runtime). Draw the real QR.
2. **Name fitting.** The renders use a short name ("Ama Owusu") on purpose. In a headless test, the reference component mis-measured the longer default name ("Abena Mensah") and let it overflow the card. The spec's algorithm is right: at 80px, Archivo 800 measures **593px** for "Abena Mensah", so it must come out at **73px on the 4:5 Badge (plate 544)** and **65px on the 9:16 Badge (plate 488)**. Measure only after fonts have loaded and re-run the fit when they do. Do not copy any overflow.
3. **Jobberman is a Cedar-tier sponsor**, so the seven-tile partner row (`partners7 = true`) is the default.
4. Interim logos (MojoPay fill, M·A·N, FIDO, Mista.Koin) should be replaced with the repo's masters. See the prompt.
