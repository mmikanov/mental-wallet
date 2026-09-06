# Marketing Website (Cloudflare)

The marketing landing page is hosted on Cloudflare at:
**https://mentalhealthwallet.productsforgood.co/**

It is a **Cloudflare Worker with static assets** (project name `black-hall-1f37`,
shown under **Workers & Pages** in the dashboard). It serves the files in the
`website/` folder — there is no build step. Despite living in the "Workers & Pages"
section, it is a Worker, so it deploys with `wrangler deploy`, **not**
`wrangler pages deploy`.

- Account: `mmikanovsky@gmail.com` (ID `70030d8b376daa37d9db11232d379185`)
- Worker name: `black-hall-1f37`
- Origin URL: `https://black-hall-1f37.mentalwallet.workers.dev`
- Custom domain: `mentalhealthwallet.productsforgood.co` (managed in the dashboard;
  unaffected by deploys)

---

## Deploy Updates (CLI — preferred)

From the `website/` folder:

```bash
cd website
npm install   # first time only, installs wrangler locally
npm run deploy
```

`npm run deploy` runs `wrangler deploy`, which uploads the static assets and
publishes a new version (~10s). The custom domain serves the new files almost
immediately (the HTML is sent with `cache-control: max-age=0, must-revalidate`,
so no cache purge is needed).

### Authentication

Wrangler must be logged in as the account that owns `black-hall-1f37`
(`mmikanovsky@gmail.com`). Check with `npx wrangler whoami`. If it shows a
different account, run `npx wrangler login` (opens a browser) or set
`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (token needs
`Account > Workers Scripts: Edit`) inline for the deploy command.

### Verify after deploy

```bash
# Origin (bypasses any custom-domain edge cache)
curl -s https://black-hall-1f37.mentalwallet.workers.dev/ | grep -o 'apps.apple.com/app/[^"]*'
# Custom domain
curl -s "https://mentalhealthwallet.productsforgood.co/?cb=$(date +%s)" | grep -o 'apps.apple.com/app/[^"]*'
```

### Rollback

Deploys are versioned. Roll back from the dashboard
(Workers & Pages → `black-hall-1f37` → Deployments → pick a prior version), or
via `npx wrangler rollback` from the `website/` folder.

---

## Deploy Updates (dashboard drag-and-drop — alternative)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
2. Click **`black-hall-1f37`**
3. Click **"New deployment"** (Upload)
4. Drag and drop the contents of the `website/` folder (the files inside it, not
   the folder itself). Skip the tooling files listed as "not served" below.
5. Deploy. The custom domain updates within ~30 seconds.

---

## Files

```
website/
├── index.html          # Main landing page
├── privacy.html        # Privacy policy
├── terms.html          # Terms of service
├── subscribe.html      # Email subscribe form (messaging worker)
├── preferences.html    # Manage email preferences (messaging worker)
├── unsubscribe.html    # Unsubscribe confirmation (messaging worker)
├── styles.css          # All styles (incl. consent-page + tips styles)
├── script.js           # FAQ accordion
├── messaging.js        # Consent-page fetch logic (messaging worker)
├── build-content.js    # Generates tips pages from content/tips/*.md (not served)
├── tips/               # GENERATED: /tips index + /tips/<slug> article pages
├── content/index.json  # GENERATED: machine-readable tips index
├── CNAME               # Custom domain config
├── assets/
│   ├── icon.png            # App icon (240px, optimized for web)
│   ├── og-image.jpg        # Social share image (1200×630)
│   ├── app-store-badge.svg
│   ├── google-play-badge.svg
│   └── feature-*.png       # Feature section illustrations
│
│   # Deploy tooling (NOT served — excluded via .assetsignore):
├── wrangler.toml       # Worker config (name + assets directory)
├── .assetsignore       # Keeps tooling/temp files out of the served assets
├── package.json        # `npm run deploy` script + local wrangler
├── package-lock.json
└── node_modules/       # local wrangler install
```

The App Store / Google Play links live in `index.html` (hero section and the
bottom CTA). The App Store URL should match `APP_STORE_URL` in
`src/config/appInfo.ts`.

### Tips content (generated from markdown)

The tips pages are **generated** from `content/tips/*.md` by a build script, not
hand-written. Run the build before deploying any content change:

```bash
cd website
npm install            # first time only (installs marked)
npm run build:content
```

This reads every `content/tips/*.md` and generates (into `website/`):

```
website/
├── tips/
│   ├── index.html          # /tips  — searchable/filterable index page
│   └── <slug>.html         # /tips/<slug> — one article page per tip
└── content/
    └── index.json          # machine-readable index (web index + future in-app feed)
```

- URLs: the index is at **`/tips`**, each article at **`/tips/<slug>`** (Cloudflare serves
  the extensionless form).
- The build is idempotent and cleans orphaned pages (a tip removed from `content/tips/`
  disappears from the site on the next build).
- The build needs NO network or database — safe to run and preview anytime. Open the
  generated files directly in a browser to preview.
- `build-content.js` is excluded from served assets via `.assetsignore`; the generated
  `tips/` pages and `content/index.json` ARE served.
- Authoring format for tips: `content/tips/README.md`.

**Order of operations for a content change:** edit markdown in `content/tips/` → run
`npm run build:content` → `npm run deploy`.

### Email consent pages (talk to the messaging worker)

Three additional static pages let people manage the email/reminder subscription owned by
the messaging worker (`messaging-worker/`). They are plain HTML + `messaging.js` (no build
step) and call the worker over `fetch()`:

```
website/
├── subscribe.html      # opt-in form (email, first name, tips/reminders scopes)
├── preferences.html    # manage scopes; reads ?token= from the URL
├── unsubscribe.html    # one-click unsubscribe confirmation; reads ?token=
└── messaging.js        # shared worker base URL + fetch helpers + email validator
```

- Worker base URL is set once in `messaging.js`
  (`https://mental-wallet-messaging.mentalwallet.workers.dev`).
- Endpoints used: `POST /subscribe`, `GET /preferences?token=` (read current scopes),
  `POST /preferences` (save), `GET /unsubscribe?token=` (disable all).
- The email footer links "Manage preferences" and "Unsubscribe" point at
  `preferences.html?token=...` and `unsubscribe.html?token=...` on this site.
- CORS: the worker allows this site's origin (`SITE_ORIGIN` in the worker's
  `wrangler.toml`). If the site origin ever changes, update `SITE_ORIGIN` and redeploy the
  worker.
- Full worker docs: `messaging-worker/README.md`.

---

## DNS Setup

- Domain registrar: DreamHost
- DNS managed by: Cloudflare (nameservers: `lady.ns.cloudflare.com`, `newt.ns.cloudflare.com`)
- Subdomain `mentalhealthwallet` points to the `black-hall-1f37` Worker via a
  custom domain binding

---

## Subscriber list (messaging worker)

The email subscriber list is owned by the **messaging worker** (a separate project,
`messaging-worker/`), not the marketing site. Full docs: `messaging-worker/README.md`.
Noted here because the subscribe/preferences forms live on this website and this is a
handy place to find the "who's on my list" command.

Live worker: `https://mental-wallet-messaging.mentalwallet.workers.dev`

List everyone currently opted into a scope (`tips` = tips & newsletter,
`reminders` = come-back nudges). Requires the admin secret (`ADMIN_SECRET`, set via
`wrangler secret put` on the messaging worker). Wrap the URL in **single quotes** so zsh
doesn't choke on the `&`:

```bash
# Tips & newsletter opt-ins
curl -s 'https://mental-wallet-messaging.mentalwallet.workers.dev/subscribers?scope=tips&secret=YOUR_ADMIN_SECRET' | python3 -m json.tool

# Come-back reminder opt-ins
curl -s 'https://mental-wallet-messaging.mentalwallet.workers.dev/subscribers?scope=reminders&secret=YOUR_ADMIN_SECRET' | python3 -m json.tool
```

Returns `{ scope, count, recipients: [{ email, first_name, unsubscribe_token, source }] }`.
Only one scope per call (`tips` or `reminders`). `401` = wrong secret; `400` = missing/mistyped scope.
