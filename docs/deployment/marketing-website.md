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
├── styles.css          # All styles
├── script.js           # FAQ accordion
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

---

## DNS Setup

- Domain registrar: DreamHost
- DNS managed by: Cloudflare (nameservers: `lady.ns.cloudflare.com`, `newt.ns.cloudflare.com`)
- Subdomain `mentalhealthwallet` points to the `black-hall-1f37` Worker via a
  custom domain binding
