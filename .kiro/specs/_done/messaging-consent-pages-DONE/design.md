# Design Document

## Overview

C1 adds three static HTML pages to the marketing site (`website/`) plus one small public
read-endpoint on the messaging worker. The pages are plain HTML/CSS/JS that reuse the
existing `styles.css`, nav, and footer, and call the messaging worker over `fetch()`.
No build step is introduced (consistent with `docs/deployment/marketing-website.md`).

Cross-origin note: the site is served from `mentalhealthwallet.productsforgood.co` and the
worker from `mental-wallet-messaging.mentalwallet.workers.dev`, so the browser calls are
cross-origin. The worker already sends permissive CORS for its public endpoints; C1
confirms the read-endpoint does too.

## New website pages

```
website/
├── subscribe.html       # opt-in form
├── preferences.html     # manage scopes (token from URL)
├── unsubscribe.html     # one-click unsubscribe confirmation (token from URL)
└── messaging.js         # shared fetch logic for the three pages
```

All three reuse the existing nav/footer markup and `styles.css`. A small `messaging.js`
holds the worker base URL and the fetch helpers so the HTML stays declarative.

### Worker base URL

`messaging.js` defines `const MESSAGING_BASE = 'https://mental-wallet-messaging.mentalwallet.workers.dev';`
(the live worker). Kept in one place so it's easy to change.

### subscribe.html

- Fields: email (required), first name (optional), two checkboxes (`tips`, `reminders`,
  both default checked), submit button.
- Client-side email format check with inline error (UX aid; worker still authoritative).
- On submit: `POST {MESSAGING_BASE}/subscribe` with `{ email, first_name, tips, reminders,
  source: 'website' }`. Show success or friendly error. Uniform success message.
- Copy: explains each scope, that email is used only for the chosen messages, and links to
  the Privacy Policy. Clarifies this is separate from the app's anonymous analytics.

### preferences.html

- Reads `token` from `location.search`.
- On load: `GET {MESSAGING_BASE}/preferences?token=...` to fetch current scope states, then
  pre-checks the boxes. If token missing/invalid → friendly message + link to subscribe.
- Save: `POST {MESSAGING_BASE}/preferences` with `{ token, tips, reminders }`; confirm.
- Includes an "unsubscribe from everything" link/button (either unchecks both and saves, or
  links to unsubscribe.html with the same token).

### unsubscribe.html

- Reads `token` from `location.search`.
- On load (or on an explicit confirm button): call the worker to disable all scopes for the
  token, then show a uniform "you've been unsubscribed" confirmation (idempotent; same
  message whether or not the token existed).
- Offers links to re-subscribe or manage preferences.
- Design choice: use `GET {MESSAGING_BASE}/unsubscribe?token=...` (existing endpoint) via
  fetch, OR keep it purely as the worker's own rendered page. Chosen approach: the website
  page performs the fetch so the branded confirmation matches the site; the worker's
  built-in HTML page remains as a still-valid fallback for the raw endpoint.

## Worker change: read current preferences

Add a **GET** handler for `/preferences` (the POST handler stays as-is). Currently
`/preferences` only accepts POST; a GET with a `token` query returns the current scopes.

```
GET /preferences?token=...   (public, token-gated, no admin secret)
  200 -> { ok: true, scopes: { tips: bool, reminders: bool }, first_name: string|null }
  200 -> uniform "not found" shape when token unknown (no enumeration detail),
         e.g. { ok: false } with 404, matching the POST 404 style
```

Routing: in the `fetch` handler, branch `/preferences` by method — `GET` → new
`handleGetPreferences`, `POST` → existing `handlePreferences`. CORS already applied via the
shared `corsHeaders`/`jsonResponse` helpers.

`handleGetPreferences`:
- Read `token` from query; if empty → 400.
- Look up subscriber by `unsubscribe_token`; if none → 404 uniform.
- Return `{ ok: true, scopes: { tips, reminders }, first_name }`.

No new DB columns; reuses the `subscribers` table and existing `SubscriberRow`.

## CORS

The public endpoints already return `Access-Control-Allow-Origin: SITE_ORIGIN` (via
`corsHeaders(env)`), and preflight `OPTIONS` is handled. The new GET `/preferences` uses
the same `jsonResponse` helper, so it inherits CORS. Verify `SITE_ORIGIN` in the worker
matches the site origin exactly so browser calls are allowed.

## Testing strategy

- Worker: typecheck; local `wrangler dev` — `GET /preferences?token=<valid>` returns
  current scopes; unknown token → 404 uniform; missing token → 400. Existing `POST
  /preferences`, `/subscribe`, `/unsubscribe` unchanged.
- Pages (local): open each HTML against the local or live worker; confirm subscribe creates
  a row, preferences pre-fills and saves, unsubscribe zeroes scopes and confirms.
- End-to-end (operator, after deploy): from a real tip/test email, click "Manage
  preferences" and "Unsubscribe" and confirm both now land on the branded pages and work.
- Accessibility: pages include skip link, labelled inputs, and pass basic keyboard nav.

## Documentation

- Update `docs/deployment/marketing-website.md`: list the new files and describe that they
  call the messaging worker (with the worker base URL and the endpoints used).
- Note the email links (`/preferences`, `/unsubscribe`) now resolve to these pages.
