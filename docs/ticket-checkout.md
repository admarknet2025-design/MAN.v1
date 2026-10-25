# Ticket checkout on mangh.org (MojoTickets embed + our own referral log)

One component, `assets/ticket-checkout.js`, sits behind every ticket button on the site. Buttons are still plain
`<a href="https://tickets.mojo-pay.com/events/digital-marketers-conference-2026">` links, so they work with JavaScript
off and with ctrl/cmd/middle-click. The script picks up every such link on every page, so new buttons are covered
automatically.

## What a click does
| Visitor | Result |
|---|---|
| Normal browser | Modal over the page with the **embed** checkout: `https://tickets.mojo-pay.com/embed/events/digital-marketers-conference-2026?ref=…`. The page stays open behind it. |
| In-app browser (Instagram, Facebook, TikTok, WhatsApp, Snapchat, Line) or no `<dialog>` support | The embed URL opens in a new tab. If the browser blocks the new tab, the modal shows a plain "Open checkout in a new tab →" link and `ticket_popup_blocked` is logged. |
| JavaScript off, or ctrl/cmd/middle/shift-click | The ordinary ticket page, in the normal way. |

Always visible in the modal: **"Having trouble? Open checkout in a new tab →"** (embed URL, with `ref`/`utm_*`), and the line
**"Payment completes securely on MojoPay."**

Do **not** iframe `/events/...` (MojoTickets only allows its own origin there). Only the `/embed/events/...` URL is framed.
The iframe has `allow="payment"` and **no `sandbox`**: MoMo payment redirects the **top** window to MojoPay, and a sandbox
would block that. So on a MoMo payment the mangh.org page itself is replaced by the MojoPay payment page.

## Popup mode (`embed.js`) is not wired in
MojoTickets also offers a widget script (`data-event`, `data-mode="modal"|"popup"`). Its exact script URL and `data-event`
value are not confirmed, and nothing in this repo guesses them. Popup mode would keep mangh.org open during MoMo payment,
so it is the better experience once MojoPay gives us the two values. Until then the modal iframe above is the primary path.

## Referral capture
`ref` and `utm_source|medium|campaign|content|term` (values limited to letters, numbers and `_ . ~ - %`, 80 characters) are saved
in `sessionStorage` (`man_ticket_params`) on the first page of a visit, even before checkout is opened. A new `ref` in the
URL replaces the saved one. They are appended to the embed URL, the fallback links and the plain ticket links. The Google tag
in each page's `<head>` still turns `?ref=` codes into GA4 campaign data (unchanged).

## Attribution log ("checkout started", never "paid")
MojoTickets does not store `ref`/`utm_*` (embed sales only show as channel "Embed"). When an order is created (before
payment) the embed page posts `{ type: 'mojotickets:checkout:complete', reference }` to the parent window.
`ticket-checkout.js` accepts it only from `https://tickets.mojo-pay.com` with that exact `type`, then:

1. posts `{ reference, ref, utm_*, path, ts, ua }` to **`/api/attribution`** (`fetch` with `keepalive`, because MoMo
   payment can navigate the page away straight after);
2. fires GA4 `ticket_checkout_started` (with `ref`);
3. shows "You're almost in. Finish payment on MojoPay, then make your flyer →" (links to `/dmc-2026#flyer`) above the
   still-visible checkout.

`ua` is `mobile`, `desktop` or `in-app`. The event means **checkout started**; it is labelled that way everywhere.
**Match the CSV against MojoPay's paid-orders export by order reference to find real sales.**

### Known gap: new-tab and popup flows send no message
`postMessage` goes to `window.parent`. A checkout opened in a **new tab** (in-app browsers, blocked-modal fallback) has no
parent frame, and we open it with the opener cleared (`noopener`), so mangh.org never hears that an order started. Those sales
will not appear in our log; they will show in MojoPay's export as channel "Embed" with no ref. If MojoPay's embed page also
posts to `window.opener`, we could keep the opener for the embed URL only (a security trade-off to decide with MojoPay).
Popup mode (widget) has the same question: unknown until MojoPay confirms how it reports back.

## Storage: Upstash Redis via Vercel Marketplace (not yet provisioned)
`api/attribution.js` and `api/admin-attribution.js` talk to Redis over the Upstash **REST** API with plain `fetch` (no npm
packages). Cheapest option: the **Upstash for Redis** Marketplace integration on its **Free** plan (about 500k commands a
month; an order uses about 4 commands, so cost is $0 at this scale). It adds the env vars below to the Vercel project.
Nothing has been provisioned.

Keys: `att:v1:<reference>` (record, written once), `att:v1:index` (sorted set by time), `att:v1:counts` (hash by ref).

### Environment variables (Vercel → Project → Settings → Environment Variables; Preview and Production)
| Name | Purpose |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Redis REST endpoint and token (the Upstash/Vercel KV integration creates these; `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work) |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Basic-auth login for `/admin/attribution`. Choose a long password. If either is missing the page refuses to load. |

Never commit these. `/api/attribution` answers `503` until the store variables exist (the checkout itself is unaffected).

## Admin: `/admin/attribution`
Basic auth. Shows counts by ref, the 200 most recent checkouts started, and **Download CSV** (`/admin/attribution.csv`:
reference, ref, utm_source, utm_medium, utm_campaign, utm_content, utm_term, timestamp, page, device). The page and CSV
are `no-store` and `noindex`, and `/admin/` and `/api/` are disallowed in `robots.txt`. Spreadsheet cells that begin with
`= + - @` are prefixed with `'` so they cannot run as formulas.

## Analytics (GA4, existing `gtag` only)
`ticket_open` (`ref`, `mode`: modal or tab), `ticket_popup_blocked`, `ticket_fallback_click` (`where`), `ticket_checkout_started`
(`ref`). The older `ticket_click` (which button was clicked) still fires from `assets/analytics.js`.

## Colours
Obsidian #1C1C1C, Signal Cream #F4EFE6, Build Teal #2A7B74, Pulse Coral #D95F45, Archivo. No Akan Gold in the modal, banner or admin page.

## Previews
`?embed=0` on a Vercel preview or localhost turns the modal off for that tab (to check the plain links); `?embed=1` turns it back on.
On mangh.org itself the flag in the script is the only switch.

## Still to check with real devices and MojoPay
- A real MoMo purchase from the modal on Android Chrome and iPhone Safari (the top window leaves mangh.org to pay).
- That the real embed page posts exactly `mojotickets:checkout:complete` with a `reference` in iframe mode (tested here with a
  stand-in page that sends that message; the real MojoTickets host cannot be reached from the build environment).
- Whether new-tab and popup flows can report back (see "Known gap").
- Instagram, Facebook, TikTok and WhatsApp in-app browsers on real phones (detected from the user agent; simulated in tests only).
