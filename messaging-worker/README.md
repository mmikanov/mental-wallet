# Messaging Worker

Consent + email-sending backend for Mental Health Wallet. Runs on Cloudflare Workers with
its own D1 (SQLite) database and sends email via [Resend](https://resend.com).

It is a **separate** project from the analytics worker (own `package.json`, `tsconfig.json`,
`wrangler.toml`, `node_modules`). This separation is deliberate: `analytics-worker` is
anonymous by design (no PII), while this worker stores subscriber **email addresses**.
Keeping PII out of the anonymous analytics database is a privacy boundary.

Implements the `messaging-foundation` spec (`.kiro/specs/messaging-foundation/`).

## Architecture

```
Marketing website forms (Phase C)
  → POST /subscribe, POST /preferences, GET /unsubscribe   (public, CORS)
  → messaging-worker → D1 (messaging-db): subscribers

Operator (send path)
  → GET  /subscribers?scope=tips&secret=...   (recipient list)
  → POST /send-test&secret=...                (send via Resend)
  → messaging-worker → Resend API → inbox
```

## Consent scopes

Two independent scopes: `reminders` (come-back nudges) and `tips` (tips & newsletter).
A subscriber may opt into any subset (including none = unsubscribed, record retained).

## API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/subscribe` | POST | None (CORS) | Create/update a subscriber's scopes. Body: `{ email, first_name?, reminders?, tips?, source? }` |
| `/preferences` | POST | None (token) | Update scopes via token. Body: `{ token, reminders?, tips? }` |
| `/unsubscribe` | GET | None (token) | Disable all scopes. `?token=...`. One-click unsubscribe target. |
| `/subscribers` | GET | Secret | List recipients opted into a scope. `?scope=tips\|reminders` |
| `/send-test` | POST | Secret | Send one email via Resend to a consenting address. Body: `{ email, scope?, subject?, body? }` |
| `/send-tip` | POST | Secret | Send an authored tip to a consenting address. Body: `{ email, scope?, tip: { title, summary, body?, heroImage?, cta? } }` |
| `/health` | GET | None | Health check |

Admin auth is via `?secret=<ADMIN_SECRET>` or `Authorization: Bearer <ADMIN_SECRET>`.

Sends are consent-enforced server-side: `/send-test` returns `409` if the address is not
opted into the requested scope. Every email includes `List-Unsubscribe` +
`List-Unsubscribe-Post` headers and a footer preferences/unsubscribe link, and greets by
`first_name` (falling back to "Hi there,").

## First-Time Setup (account-bound — run these yourself)

These require your Cloudflare and Resend accounts.

### 1. Install dependencies

```bash
cd messaging-worker
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Create the D1 database

```bash
npx wrangler d1 create messaging-db
```

Copy the returned `database_id` into `wrangler.toml` (replace `REPLACE_WITH_D1_DATABASE_ID`).

### 4. Run the migration

```bash
npm run db:migrate:local    # local dev DB
npm run db:migrate:remote   # production D1
```

### 5. Set secrets

```bash
npx wrangler secret put ADMIN_SECRET      # a strong random string (protects /subscribers, /send-test)
npx wrangler secret put RESEND_API_KEY    # from https://resend.com/api-keys
```

### 6. Verify the sending domain in Resend

- In Resend, add and verify the domain `productsforgood.co`.
- Resend gives you DKIM / SPF / DMARC DNS records. Add them in the **Cloudflare DNS**
  zone that already hosts the marketing site.
- Wait for Resend to show the domain as **Verified**.
- Sender identity is configured in `wrangler.toml`:
  `EMAIL_FROM = "Mental Health Wallet <moshe@productsforgood.co>"`, replies to
  `moshe@productsforgood.co`.

### 7. Deploy

```bash
npm run deploy
```

Wrangler prints the Worker URL, e.g. `https://mental-wallet-messaging.<subdomain>.workers.dev`.

### 8. Seed the warm-launch opt-ins

Imports opted-in interviewees from the LOCAL, gitignored `docs/warm-launch-messages.md`
into **both** scopes with `source='warm_launch'`. Runs locally; never commits PII.

```bash
# Preview without sending:
DRY_RUN=1 npm run seed:warm-launch

# Seed against production:
MESSAGING_BASE_URL=https://mental-wallet-messaging.<subdomain>.workers.dev npm run seed:warm-launch
```

Verify: `curl "https://.../subscribers?scope=tips&secret=<ADMIN_SECRET>"`.

### 9. Send a production test

```bash
curl -X POST "https://mental-wallet-messaging.<subdomain>.workers.dev/send-test?secret=<ADMIN_SECRET>" \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@yourdomain.com","scope":"tips","subject":"Test","body":"Hello."}'
```

(The recipient must already be subscribed to that scope, or you'll get a `409`.)

## Send a tip

Tips are authored as markdown in `content/tips/` (see `content/tips/README.md` for the
frontmatter schema). To send a tip, the `send-tip.ts` script reads the markdown by slug,
parses its frontmatter + body, and posts it to the worker's `/send-tip` endpoint. The tip
copy stays in the markdown file (single source of truth) — you don't retype it.

```bash
# Preview the parsed tip + payload without sending:
DRY_RUN=1 npm run send:tip -- --slug emotion-based-session --to you@example.com

# Send for real (recipient must be subscribed to the scope):
MESSAGING_BASE_URL=https://mental-wallet-messaging.<subdomain>.workers.dev \
ADMIN_SECRET=<ADMIN_SECRET> \
npm run send:tip -- --slug emotion-based-session --to you@example.com
```

Options: `--scope tips|reminders` (default `tips`), `--tips-dir <path>` (default
`../content/tips`). Note the `--` before script args when using `npm run`.

The tip email includes a personalized greeting, the hero image (if the tip sets one), the
summary (and body), the CTA link, and the same `List-Unsubscribe` headers + footer as all
other sends. Consent is enforced: a non-subscribed address returns `409`.

Available slugs are the filenames in `content/tips/` (without `.md`), e.g.
`emotion-based-session`, `outcome-capture`, `personal-kpi-check-in`, `learn-more-evidence`,
`discover-third-party-apps`.

## Local Development

```bash
npm run dev                 # starts on http://localhost:8787 (Miniflare, local D1)
npm run db:migrate:local    # run once to create the local schema
```

For local admin auth, create a `.dev.vars` (gitignored):

```
ADMIN_SECRET=local-test-secret
RESEND_API_KEY=re_local_placeholder
```

Example local checks:

```bash
curl -X POST http://localhost:8787/subscribe -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","first_name":"A","tips":true,"reminders":true}'
curl "http://localhost:8787/subscribers?scope=tips&secret=local-test-secret"
```

## Typecheck

```bash
npm run typecheck   # tsc --noEmit
```

## Updating the Schema

Add a numbered migration and apply it before deploying dependent code:

```bash
npx wrangler d1 execute messaging-db --local  --file=./migrations/0002_your_change.sql
npx wrangler d1 execute messaging-db --remote --file=./migrations/0002_your_change.sql
```

## Follow-ups (not in Phase A)

- **Rate limiting** on the public endpoints (Cloudflare rules or a per-IP counter).
- **Batch campaign send** (Phase C) — `/send-test` proves the path; bulk sending to a
  scope's recipient list is built later.
