# Ticket checkout on mangh.org (MojoTickets embed + our own referral log)

One component, `assets/ticket-checkout.js`, sits behind every ticket button on the site. Buttons are still plain
`<a href="https://tickets.mojo-pay.com/events/digital-marketers-conference-2026">` links, so they work with JavaScript
off and with ctrl/cmd/middle-click. The script picks up every such link on every page, so new buttons are covered
automatically.

## What a click does
| Visitor | Result |
|---|---|
| Normal browser | Modal over the page with the **embed** checkout: `https://tickets.mojo-pay.com/embed/events/digital-marketers-conference-2026?ref=…`. The page is dimmed behind it until the buyer pays. |
| In-app browser (Instagram, Facebook, TikTok, WhatsApp, Snapchat, Line) or no `<dialog>` support | The embed URL opens in a new tab. If the browser blocks the new tab, the modal shows a plain "Open checkout in a new tab →" link and `ticket_popup_blocked` is logged. |
| JavaScript off, or ctrl/cmd/middle/shift-click | The ordinary ticket page, in the normal way. |

Always visible in the modal: **"Having trouble? Open checkout in a new tab →"** (embed URL, with `ref`/`utm_*`), and the line
**"Payment completes securely on MojoPay."**

Do **not** iframe `/events/...` (MojoTickets only allows its own origin there). Only the `/embed/events/...` URL is framed.
The iframe has `allow="payment"` and **no `sandbox`**: MoMo payment redirects the **top** window to MojoPay, and a sandbox
would block that. The embed page redirects the **top** window to the payment page as soon as the order is created (see below), so the mangh.org page itself is replaced by the payment page for every buyer, not only MoMo.

## What the official docs say, checked against the live hosts (15 November 2026)
Docs: https://mojotickets.adfocusgh.com/api (embed, authentication, quick start, webhooks, errors, checkout). Findings:

- **Which host sells our event.** `digital-marketers-conference-2026` exists on **`tickets.mojo-pay.com`**
  (`/api/v1/embed/events/digital-marketers-conference-2026` returns the event: 21 Nov 2026 10:00, British Council). On the docs host
  `mojotickets.adfocusgh.com` the same request returns **404 "Event not found"**. So the docs host is a different deployment; do **not**
  swap our URLs for it. Its `embed.js` is byte-for-byte identical to `tickets.mojo-pay.com/embed.js`.
- **Embed widget.** `<script src="https://tickets.mojo-pay.com/embed.js" data-event="digital-marketers-conference-2026" async>` would work
  on our host. `data-mode="popup"` (default) opens the checkout in a `window.open` popup; `data-mode="modal"` frames
  `/embed/events/{slug}`, which needs the server to allow framing. `tickets.mojo-pay.com` does (`frame-ancestors *`, no
  `X-Frame-Options`); `mojotickets.adfocusgh.com` does not (`X-Frame-Options: SAMEORIGIN`). Our own `<dialog>` is the documented
  "modal" mode with our styling, our fallback links and our referral logging. It is not replaced by the widget.
- **What the embed page does when framed** (read from its published script): on "Pay" it creates the order, posts
  `{ type: 'mojotickets:checkout:complete', reference }` to the parent with target `*`, **then sets `window.top.location` to the
  payment page**. So in the modal, **every** buyer leaves mangh.org for payment straight after the order is created, not only MoMo
  buyers. The "You're almost in" line is rarely visible for that reason. When the checkout is opened as a top-level page or popup,
  there is no parent, so no message is posted.
- **Partner API, tokens and webhooks** (`/api/v1/partner`, `mt_live_…`, `order.paid` with `X-MojoTickets-Signature`) are for server-side
  sales and fulfilment. This site uses none of them and holds no token. If the site ever acts on a payment (for example emails a
  flyer link), add a webhook endpoint that verifies the HMAC-SHA256 of the raw body, is idempotent on `order.reference`, and answers
  2xx quickly; do not treat a buyer returning to the site as proof of payment. Whether orders from the hosted embed also fire
  `order.paid` for our organisation is for MojoPay to confirm.
- **Rate limits** in the docs (checkout 10 requests a minute per IP) are for the Partner API. Ask MojoPay whether the embed checkout
  has a similar per-IP limit, because attendees buying at the venue share one network.

Run `node tools/ticket-check.js` before the event: it checks the hosts above are still as described.

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

Retention: records expire automatically on 21 November 2027, as `/privacy` says (see "Retention" in `docs/studio.md`).

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
