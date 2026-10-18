# Ticket checkout on mangh.org (MojoTickets modal)

`assets/ticket-checkout.js` opens MojoTickets checkout in a modal on mangh.org instead of sending people to
tickets.mojo-pay.com. It is built and tested but **switched off** (`var EMBED = false;`) until MojoPay confirms their
checkout may be shown inside a mangh.org page.

## How it behaves (when on)
- Every link to `https://tickets.mojo-pay.com/events/digital-marketers-conference-2026` on any page is intercepted
  by one click listener, so new buttons are covered automatically. The links stay real links: no JavaScript, in-app
  browsers (Instagram, Facebook, TikTok, WhatsApp, Snapchat, Line) and ctrl/cmd/middle-click all open the ticket page in a
  new tab as before.
- Desktop: centred modal, 560px wide, 85vh tall. Phones: full-screen sheet that slides up.
- Header bar "DMC 2026", close button, Esc, click on the dimmed backdrop. Focus is trapped (native `<dialog>`), focus
  returns to the button that opened it, page scroll is locked.
- The iframe is created only when the modal opens. A branded loading state shows until the iframe's `load` event;
  after 8 s without it, a "Open checkout in a new tab →" panel appears. A "Having trouble? Open checkout in a new tab →"
  link is always visible in the footer.
- Iframe: `allow="payment"`, `referrerpolicy="strict-origin-when-cross-origin"`, a descriptive `title`, no `sandbox`
  (not tested against the real checkout, so left off).
- Colours: obsidian, cream, teal, coral. No gold.

## Referral pass-through
`ref` and `utm_source|medium|campaign|content|term` (values limited to letters, numbers and `_ . ~ - %`) are read from
the page URL, saved in `sessionStorage` for the visit, and added to the iframe URL, the fallback links and the plain
ticket links on every page. A new `ref` in the URL replaces the saved one. Example:
`mangh.org/dmc-2026?ref=kwaku` -> `tickets.mojo-pay.com/events/digital-marketers-conference-2026?ref=kwaku`.

## Analytics (GA4, through the existing `gtag`)
`ticket_modal_open` (with `ref`), `ticket_iframe_loaded`, `ticket_fallback_click`, `ticket_purchase_success`
(only if MojoTickets sends a message, see below). The existing `ticket_click` event still fires on the click.

## Turning it on
1. MojoPay allows framing from `https://mangh.org` (see the note below) and you have checked it (next section).
2. Change `var EMBED = false;` to `true` in `assets/ticket-checkout.js`, run `python3 tools/stamp-assets.py`, merge.

## Testing before it is on
On a Vercel preview or localhost only, add `?embed=1` to any page URL (e.g. `/dmc-2026?embed=1&ref=test`). That
switches it on for that browser tab; `?embed=0` switches it off. On mangh.org itself the flag is the only switch.

## Check whether MojoPay allows framing
Run: `curl -sI https://tickets.mojo-pay.com/events/digital-marketers-conference-2026`
- Embeddable if there is **no** `X-Frame-Options` header, or it is `ALLOW-FROM`/absent, **and** no
  `Content-Security-Policy` with `frame-ancestors`, or one that lists `https://mangh.org`.
- Blocked if you see `X-Frame-Options: DENY` or `SAMEORIGIN`, or `frame-ancestors 'self'` / `'none'`.
Then confirm in a browser: open a preview with `?embed=1`, click Get Tickets, and see whether checkout appears.
Important: when a site refuses framing, browsers still fire the iframe `load` event (they show an error page), so the
8-second fallback will NOT trigger. Do not enable it until you have seen checkout render in the modal.

## Open questions for MojoPay
1. May `https://mangh.org` (and `https://*.mangh.org`) frame the checkout (`frame-ancestors`)?
2. Is `ref` (and `utm_*`) recorded against orders, and where do we see it?
3. Does checkout send a `postMessage` to the parent page after a purchase? If so: the exact origin and message
   name(s). Put the names into `SUCCESS_EVENTS` in `assets/ticket-checkout.js`; the "You're in. Make your flyer →" screen is
   already built and only shows for those names, from `https://tickets.mojo-pay.com`.
4. Does MoMo approval (the phone prompt and any redirect back) work inside an iframe, on Android Chrome and iOS Safari?

## Draft note to MojoPay
> Subject: Embedding MojoTickets checkout on mangh.org
>
> Hi team,
>
> For DMC 2026 we would like to keep ticket buyers on mangh.org instead of sending them away to the MojoTickets page.
> We would show your checkout (https://tickets.mojo-pay.com/events/digital-marketers-conference-2026) inside a modal on
> our site. We always show an "Open checkout in a new tab" link next to it, so nobody is blocked if it does not work
> for them.
>
> Could you please:
> 1. Add `https://mangh.org` and `https://*.mangh.org` to the `frame-ancestors` allow-list for the checkout pages (or
>    tell us if there is an embeddable checkout widget or SDK we should use instead)?
> 2. Confirm that a `ref` query parameter on the checkout URL (e.g. `?ref=kwaku`) is recorded against orders, and how we
>    can get that report? We also pass standard `utm_*` parameters.
> 3. Tell us whether the checkout sends a `postMessage` to the parent page after a successful purchase (and its format),
>    so we can show a confirmation message?
> 4. Confirm MoMo approval works when checkout is inside an iframe.
>
> Thank you. Happy to test on a preview link whenever you are ready.

## What still needs a human
- A real MoMo test purchase inside the modal, on an Android phone and an iPhone.
- MojoPay's answers above.
- Check the Instagram, Facebook, TikTok and WhatsApp in-app browsers on real phones (they are detected from the user
  agent and opened in a new tab; simulated in tests only).
