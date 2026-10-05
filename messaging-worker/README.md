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

> The old `--record` flag was **removed**. Dedupe is now per **campaign**, not per tip
> (see the drip automation change below), so a one-off `/send-tip` has no campaign to
> record against and is never written to `tip_sends`.

The tip email includes a personalized greeting, the hero image (if the tip sets one), the
summary (and body), the CTA link, and the same `List-Unsubscribe` headers + footer as all
other sends. Consent is enforced: a non-subscribed address returns `409`.

Available slugs are the filenames in `content/tips/` (without `.md`), e.g.
`emotion-based-session`, `outcome-capture`, `personal-kpi-check-in`, `learn-more-evidence`,
`discover-third-party-apps`.

## Campaigns (batch send to a whole scope)

A **campaign** is a stored, reusable definition of "send tip X to scope Y in mode Z",
executed by id. Send-to-all uses many **individual** per-recipient emails (never BCC),
de-duplicated by tip so re-runs reach only new sign-ups. Spec:
`.kiro/specs/messaging-batch-send/`.

Endpoints (all admin-only):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/campaigns` | POST | Create `{ name (unique), tip_slug, scope, mode? }` |
| `/campaigns` | GET | List all campaigns + send counts |
| `/campaigns/:id` | GET | One campaign + counts |
| `/campaigns/:id` | PUT/PATCH | Edit a draft/paused campaign (blocked once sending/sent) |
| `/campaigns/:id` | DELETE | Delete campaign (send history in `tip_sends` is preserved) |
| `/campaigns/:id/execute` | POST | Execute one chunk; body `{ mode, tip?, limit? }` |

- `mode` on **execute** is REQUIRED and must be `dry-run` or `production` (no default —
  omitting it never sends).
- `mode` on the **campaign** is `new_only` (default; reaches only those who haven't received
  the tip) or `resend_all` (deliberately re-sends the tip to everyone; clears the tip's send
  history at run start).
- Dedupe is keyed by **campaign id** (changed from tip slug — see the drip automation
  section below). The same tip can be sent by more than one campaign; each campaign tracks
  who it has reached independently. `resend_all` clears **that campaign's** send history.

### Run a campaign (driver script)

`run-campaign.ts` reads the campaign, parses its tip markdown, and loops execute-chunks with
pacing until done.

```bash
# Preview (lists who would receive it + count, no send):
MESSAGING_BASE_URL=https://mental-wallet-messaging.<subdomain>.workers.dev \
ADMIN_SECRET=<ADMIN_SECRET> \
npm run run:campaign -- --id <campaignId> --mode dry-run

# Send for real:
MESSAGING_BASE_URL=... ADMIN_SECRET=... \
npm run run:campaign -- --id <campaignId> --mode production
```

Options: `--limit <n>` (chunk size, default 50), `--pace-ms <n>` (delay between chunks,
default 1000). Interrupting is safe — resume by running again; already-sent recipients are
skipped (idempotent via a per-campaign send record + a Resend idempotency key).

### Migrations

Campaigns use two additional tables (`campaigns`, `tip_sends`), created by
`0002_create_campaigns.sql` and `0003_create_tip_sends.sql`. `npm run db:migrate:local` /
`db:migrate:remote` apply all migrations in order.

## Drip Automation (daily sequence)

Implements the `messaging-drip-automation` spec. A single global, ordered **sequence** of
campaigns that every subscriber moves through one at a time, sent automatically once a day by
a Cloudflare **Cron Trigger** (`0 14 * * *`, i.e. 14:00 UTC — see `wrangler.toml [triggers]`
and `DRIP_CRON_HOUR_UTC` in `src/index.ts`).

Key model (vs. the manual campaigns above):

- **Per-campaign dedupe** (migration `0004`): `tip_sends` is keyed by `(campaign_id, email)`,
  not `(tip_slug, email)`. A tip MAY recur via a different campaign later in the sequence.
- **N-day gap** (migration `0005`): each campaign has `gap_days` (min/default 1). A subscriber
  is eligible for a campaign only if they received no email in the last `gap_days` days. A gap
  of 1 = the old "no two emails on the same day". The gap carries over: a subscriber not yet
  caught up on an earlier step can't jump ahead.
- **Derived position** (migration `0006`, `sequence_steps`): a subscriber's next campaign is
  the earliest enabled step they haven't received and are eligible for — computed live, never
  stored, so editing the sequence just works.
- **Content** is fetched at run time from the marketing site's `${SITE_ORIGIN}/content/index.json`
  (title/summary/heroImage/cta per slug). The worker has no filesystem; the cron can't read
  `content/tips/*.md`, so it reads the published index instead.
- **Run state** (migration `0007`, `drip_state`): `paused` flag + `running_since` +
  `last_run_at`.
- **Test subscribers** (migration `0008`, `subscribers.is_test`): isolated, relative-age
  testers for the time-travel harness; never mixes with real subscribers.

### Endpoints (all admin; wrap `&` URLs in single quotes)

```bash
B=https://mental-wallet-messaging.mentalwallet.workers.dev
S=<ADMIN_SECRET>

# Status: paused/running + next scheduled run
curl -s "$B/drip/status?secret=$S" | python3 -m json.tool

# Pause / resume the daily automation
curl -s -X POST "$B/drip/pause?secret=$S"
curl -s -X POST "$B/drip/resume?secret=$S"

# View / edit the sequence (build it one step at a time; no seed script)
curl -s "$B/drip/sequence?secret=$S" | python3 -m json.tool
curl -s -X POST "$B/drip/sequence/steps?secret=$S" -H 'Content-Type: application/json' \
  -d '{"campaign_id":"<id>"}'                 # append a campaign as a step
curl -s -X PATCH "$B/drip/sequence/steps/<stepId>?secret=$S" -H 'Content-Type: application/json' \
  -d '{"position":2}'                          # reorder; or {"enabled":false} to disable
curl -s -X DELETE "$B/drip/sequence/steps/<stepId>?secret=$S"   # remove (keeps the campaign)

# Preview the next real run (dry-run, no sends; optional {"asOf":"YYYY-MM-DD"})
curl -s -X POST "$B/drip/preview?secret=$S" | python3 -m json.tool

# Time-travel testing (test-only subscribers; never touches real ones)
curl -s -X POST "$B/drip/test/create?secret=$S"   # REPLACE cohort; ages derived from the sequence
curl -s -X POST "$B/drip/test/reset?secret=$S"    # KEEP cohort, clear their send history
curl -s -X POST "$B/drip/simulate?secret=$S" -H 'Content-Type: application/json' \
  -d '{"startDate":"2026-02-10","days":14,"mode":"dry-run"}' | python3 -m json.tool
#   dry-run advances state VIRTUALLY (no email) so you see the full day-by-day progression;
#   run test/reset or test/create afterward to clear the virtual sends.
#   mode:"production" actually sends, ONLY to the test cohort.
```

### Admin page (operator UI)

A private, operator-only web page drives all of the above without curl:

```
https://mental-wallet-messaging.<subdomain>.workers.dev/admin?secret=<ADMIN_SECRET>
```

Secret-gated (same `ADMIN_SECRET`), not linked anywhere public, `noindex`. It is a thin
presentation layer over the `/drip/*` endpoints (no sending logic of its own). Panels:

- **Status** — paused/running badge, next-run countdown, pause/resume.
- **Sequence** — view the ordered steps; build from scratch and edit (add from a campaign
  picker, reorder, enable/disable, remove, inline gap-days). Changes auto-save.
- **Preview** — dry-run of the next real run (no emails).
- **Testing** — create (replace) / reset (keep) the test cohort, and run the day-by-day
  time-travel simulation (dry-run advances state virtually; send-to-test delivers only to
  test users, behind a confirm).

Real-send actions are gated by a confirmation; safe actions (view/preview/dry-run/edits) are
not. Built per the `messaging-drip-admin-ui` spec.

### Build the live sequence

There is **no seed script** — build the sequence by adding steps (the editorial order lives
in `docs/message-release-plan.md`), easiest via the **admin page** above. An **empty sequence
makes the daily run a no-op** (sends nothing), so it is safe to deploy before the sequence
exists.

### Safety

The daily cron sends to real `tips`/`reminders` subscribers once the sequence is non-empty
and the drip is not paused. To hold sends, `POST /drip/pause`. The engine ships **paused** so
nothing goes out until you build the sequence and `resume`.

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
