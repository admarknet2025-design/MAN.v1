/* DMC 2026 email footer: the contracted sponsor credit for any email the team sends about the event.
   Required content (contract Schedule C and clause 8.4): the Mojo Payments and MojoLife logos in the footer, and the line
   "Tickets exclusively on MojoLife".

   Use `renderEmail()` for every DMC 2026 email. It always adds the footer, to the HTML and to the plain-text part, so a message
   cannot leave it out; `assertFooter()` is the check tools/sponsor-check.js runs. The logos are the official MojoPay logo
   (a 600 px PNG of the official SVG, since mail clients do not draw SVG) on the same cream tile and in the same proportions as every other
   DMC 2026 asset, from the shared geometry in lockup.js. While config.js has `LOGOS.mojolife.standIn`, the MojoLife slot shows that
   same file.

     const { renderEmail } = require('./assets/sponsor/email.js');
     const { html, text } = renderEmail({ html: bodyHtml, text: bodyText });   // then hand html and text to the mail service */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./lockup.js'));
  else root.DMCSponsorEmail = factory(root.DMCSponsor);
})(typeof self !== 'undefined' ? self : this, function (SP) {
  'use strict';
  var CFG = SP.config;
  var LOGO_PNG = '/assets/sponsor/mojopay-logo-blue-email.png';
  var EMAIL_WIDTH = 600;
  var FONT = "Archivo,'Helvetica Neue',Arial,sans-serif";
  var MARK = 'data-dmc-sponsor-footer';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* tile width in px: the contract minimum for a 600 px email is under the 140 px floor, so the floor applies */
  function tileWidth() { return Math.max(SP.minTileW(EMAIL_WIDTH, false), 200); }

  function lockupCell(kind, g, base) {
    var cfg = CFG.LOGOS[kind], w = Math.round(g.logoW), h = Math.round(g.logoH), px = Math.round(g.padX), py = Math.round(g.padY);
    var label = '<td style="font:' + g.weight + ' ' + Math.round(g.labelPx) + 'px/1.2 ' + FONT + ';letter-spacing:' + g.tracking.toFixed(1) + 'px;text-transform:uppercase;color:' + CFG.LABEL_COLOUR_EMAIL + ';padding:0 ' + Math.round(g.gap) + 'px 0 0;white-space:nowrap" valign="middle">' + esc(CFG.LABELS[kind]) + '</td>';
    var tile = '<td bgcolor="' + CFG.TILE_COLOUR + '" style="background:' + CFG.TILE_COLOUR + ';padding:' + py + 'px ' + px + 'px;line-height:0" valign="middle">' +
      '<img src="' + esc(base + LOGO_PNG) + '" width="' + w + '" height="' + h + '" alt="' + esc(cfg.alt) + '" style="display:block;border:0;width:' + w + 'px;height:' + h + 'px"></td>';
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left" style="margin:0 24px 12px 0"><tr>' + label + tile + '</tr></table>';
  }

  /* the footer block, as a dark band to sit at the end of the message */
  function footerHtml(opts) {
    var base = ((opts && opts.base) || 'https://mangh.org').replace(/\/$/, ''), g = SP.geometry(tileWidth());
    return '<table role="presentation" ' + MARK + '="1" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1C1C1C" style="background:#1C1C1C"><tr><td style="padding:24px 28px">' +
      '<p style="margin:0 0 14px;font:700 16px/1.3 ' + FONT + ';color:#F4EFE6">' + esc(CFG.TICKET_LINE_EMAIL) + '</p>' +
      lockupCell('mojopay', g, base) + lockupCell('mojolife', g, base) +
      '<div style="clear:both;font-size:0;line-height:0;height:0">&nbsp;</div>' +
      '<p style="margin:6px 0 0;font:500 13px/1.4 ' + FONT + ';color:' + CFG.LABEL_COLOUR_EMAIL + '">Digital Marketers’ Conference 2026 · Built To Scale · 21 November 2026 · British Council, Accra · <a href="https://mangh.org/dmc-2026" style="color:#F4EFE6">mangh.org/dmc-2026</a></p>' +
      '</td></tr></table>';
  }

  function footerText() {
    return '--\n' + CFG.TICKET_LINE_EMAIL + '.\n' + CFG.LABELS.mojopay + ' MojoPay · ' + CFG.LABELS.mojolife + ' MojoLife\nDMC 2026 · Built To Scale · 21 November 2026 · British Council, Accra · mangh.org/dmc-2026\n';
  }

  /* every DMC 2026 email goes through here; the footer is added to both parts and cannot be switched off */
  function renderEmail(msg) {
    var base = msg && msg.base, html = String((msg && msg.html) || ''), text = String((msg && msg.text) || '');
    var foot = footerHtml({ base: base });
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, foot + '</body>') : html + foot;
    text = text.replace(/\s+$/, '') + '\n\n' + footerText();
    return { html: html, text: text };
  }

  /* problems with a finished email, [] when it is fine */
  function assertFooter(html, text) {
    var out = [], w = tileWidth();
    if (html.indexOf(MARK) < 0) out.push('HTML part has no sponsor footer');
    if (html.indexOf(CFG.TICKET_LINE_EMAIL) < 0) out.push('HTML part is missing "' + CFG.TICKET_LINE_EMAIL + '"');
    ['MojoPay', 'MojoLife'].forEach(function (a) { if (!new RegExp('<img[^>]*alt="' + a + '"').test(html)) out.push('HTML part is missing the ' + a + ' logo'); });
    var widths = (html.match(/<img[^>]*width="(\d+)"/g) || []).map(function (m) { return +/width="(\d+)"/.exec(m)[1] + 2 * Math.round(SP.geometry(w).padX); });
    if (widths.length < 2 || widths.some(function (x) { return x < CFG.MIN_TILE_PX; })) out.push('a logo tile in the email is under ' + CFG.MIN_TILE_PX + ' px');
    if (text.indexOf(CFG.TICKET_LINE_EMAIL) < 0) out.push('text part is missing "' + CFG.TICKET_LINE_EMAIL + '"');
    return out;
  }

  return { renderEmail: renderEmail, footerHtml: footerHtml, footerText: footerText, assertFooter: assertFooter, tileWidth: tileWidth };
});
