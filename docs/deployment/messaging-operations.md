# Messaging — Operations & Testing Reference

Quick command reference for the email/reminder messaging system (subscribers, sending,
consent pages). Copy-paste friendly.

- **Worker (API):** `https://mental-wallet-messaging.mentalwallet.workers.dev`
- **Website (consent pages):** `https://mentalhealthwallet.productsforgood.co`
- **Worker code:** `messaging-worker/` (full docs: `messaging-worker/README.md`)
- **Sender:** `moshe@productsforgood.co` (via Resend)

> **Secrets:** `ADMIN_SECRET` protects the admin commands below; `RESEND_API_KEY` lets the
> worker send. Both are stored as Wrangler secrets (not in the repo). Put `ADMIN_SECRET`
> directly in your terminal when running commands; don't paste it into files or chat.

> **zsh tip:** always wrap any URL containing `&` in **single quotes**, or zsh will hang
> with a `dquote>` prompt. (Press Ctrl+C to escape that prompt.)

---

## Consent page URLs (for people)

| Page | URL |
|------|-----|
| Subscribe | `https://mentalhealthwallet.productsforgood.co/subscribe` |
| Preferences | `https://mentalhealthwallet.productsforgood.co/preferences?token=<TOKEN>` |
| Unsubscribe | `https://mentalhealthwallet.productsforgood.co/unsubscribe?token=<TOKEN>` |

Preferences/unsubscribe need a per-person `token` (delivered via email links). To test them
by hand, grab a token from the subscriber list command below.

---

## Subscribers

### List who's opted in

```bash
# Tips & newsletter opt-ins
curl -s 'https://mental-wallet-messaging.mentalwallet.workers.dev/subscribers?scope=tips&secret=YOUR_ADMIN_SECRET' | python3 -m json.tool

# Come-back reminder opt-ins
curl -s 'https://mental-wallet-messaging.mentalwallet.workers.dev/subscribers?scope=reminders&secret=YOUR_ADMIN_SECRET' | python3 -m json.tool
```

Returns `{ scope, count, recipients: [{ email, first_name, unsubscribe_token, source }] }`.
One scope per call. The `unsubscribe_token` is what you append to preferences/unsubscribe URLs.

### Subscribe someone (same as the website form does)

```bash
curl -s -X POST 'https://mental-wallet-messaging.mentalwallet.workers.dev/subscribe' \
  -H 'Content-Type: application/json' \
  -d '{"email":"person@example.com","first_name":"Sam","tips":true,"reminders":true}'
```

### Read one person's current preferences (by token)

```bash
curl -s 'https://mental-wallet-messaging.mentalwallet.workers.dev/preferences?token=THEIR_TOKEN' | python3 -m json.tool
```

### Change preferences / unsubscribe (by token)

```bash
# Update scopes
curl -s -X POST 'https://mental-wallet-messaging.mentalwallet.workers.dev/preferences' \
  -H 'Content-Type: application/json' \
  -d '{"token":"THEIR_TOKEN","tips":true,"reminders":false}'

# Unsubscribe from everything (idempotent)
curl -s 'https://mental-wallet-messaging.mentalwallet.workers.dev/unsubscribe?token=THEIR_TOKEN'
```

---

## Sending

### Send a plain test email

Recipient must already be subscribed to the scope, or you get `409`.

```bash
curl -s -X POST 'https://mental-wallet-messaging.mentalwallet.workers.dev/send-test?secret=YOUR_ADMIN_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","scope":"tips","subject":"Test","body":"Hello."}'
```

### Send an authored tip (from content/tips/*.md)

Reads the tip markdown, renders it, and emails it. Recipient must be subscribed.

```bash
# Preview only (no send):
DRY_RUN=1 npm run send:tip -- --slug emotion-based-session --to you@example.com

# Send for real:
MESSAGING_BASE_URL=https://mental-wallet-messaging.mentalwallet.workers.dev \
ADMIN_SECRET=YOUR_ADMIN_SECRET \
npm run send:tip -- --slug emotion-based-session --to you@example.com
```

Available slugs = filenames in `content/tips/` without `.md`
(`emotion-based-session`, `outcome-capture`, `personal-kpi-check-in`,
`learn-more-evidence`, `discover-third-party-apps`).

> The old `--record` flag was **removed**. Dedupe is now per **campaign**, not per tip, so a
> one-off `/send-tip` has no campaign to record against and is never written to `tip_sends`.
> (See "Drip automation" below.)

---

## Campaigns (batch send to the whole list)

A campaign = "send tip X to scope Y in mode Z", executed by id. Individual per-recipient
emails (never BCC), de-duplicated by tip so re-runs reach only new sign-ups. Full docs:
`messaging-worker/README.md`.

### Create / list / inspect

```bash
# Create a campaign (name must be unique; mode defaults to new_only)
curl -s -X POST 'https://mental-wallet-messaging.mentalwallet.workers.dev/campaigns?secret=YOUR_ADMIN_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Welcome wave","tip_slug":"welcome","scope":"tips","mode":"new_only"}'

# List all campaigns (with send counts)
curl -s 'https://mental-wallet-messaging.mentalwallet.workers.dev/campaigns?secret=YOUR_ADMIN_SECRET' | python3 -m json.tool

# One campaign
curl -s 'https://mental-wallet-messaging.mentalwallet.workers.dev/campaigns/CAMPAIGN_ID?secret=YOUR_ADMIN_SECRET' | python3 -m json.tool

# Delete (send history preserved; dedupe survives)
curl -s -X DELETE 'https://mental-wallet-messaging.mentalwallet.workers.dev/campaigns/CAMPAIGN_ID?secret=YOUR_ADMIN_SECRET'
```

### Run a campaign (preview, then send)

Use the driver script (from `messaging-worker/`), which loops chunks with pacing:

```bash
# 1) PREVIEW first — lists WHO would receive it (and the count), sends nothing:
MESSAGING_BASE_URL=https://mental-wallet-messaging.mentalwallet.workers.dev \
ADMIN_SECRET=YOUR_ADMIN_SECRET \
npm run run:campaign -- --id CAMPAIGN_ID --mode dry-run

# 2) SEND for real (only after the preview looks right):
MESSAGING_BASE_URL=https://mental-wallet-messaging.mentalwallet.workers.dev \
ADMIN_SECRET=YOUR_ADMIN_SECRET \
npm run run:campaign -- --id CAMPAIGN_ID --mode production
```

- `--mode` is required; there is no default, so you can never send by forgetting a flag.
- Safe to interrupt/re-run: already-sent recipients are skipped (idempotent).
- **Send ONE message first, then observe** (per `docs/message-release-plan.md`) rather than
  a backlog dump.

**N-day gap guard (always on; generalizes the old same-day guard):** each campaign has a
`gap_days` (min/default **1**). A campaign **excludes anyone who received an email from us in
the last `gap_days` days**, across ALL campaigns — not just this one. `gap_days = 1` is
exactly the old "no two emails on the same day". Larger values add deliberate spacing (used by
the drip sequence). Details:

- The cutoff is computed in **UTC**. Only actually-**sent** emails count; a `pending`/`failed`
  attempt does NOT shield a recipient.
- The **dry-run already reflects this** — the previewed list is the post-gap audience.
- Excluded-only-by-the-gap recipients are **deferred, not marked** as having received the
  campaign; a later run reaches them once the gap passes.
- Set a campaign's gap via `gap_days` on create/update (`POST`/`PATCH /campaigns`).
- Layers on top of consent + **per-campaign** dedupe (dedupe changed from per-tip; see below).

---

## Seeding

### Import the warm-launch opt-ins (one-time / re-runnable)

Reads the gitignored `docs/warm-launch-messages.md`, subscribes opted-in people to BOTH
scopes. Runs from `messaging-worker/`.

```bash
# Preview:
DRY_RUN=1 npm run seed:warm-launch

# Real:
MESSAGING_BASE_URL=https://mental-wallet-messaging.mentalwallet.workers.dev npm run seed:warm-launch
```

---

## Health & deploys

```bash
# Is the worker up?
curl -s https://mental-wallet-messaging.mentalwallet.workers.dev/health

# Redeploy the worker (from messaging-worker/)
npm run deploy

# Redeploy the website / consent pages (from website/)
npm run deploy

# Live worker logs (from messaging-worker/)
npm run tail
```

---

## Drip automation (daily sequence)

The drip sends a single global, ordered **sequence** of campaigns automatically once a day
(Cloudflare Cron Trigger, 14:00 UTC). Subscribers move through it one at a time. Full design:
`.kiro/specs/messaging-drip-automation/`; worker docs: `messaging-worker/README.md`.

> **Operator admin page (easiest way to do all of this):**
> `https://mental-wallet-messaging.mentalwallet.workers.dev/admin?secret=YOUR_ADMIN_SECRET`
> — a private, secret-gated web UI with Status / Sequence (build + edit) / Preview / Testing
> panels. The curl commands below remain valid alongside it.

- **Dedupe is per campaign** now (changed from per tip, migration `0004`): the same tip can be
  sent by more than one campaign. `tip_sends` is keyed by `(campaign_id, email)`.
- **Per-campaign `gap_days`** (migration `0005`, min/default 1): the N-day gap guard above.
- **Build the sequence by hand** (no seed script); intended via the admin UI once built. An
  **empty sequence = the daily run sends nothing**, so it is safe to leave empty.
- The engine ships **paused**. Nothing goes out until the sequence is built and you `resume`.
- Tip content for the cron comes from the marketing site's `/content/index.json` (the worker
  can't read `content/tips/*.md`).

```bash
# All admin; wrap any URL containing & in single quotes.
# Status (paused/running + next run) and pause/resume
curl -s 'https://mental-wallet-messaging.mentalwallet.workers.dev/drip/status?secret=YOUR_ADMIN_SECRET' | python3 -m json.tool
curl -s -X POST 'https://mental-wallet-messaging.mentalwallet.workers.dev/drip/pause?secret=YOUR_ADMIN_SECRET'
curl -s -X POST 'https://mental-wallet-messaging.mentalwallet.workers.dev/drip/resume?secret=YOUR_ADMIN_SECRET'

# View / build / edit the sequence
curl -s 'https://mental-wallet-messaging.mentalwallet.workers.dev/drip/sequence?secret=YOUR_ADMIN_SECRET' | python3 -m json.tool
curl -s -X POST 'https://mental-wallet-messaging.mentalwallet.workers.dev/drip/sequence/steps?secret=YOUR_ADMIN_SECRET' -H 'Content-Type: application/json' -d '{"campaign_id":"<id>"}'
curl -s -X PATCH 'https://mental-wallet-messaging.mentalwallet.workers.dev/drip/sequence/steps/<stepId>?secret=YOUR_ADMIN_SECRET' -H 'Content-Type: application/json' -d '{"position":2}'
curl -s -X DELETE 'https://mental-wallet-messaging.mentalwallet.workers.dev/drip/sequence/steps/<stepId>?secret=YOUR_ADMIN_SECRET'

# Preview the next real run (dry-run, no sends)
curl -s -X POST 'https://mental-wallet-messaging.mentalwallet.workers.dev/drip/preview?secret=YOUR_ADMIN_SECRET' | python3 -m json.tool

# Time-travel testing (test-only subscribers)
curl -s -X POST 'https://mental-wallet-messaging.mentalwallet.workers.dev/drip/test/create?secret=YOUR_ADMIN_SECRET'   # REPLACE cohort (ages derived from the sequence)
curl -s -X POST 'https://mental-wallet-messaging.mentalwallet.workers.dev/drip/test/reset?secret=YOUR_ADMIN_SECRET'    # KEEP cohort, clear send history
curl -s -X POST 'https://mental-wallet-messaging.mentalwallet.workers.dev/drip/simulate?secret=YOUR_ADMIN_SECRET' -H 'Content-Type: application/json' -d '{"startDate":"2026-02-10","days":14,"mode":"dry-run"}' | python3 -m json.tool
```

---

## Response cheat-sheet

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad input (invalid email, missing token/fields, missing/invalid execute `mode`) |
| `401` | Wrong or missing `ADMIN_SECRET` (admin commands only) |
| `404` | Unknown token (preferences read) / unknown campaign id |
| `409` | Recipient not opted into that scope (send-test); duplicate campaign name; editing a sent/sending campaign |
| `502` | Resend send failed (check `RESEND_API_KEY` / domain verified) |

---

## Local testing (no production, no real emails)

From `messaging-worker/`:

```bash
npm run dev                 # http://localhost:8787 (local D1)
npm run db:migrate:local    # once, to create the local schema
```

Create a `.dev.vars` (gitignored) for local admin/send:

```
ADMIN_SECRET=local-test-secret
RESEND_API_KEY=re_local_placeholder
```

Then use the commands above against `http://localhost:8787` instead of the live URL.
(With the placeholder key, sends reach Resend and return `502 API key is invalid` — that's
expected and confirms the request is well-formed.)
