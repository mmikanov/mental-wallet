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

# Send for real — test/preview (NOT recorded; won't affect campaign dedupe):
MESSAGING_BASE_URL=https://mental-wallet-messaging.mentalwallet.workers.dev \
ADMIN_SECRET=YOUR_ADMIN_SECRET \
npm run send:tip -- --slug emotion-based-session --to you@example.com

# Send for real AND record it, so a later campaign for this tip skips this recipient:
MESSAGING_BASE_URL=https://mental-wallet-messaging.mentalwallet.workers.dev \
ADMIN_SECRET=YOUR_ADMIN_SECRET \
npm run send:tip -- --slug emotion-based-session --to jane@example.com --record
```

Available slugs = filenames in `content/tips/` without `.md`
(`emotion-based-session`, `outcome-capture`, `personal-kpi-check-in`,
`learn-more-evidence`, `discover-third-party-apps`).

**`--record`** counts a one-off send toward the tip's dedupe history (writes a `sent` row in
`tip_sends`), so a later campaign for the same tip skips this recipient. Omit it for
test/preview sends (default: not recorded, so previewing to yourself never excludes anyone
from a real campaign).

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
