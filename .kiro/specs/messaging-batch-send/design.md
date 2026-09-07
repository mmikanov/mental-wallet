# Design Document

## Overview

Add campaign-based batch sending to the messaging worker: define campaigns (stored, executed
by id), execute them to send an authored tip to a scope's opted-in audience as individual
per-recipient emails, with tip-keyed dedupe, per-recipient resume, safe explicit-mode
execution, and a durable send record. Reuses the existing worker foundation: D1, the
`jsonResponse`/`isAuthorized`/`corsHeaders` helpers, `sendViaResend` + `sendTipEmail`, and the
tip markdown parsing already in `scripts/send-tip.ts`.

Scope: `messaging-worker/` (`src/index.ts`, `migrations/`, `scripts/`) and its docs. The
campaigns dashboard (Requirement 9) is deprioritized and NOT built in this pass.

## Key design decision: how a long send actually runs

A broadcast to the whole list cannot reliably complete inside one Worker request (Workers
have CPU/wall-time limits, and Resend rate limits require pacing between sends). So execution
is **chunked and resumable**, not one long request:

- Each execute call sends **one bounded chunk** (e.g. N recipients), records results, and
  returns progress (`sent`, `remaining`). It is safe to call repeatedly until `remaining` is 0.
- A **local driver script** (`scripts/run-campaign.ts`) loops: call execute-chunk, pace to
  respect Resend limits, repeat until done. This mirrors the existing `send-tip.ts` /
  `seed-warm-launch.ts` local-script pattern and keeps each Worker request short.
- Because sends are recorded per recipient (tip-keyed, Requirement 5), a crash or stop just
  means the next chunk resumes where it left off, no double-sends.

This satisfies "batched, rate-limited, resumable" (Reqs 5-6) without a queue/Durable Object,
which would be over-engineered at this scale. (A Cloudflare Queue is noted as a future option
if the list grows large.)

## Data model (new D1 tables)

Two migrations added to `messaging-worker/migrations/`.

### `campaigns`

```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,                 -- system-generated UUID, never reused
  name TEXT NOT NULL UNIQUE,           -- human label; unique (collision check)
  tip_slug TEXT NOT NULL,              -- references content/tips/<slug>.md (content stays in md)
  scope TEXT NOT NULL,                 -- 'tips' | 'reminders'
  mode TEXT NOT NULL DEFAULT 'new_only', -- 'new_only' | 'resend_all'
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'sending' | 'sent' | 'paused'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT
);
```

### `tip_sends` (the send record — keyed by TIP, not campaign)

```sql
CREATE TABLE IF NOT EXISTS tip_sends (
  id TEXT PRIMARY KEY,
  tip_slug TEXT NOT NULL,              -- dedupe key: "already received this tip"
  email TEXT NOT NULL,                 -- normalized lowercase
  campaign_id TEXT,                    -- which campaign triggered it (nullable; audit only)
  status TEXT NOT NULL,                -- 'pending' | 'sent' | 'failed'
  resend_id TEXT,                      -- Resend message id when sent
  error TEXT,                          -- detail when failed
  sent_at TEXT,                        -- when the email was actually SENT (null until sent;
                                       -- set/refreshed when status becomes 'sent', incl. retry)
  created_at TEXT NOT NULL,            -- when this row was first created (audit ordering)
  updated_at TEXT NOT NULL,            -- last change (e.g. failed -> sent on retry)
  UNIQUE (tip_slug, email)             -- one record per tip+recipient
);

CREATE INDEX IF NOT EXISTS idx_tip_sends_tip ON tip_sends (tip_slug);
CREATE INDEX IF NOT EXISTS idx_tip_sends_campaign ON tip_sends (campaign_id);
```

Rationale:
- **Dedupe keyed by `tip_slug`** (not campaign id) so deleting a campaign and creating a new
  one for the same tip still skips prior recipients (Requirement 5.2). `campaign_id` is kept
  for audit ("which campaign sent it") but is NOT the dedupe key.
- **`UNIQUE (tip_slug, email)`** enforces one row per tip+recipient at the DB level, even
  across concurrent/repeated invocations (Requirement 5.4). Status transitions:
  `pending` → `sent` (success) or `pending` → `failed` (error); a `failed` row may be retried
  (→ `sent`). The send path treats an existing `sent` row as "skip", and a lingering
  `pending` row per the delivery-guarantee policy below.
- Deleting a campaign leaves `tip_sends` intact (Requirement 1.5); `campaign_id` may dangle,
  which is fine (audit only).
- **"When was it sent to this user" = `sent_at`** (not `created_at`). `created_at` is when
  the row was first written (may be a `failed` attempt); `sent_at` is set only on a
  successful send and refreshed if a `failed` row later succeeds on retry, so it always
  reflects the actual delivery-attempt time. `failed` rows have `sent_at = null`. This is the
  field the send-history view / "who got what when" (Reqs 8.2, 9.3) reads.

## Endpoints (added to `src/index.ts`)

All admin-only (`isAuthorized`), reusing `jsonResponse`.

| Endpoint | Method | Purpose | Req |
|---|---|---|---|
| `/campaigns` | POST | Create a campaign (name, tip_slug, scope, mode) | 1 |
| `/campaigns` | GET | List all campaigns (+ send counts) | 1 |
| `/campaigns/:id` | GET | Read one campaign (config, status, counts) | 1 |
| `/campaigns/:id` | PUT/PATCH | Update a not-yet-sent campaign | 1 |
| `/campaigns/:id` | DELETE | Delete a campaign (send record preserved) | 1 |
| `/campaigns/:id/execute` | POST | Execute one chunk; body carries `mode` + tip fields | 2-7 |

### Create / uniqueness

- `POST /campaigns` validates `name` (unique — reject 409 on collision), `tip_slug`,
  `scope` in {tips,reminders}, `mode` in {new_only,resend_all}. Generates `id` via
  `crypto.randomUUID()`. Status starts `draft`.
- `PUT` on a campaign whose status is `sent`/`sending` rejects destructive edits
  (Requirement 1.5); `draft`/`paused` may be edited.
- `DELETE` removes the `campaigns` row only; `tip_sends` stays.

### Execute (chunked, explicit mode)

`POST /campaigns/:id/execute` body:
```jsonc
{
  "mode": "dry-run" | "production",   // REQUIRED, no default (Req 7.2/7.3)
  "tip": { "title", "summary", "body?", "heroImage?", "cta?" }, // rendered tip fields
  "limit": 50                          // optional chunk size
}
```

- **`mode` is required**; missing/unknown → 400, no send (Req 7.3). Only `production` sends.
- The **tip fields come from the caller** (the driver script parses `content/tips/<slug>.md`
  and posts them), matching how `/send-tip` already works — content stays in markdown
  (Req 2.3). The worker verifies the posted `tip` matches the campaign's `tip_slug` intent.
- **Audience selection** (per campaign `scope` + `mode`):
  - opted-in for scope = `SELECT email, first_name, unsubscribe_token FROM subscribers WHERE scope_<scope> = 1`.
  - `new_only`: exclude anyone already in `tip_sends` with status `sent` for this `tip_slug`.
  - `resend_all`: include all opted-in (still skips within-run duplicates via the UNIQUE guard).
  - Take the next `limit` recipients not yet sent.
- **dry-run:** compute and return counts only (new-only count AND full-audience count,
  Req 7.1), send nothing.
- **production:** for each recipient in the chunk:
  1. **Re-check consent** for the scope right now (Req 3.1) — skip if no longer opted in.
  2. **Write intent first:** upsert a `tip_sends` row with `status = 'pending'` (via the
     `UNIQUE (tip_slug, email)` guard) BEFORE calling Resend. If a `sent` row already exists,
     skip; if a `pending` row already exists from a prior interrupted run, see the delivery
     guarantee note below.
  3. Send an **individual** email via `sendTipEmail` (one `to`, per-recipient greeting +
     unsubscribe token; never BCC, Req 2.4), passing a **Resend idempotency key** of
     `tip_slug:email` so a retried identical send is de-duplicated by Resend itself.
  4. On Resend's response: update the row to `status = 'sent'` (+ `resend_id`, `sent_at`) on
     a 2xx, or `status = 'failed'` (+ `error`) otherwise. Both success and failure are
     explicitly recorded (success is not merely "no failure row").
- Update `campaigns.status`/`last_run_at`; return `{ sent, failed, skipped, remaining }`.

### Delivery guarantee (crash-between-send-and-record)

Waiting for Resend's response tells us a send succeeded, but a crash/timeout AFTER Resend
accepts the email and BEFORE we write `sent` would otherwise risk a resend. Mitigations:

- **Write `pending` before sending** (step 2): on resume, a lingering `pending` row means
  "we already attempted this and don't know the outcome". Default policy: **do NOT blindly
  resend a `pending` row** — leave it for the operator to review (prefer a possible missed
  send over a duplicate; for a mental-health list, avoiding duplicates is the priority).
- **Resend idempotency key** (`tip_slug:email`, step 3): even if we do retry the exact send,
  Resend de-duplicates it, closing most of the window at the provider level.
- Net stance: **at-most-once** delivery per tip+recipient. A rare missed send is acceptable
  and recoverable (operator can requeue a specific address); a duplicate is what we avoid.

## Driver script: `scripts/run-campaign.ts`

Mirrors `send-tip.ts`/`seed-warm-launch.ts`:
- Args: `--id <campaignId> --mode dry-run|production` (+ optional `--limit`).
- Reads the campaign (GET) to learn its `tip_slug`, parses `content/tips/<slug>.md`
  (reuse the frontmatter parser), then loops `POST /campaigns/:id/execute` chunk by chunk,
  pacing between chunks to respect Resend limits, until `remaining` is 0.
- Prints a running/`final summary (attempted, sent, skipped, failed) — Req 6.4.
- `DRY_RUN`/`--mode dry-run` prints the audience counts and exits without sending.

## Consent, privacy, compliance (reused)

- Individual sends only, via the existing `sendViaResend`/`sendTipEmail` (one recipient per
  message; per-recipient `List-Unsubscribe` + footer). No BCC (Req 2.4).
- Consent re-checked per recipient at send time (Req 3.1).
- Scope semantics enforced by the audience query (Req 3.3).

## Testing strategy

- Migrations apply locally; `campaigns` + `tip_sends` exist with the UNIQUE constraint.
- CRUD (curl, local): create; duplicate name → 409; list; get; update draft; block edit of
  sent; delete leaves `tip_sends`.
- Execute dry-run: returns new-only and full-audience counts, sends nothing.
- Execute production (local, placeholder Resend key so real send is stubbed/observed):
  - individual sends (one `to` each), consent re-check skips an unsubscribed address,
    `tip_sends` records per recipient, UNIQUE prevents a double `sent`.
  - `new_only` skips already-sent recipients; `resend_all` includes them.
  - chunking: `limit` bounds a run; repeated calls resume via `remaining`; a simulated
    mid-run stop resumes without double-send.
  - missing/invalid `mode` → 400, nothing sent.
- Driver script: dry-run prints counts; production loop completes and prints the summary.
- Typecheck (`npm run typecheck`). Verify existing endpoints unchanged.

## Documentation

- `messaging-worker/README.md`: campaigns CRUD, execute modes, the driver script, resume.
- `docs/deployment/messaging-operations.md`: add campaign create/list/dry-run/send/resume
  commands and the "send one message first" guidance.
