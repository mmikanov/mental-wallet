# Design Document

## Overview

A new `messaging-worker/` (Cloudflare Worker + its own D1 database `messaging-db`) owns subscriber consent and email sending. It is a sibling to `analytics-worker/` and follows the same conventions: a single `src/index.ts` with a `fetch` router, shared `corsResponse` / `isAuthorized` / `unauthorizedResponse` helpers, SQL migration files, a `wrangler.toml`, and `dev` / `deploy` / `db:migrate:*` npm scripts. It integrates Resend for sending.

A separate worker and database (not the anonymous `analytics-worker`) keeps subscriber PII isolated from the deliberately-anonymous analytics data.

## Architecture

```
Marketing website forms (Phase C)
  → POST /subscribe, POST /preferences, GET /unsubscribe   (public, CORS)
  → messaging-worker (Cloudflare Worker)
  → D1 (messaging-db): subscribers table

Operator (send path)
  → GET  /subscribers?scope=tips&secret=...   (auth: recipient list)
  → POST /send-test&secret=...                (auth: Resend send)
  → messaging-worker → Resend API → recipient inbox
```

Public write endpoints require no secret (they are called by the public website) but validate all input. Admin endpoints require the shared secret via `?secret=` or `Authorization: Bearer`, mirroring analytics-worker.

## Directory Structure

```
messaging-worker/
├── src/
│   └── index.ts              # routes, CORS/auth helpers, Resend send
├── migrations/
│   └── 0001_create_subscribers.sql
├── scripts/
│   └── seed-warm-launch.ts   # one-off import of mailing-list opt-ins
├── package.json              # dev/deploy/migrate scripts (analytics shape)
├── tsconfig.json
├── wrangler.toml
└── README.md
```

## Data Models

Single table, `0001_create_subscribers.sql`:

```sql
CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,              -- normalized lowercase
  first_name TEXT,                         -- optional, for email personalization
  scope_reminders INTEGER NOT NULL DEFAULT 0,
  scope_tips INTEGER NOT NULL DEFAULT 0,
  reminders_updated_at TEXT,               -- last reminders scope change
  tips_updated_at TEXT,                    -- last tips scope change
  unsubscribe_token TEXT NOT NULL UNIQUE,
  source TEXT,                             -- 'warm_launch' | 'website'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscribers_token ON subscribers (unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_subscribers_tips ON subscribers (scope_tips);
CREATE INDEX IF NOT EXISTS idx_subscribers_reminders ON subscribers (scope_reminders);
```

**Design decision — flat scope columns vs. consent-events table:** at this scale, two boolean columns plus per-scope timestamps give an auditable-enough record with far less complexity than an append-only event log. If full consent history is later required, add a separate `consent_events` table without disturbing this one.

## Components and Interfaces

### Env binding

```typescript
export interface Env {
  DB: D1Database;
  ADMIN_SECRET: string;    // via `wrangler secret put`
  RESEND_API_KEY: string;  // via `wrangler secret put`
  SITE_ORIGIN: string;     // CORS + link building (wrangler.toml var)
  EMAIL_FROM: string;      // sender identity, e.g. "Mental Health Wallet <moshe@productsforgood.co>"
  EMAIL_REPLY_TO: string;  // reply-to address (wrangler.toml var)
}
```

### Routes

| Endpoint | Method | Auth | Purpose | Requirements / Spec |
|---|---|---|---|---|
| `/subscribe` | POST | Public (CORS) | Create/update subscriber scopes (+ optional `first_name`) | 2 |
| `/preferences` | GET | Public (token) | **Read** current scopes by token → `{ ok, scopes, first_name }` | messaging-consent-pages R4 |
| `/preferences` | POST | Public (token) | Update scopes via token | 3 |
| `/unsubscribe` | GET | Public (token) | Disable all scopes (renders an HTML confirmation) | 4 |
| `/subscribers` | GET | Secret | List opted-in recipients for a scope | 5 |
| `/send-test` | POST | Secret | One plain test send via Resend | 6 |
| `/send-tip` | POST | Secret | Send an authored tip (structured fields) via Resend | messaging-content-batch-1 |
| `/health` | GET | None | Health check | — |

Endpoints owned by sibling specs are noted above; their detailed behavior lives in those
specs (`messaging-consent-pages` for GET `/preferences`, `messaging-content-batch-1` for
`/send-tip`). This table is the single source of truth for the worker's full route surface.

### Subscribe / preferences / unsubscribe logic

- Email normalized to lowercase and format-validated before any DB write.
- `/subscribe` upserts on `email` (idempotent, no duplicates); accepts an optional `first_name`; generates `unsubscribe_token` on create; returns a uniform success body regardless of prior existence (anti-enumeration).
- Email personalization uses `first_name` when present and falls back to a neutral greeting ("Hi there,") when absent, so a missing name never breaks a send.
- `/preferences` looks up by token, updates scope flags and their timestamps; unknown token → 404.
- `/unsubscribe` sets both scope flags to 0 by token; idempotent.

### Resend send helper

Builds the message with the compliance headers:

- `List-Unsubscribe: <{SITE_ORIGIN or worker}/unsubscribe?token=TOKEN>`
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- Footer preferences link carrying the token.

Sender identity: `Mental Health Wallet <moshe@productsforgood.co>`, reply-to a monitored inbox (Gmail is acceptable for replies). `/send-test` first fetches the recipient via the consent-aware query so a send cannot target a non-consenting address.

**Shared send helper (`sendViaResend`).** The Resend API call (sender identity, the
`List-Unsubscribe` / `List-Unsubscribe-Post` headers, and success/error normalization) is
factored into one `sendViaResend(env, { to, subject, html, text, unsubscribeUrl })` used by
both `sendEmail` (plain sends, `/send-test`) and `sendTipEmail` (tip sends, `/send-tip`).
This keeps compliance headers and sender identity consistent across every send path.

### Top-level error handling (CORS-safe failures)

The `fetch` handler wraps all routing in a try/catch. An unhandled exception (e.g. a D1
error) would otherwise produce a bare 500 WITHOUT CORS headers, which browsers misreport as
a CORS failure and which is hard to diagnose. Instead, caught errors return a JSON body
**with** the standard CORS headers:

- D1 daily-limit / `D1_ERROR` → **503** `{ error: "Service temporarily unavailable", detail }`.
- Any other error → **500** `{ error: "Internal error", detail }`.

This was added after a live incident where the shared D1 free-tier read cap (exhausted by
the analytics dashboard) made `/preferences` throw; the browser showed a misleading CORS
error instead of the real cause. See `analytics-d1-optimization` for the underlying D1
read-budget work.

### wrangler.toml

```toml
name = "mental-wallet-messaging"
main = "src/index.ts"
compatibility_date = "2025-07-01"

[[d1_databases]]
binding = "DB"
database_name = "messaging-db"
database_id = "<from: wrangler d1 create messaging-db>"

[vars]
SITE_ORIGIN = "https://mentalhealthwallet.productsforgood.co"
EMAIL_FROM = "Mental Health Wallet <moshe@productsforgood.co>"
EMAIL_REPLY_TO = "moshe@productsforgood.co"
# Secrets (via `wrangler secret put`): ADMIN_SECRET, RESEND_API_KEY
```

## Resend Domain Setup

Verify `productsforgood.co` in Resend (sender `moshe@productsforgood.co`), then add the DKIM/SPF/DMARC records to the Cloudflare DNS zone that already hosts the marketing site. Store `RESEND_API_KEY` as a Wrangler secret; never in `wrangler.toml`.

## Seed Migration

`scripts/seed-warm-launch.ts` reads the mailing-list opt-in column from the gitignored `docs/warm-launch-messages.md`, and for each opted-in (✅) row upserts a subscriber opted into BOTH scopes (`tips` and `reminders`), with the person's `first_name` (available in that file), `source = 'warm_launch'`, a generated token, and a best-effort consent timestamp. It runs locally (never committing PII) and writes via `wrangler d1 execute --remote` or authenticated calls to `/subscribe`.

## Security Notes

- **Enumeration:** uniform responses on `/subscribe` and `/preferences`.
- **Token strength:** `unsubscribe_token` is a UUID or longer random string; it is the sole credential for preference/unsubscribe actions.
- **Least data:** store email + scopes + timestamps + optional `first_name` only. First name is the sole personalization field; full/last name is deliberately not collected.
- **Rate limiting:** follow-up (Cloudflare rules or a per-IP counter); not blocking at warm-launch volume.

## Testing Strategy

- Endpoint tests via curl against local `wrangler dev`: subscribe creates a row; re-subscribe updates rather than duplicates; invalid email → 400; unsubscribe zeroes scopes and is idempotent; unknown token → 404; `/subscribers` rejects without secret and returns only opted-in rows.
- Resend: confirm domain verified; confirm a `/send-test` email arrives with the `List-Unsubscribe` header present and the footer link resolving to `/unsubscribe` and zeroing scopes.
- Seed: after import, `/subscribers?scope=tips` returns the expected warm-launch addresses with `source = 'warm_launch'`.
