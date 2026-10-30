/* DMC 2026 sponsor credit: the one place the contracted "Powered by MojoPay" lockup and the "Tickets exclusively on MojoLife" line are configured.
   Contract basis (Schedule C, clauses 8.2, 8.3, 8.4, 11.2): MojoLife named as the exclusive ticketing platform, the
   MojoPay logo never altered or misrepresented. By the team's decision MojoLife is named in words and no MojoLife logo is drawn.
   Every renderer (site hero, flyer, Studio, Live cards, Live screen, link-preview images) reads these values.

   Defaults pending MojoPay Branding Guidelines. Change them here and nowhere else. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DMCSponsorConfig = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    /* Defaults pending MojoPay Branding Guidelines. */
    MOJOPAY_MIN_TILE_PCT_FEED: 16,     /* MojoPay tile width as % of artwork width on feed sizes (1080 wide, 1200, 1600) */
    MOJOPAY_MIN_TILE_PCT_STORY: 22,    /* ... on 9:16 */
    MIN_TILE_PX: 140,                  /* never narrower than this in any export */
    MIN_TICKET_TEXT_PCT: 1.4,          /* the "Tickets exclusively on MojoLife" text: font size as % of artwork width (never under 12 px) */

    /* The tile behind the logo. The hero uses Signal Cream (#F4EFE6), not white; one constant to change if MojoPay
       confirm a pure white tile. */
    TILE_COLOUR: '#F4EFE6',

    /* Label style, copied from the homepage hero (.hero-conf at 1440 wide): Archivo 600, 14px, +.18em, uppercase,
       rgba(244,239,230,.62). All other measurements are ratios of the logo height (26px in the hero). */
    LABEL_COLOUR: 'rgba(244,239,230,.62)',
    LABEL_COLOUR_EMAIL: '#A29F99',       /* the same muted cream flattened onto #1C1C1C, because mail clients drop rgba */
    HERO: { logoH: 26, labelPx: 14, labelWeight: 600, labelTracking: 0.18, padX: 12, padY: 7, gap: 14, gapStacked: 8 },
    LOGO_ASPECT: 1144.63 / 192.72,     /* viewBox of the official MojoPay SVG */

    LABELS: { mojopay: 'Powered by' },
    /* MojoLife is named in words, not drawn: no MojoLife logo is used anywhere (team decision). */
    TICKET_EXCLUSIVE: 'Tickets exclusively on MojoLife',
    TICKET_EXCLUSIVE_LINES: ['Tickets exclusively', 'on MojoLife'],
    TICKET_COLOUR: '#F4EFE6',
    TICKET_LINE: 'Tickets exclusively on MojoLife \u00b7 mangh.org/dmc-2026',
    TICKET_LINE_EMAIL: 'Tickets exclusively on MojoLife',

    /* The one logo file ever drawn; it is never recoloured, stretched, cropped or rotated. */
    LOGOS: {
      mojopay: { file: 'assets/partners26/mojopay-logo-blue.svg', alt: 'MojoPay', href: 'https://mojo-pay.com' }
    }
  };
});
