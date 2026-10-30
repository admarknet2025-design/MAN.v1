/* Builds the two DMC Live browser bundles from source:
     assets/live-cards.js   the quote card maker (tools/live-cards/cards.js + its fonts, QR code and word filter), loaded only when a phone taps "Make a quote card"
     assets/live-qr.js      the QR code library alone, for the projector's "Scan to join" slide
   Run after changing tools/live-cards/, lib/live/filter-core.js or lib/live/blocklist.txt:
     npm i --no-save esbuild && node tools/build-live-cards.js
   Bump the ?v= on the <script> tags in lib/live/phone.html and lib/live/screen.html when the output changes (assets are cached for a year). */
'use strict';
const path = require('path');
let esbuild;
try { esbuild = require(process.env.ESBUILD || 'esbuild'); } catch (e) { console.error('esbuild is not installed: npm i --no-save esbuild (or set ESBUILD to its path)'); process.exit(1); }

const root = path.join(__dirname, '..');
const common = { bundle: true, minify: true, target: ['chrome70', 'safari12'], legalComments: 'none', logLevel: 'info' };

esbuild.buildSync(Object.assign({}, common, {
  entryPoints: [path.join(__dirname, 'live-cards', 'cards.js')],
  outfile: path.join(root, 'assets', 'live-cards.js'),
  format: 'iife',
  loader: { '.woff2': 'base64', '.txt': 'text', '.svg': 'text' }
}));

esbuild.buildSync(Object.assign({}, common, {
  stdin: { contents: "import qrcode from 'qrcode-generator'; window.qrcode = qrcode;", resolveDir: root, loader: 'js' },
  outfile: path.join(root, 'assets', 'live-qr.js'),
  format: 'iife'
}));
