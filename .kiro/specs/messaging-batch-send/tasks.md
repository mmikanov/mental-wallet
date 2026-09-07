# Tasks

## Task 1: D1 migrations for campaigns + tip_sends

- [x] Add `migrations/0002_create_campaigns.sql` (`campaigns` per design) and
      `migrations/0003_create_tip_sends.sql` (`tip_sends` with `UNIQUE (tip_slug, email)` +
      indexes)
- [x] Add the new files to the `db:migrate:local` / `db:migrate:remote` scripts
- [x] Verify: migrations apply locally; both tables + the unique constraint exist
- _Requirements: 1.1, 5.1_

## Task 2: Campaign CRUD endpoints

- [x] `POST /campaigns` (validate name unique → 409, tip_slug, scope, mode; UUID id; status
      draft), `GET /campaigns` (list + send counts), `GET /campaigns/:id`, `PUT/PATCH
      /campaigns/:id` (block destructive edit when sent/sending), `DELETE /campaigns/:id`
      (leaves `tip_sends`). All admin-only
- [x] Verify (local curl): create; duplicate name → 409; list; get; edit draft; edit-sent
      blocked; delete keeps `tip_sends`
- _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

## Task 3: Audience selection + dedupe query

- [x] Implement recipient selection for a campaign: opted-in for scope, minus already-sent
      for the tip (`new_only`) or all opted-in (`resend_all`), with a `limit`/offset for
      chunking
- [x] Verify (local): `new_only` excludes prior `sent` rows for the tip; `resend_all`
      includes them; unsubscribed excluded; counts correct
- _Requirements: 2.1, 2.2, 4.1, 4.2, 4.3, 4.4_

## Task 4: Execute endpoint (chunked, explicit mode, individual sends)

- [x] `POST /campaigns/:id/execute` with REQUIRED `mode` (`dry-run`|`production`;
      missing/unknown → 400, no send)
- [x] dry-run: return new-only AND full-audience counts, send nothing
- [x] production: per recipient in the chunk — re-check consent, send individual email via
      `sendTipEmail` (never BCC), record `sent`/`failed` in `tip_sends`; UNIQUE prevents
      double `sent`; update status/last_run_at; return `{ sent, failed, skipped, remaining }`
- [x] Verify (local, placeholder key): individual sends; consent re-check skips unsubscribed;
      per-recipient records; missing mode → 400; chunk `limit` respected; repeat resumes
- _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 5.2, 5.3, 5.4, 6.1, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5_

## Task 5: Batching / rate limiting + resume driver script

- [x] `scripts/run-campaign.ts`: read campaign (GET) → parse `content/tips/<slug>.md` (reuse
      frontmatter parser) → loop execute-chunk with pacing (Resend limits) until
      `remaining` is 0; print running + final summary; `--mode dry-run` prints counts only
- [x] Add an npm script (e.g. `run:campaign`)
- [x] Verify (local): dry-run prints counts; production loop completes, resumes after a
      simulated stop with no double-send, prints the summary
- _Requirements: 5.3, 6.1, 6.2, 6.3, 6.4, 7.1_

## Task 6: Docs, typecheck, final verification

- [x] Update `messaging-worker/README.md` (campaigns CRUD, execute modes, driver, resume)
      and `docs/deployment/messaging-operations.md` (create/list/dry-run/send/resume commands
      + "send one message first" guidance)
- [x] `npm run typecheck`; confirm existing endpoints/behavior unchanged
- [x] Full local pass of the flow end to end (no real emails; placeholder Resend key)
- _Requirements: 6.1, 8.1, 8.2, 8.3, 8.4_

## Deferred (not in this pass)

- **Requirement 9 (campaigns dashboard UI)** — lower priority; reconsider after evaluating
  what Resend's own dashboard provides. Do not build until that call is made.
- **Cloudflare Queue / Durable Object** for very large lists — future option if the chunked
  script proves insufficient.

## Open Decisions (resolve during implementation)

- Resend rate-limit specifics → chunk size + pacing in the driver.
- Whether the full-re-send override (`resend_all`) is a campaign mode (current design) or a
  one-off execute flag.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3"] },
    { "id": 2, "tasks": ["4"] },
    { "id": 3, "tasks": ["5"] },
    { "id": 4, "tasks": ["6"] }
  ]
}
```
