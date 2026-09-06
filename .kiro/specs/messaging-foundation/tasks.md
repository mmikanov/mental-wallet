# Tasks

## Task 1: Scaffold the messaging worker

- [x] Create `messaging-worker/` mirroring the `analytics-worker/` layout (package.json scripts, tsconfig, wrangler.toml, README skeleton)
- [x] Implement the `fetch` router with CORS/auth helpers and a `/health` route
- [x] Verify: `npm run dev` starts the worker locally and `/health` returns ok
- _Requirements: 7.2, 7.5_

## Task 2: Create D1 database and subscribers migration

- [x] `wrangler d1 create messaging-db` and set `database_id` in `wrangler.toml`
- [x] Write `migrations/0001_create_subscribers.sql` (table incl. optional `first_name` + indexes per design)
- [x] Add `db:migrate:local` and `db:migrate:remote` npm scripts
- [x] Verify: migration applies locally and the `subscribers` table exists
- _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

## Task 3: Implement public consent endpoints

- [x] Implement `POST /subscribe` (email validation, lowercase normalization, optional `first_name`, idempotent upsert, token generation, uniform response)
- [x] Implement `POST /preferences` (token lookup, scope update with timestamps, 404 on unknown token)
- [x] Implement `GET /unsubscribe` (disable all scopes by token, idempotent)
- [x] Enable CORS for `SITE_ORIGIN` on the public endpoints
- [x] Verify via curl: subscribe creates (with and without `first_name`); re-subscribe updates not duplicates; invalid email → 400; unsubscribe zeroes scopes; invalid token → 404
- _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 7.1, 7.3, 7.5_ (2.3 is a Phase C form concern)

## Task 4: Implement consent-aware recipient query

- [x] Implement `GET /subscribers?scope=<scope>` returning only opted-in rows, requiring the admin secret
- [x] Verify: returns expected rows for a scope; rejects requests without the secret
- _Requirements: 5.1, 5.2, 7.2_

## Task 5: Verify the Resend sending domain

- [x] Verify `productsforgood.co` in Resend (sender `moshe@productsforgood.co`); add DKIM/SPF/DMARC records in Cloudflare DNS
- [x] Store `RESEND_API_KEY` and `ADMIN_SECRET` via `wrangler secret put`
- [x] Verify: Resend reports the domain as verified
- _Requirements: 6.1_

## Task 6: Implement send path and test send

- [x] Implement `POST /send-test` (secret) that fetches the recipient via the consent-aware query, then sends via Resend with `List-Unsubscribe`, `List-Unsubscribe-Post`, a footer preferences link, and a `first_name` greeting that falls back to a neutral greeting when absent
- [x] Verify (local): consent gate returns 409 for non-opted-in; secret required; Resend request is well-formed (real send needs a verified domain + key — do at deploy)
- _Requirements: 1.6, 6.2, 6.3, 6.4_

## Task 7: Import warm-launch seed list

- [x] Write `scripts/seed-warm-launch.ts` (opted-in rows only, BOTH scopes, `first_name` where available, `source='warm_launch'`); verified locally (parses the opt-in, seeds both scopes). Run against production at deploy.
- [x] Verify (local): `/subscribers?scope=tips` returns the seeded warm-launch address with first name; no PII committed to the repo
- _Requirements: 8.1, 8.2, 8.3, 8.4_

## Task 8: Deploy and document

- [x] `npm run deploy` and `db:migrate:remote`
- [x] Write `messaging-worker/README.md` (setup, secrets, endpoints, seed steps) mirroring the analytics README
- [x] Verify: production `/health` responds; a production test send arrives (domain verified, key set, test email delivered)
- _Requirements: 6.1, 6.4_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3", "4"] },
    { "id": 3, "tasks": ["5"] },
    { "id": 4, "tasks": ["6"] },
    { "id": 5, "tasks": ["7", "8"] }
  ]
}
```
