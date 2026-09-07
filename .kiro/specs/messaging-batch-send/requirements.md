# Requirements Document

## Introduction

Phase C, part 3 (C3) of the messaging & content plan (`docs/messaging-and-content-plan.md`):
send an authored tip to an entire opted-in audience (a scope's whole recipient list), rather
than one address at a time. This is the piece that turns the messaging system from "send to
one person" (`/send-test`, `/send-tip`) into an actual campaign/broadcast to real users.

It builds on the shipped foundation: the messaging worker owns the consent store and the
`sendTipEmail` renderer; tips live in `content/tips/*.md`; the `send-tip` script already
renders a tip and posts it to the worker. C3 adds selecting the recipient list for a scope,
sending to all of them safely (batched, rate-limited, idempotent), and recording what was
sent.

This is the **highest-stakes** part of the system: it emails real people, and a mistake
(double-send, sending to someone who unsubscribed, or a runaway loop) directly harms trust
and can trigger spam complaints. So the requirements emphasize consent re-checking,
idempotency, previewing, and safe failure over convenience.

In scope: recipient selection by scope, batched/rate-limited sending, a send record, a
dry-run/preview, and consent enforcement at send time. Out of scope: automated lifecycle
sequencing (send X on day N — a future enhancement noted in the message release plan), the
in-app feed (Phase D), and any app change.

Relevant context: `docs/message-release-plan.md` (what/when/why to send, and the "send one
message, not a backlog dump" first-broadcast guidance). D1 note: reading the subscriber list
is cheap (small table) and unrelated to the analytics read-budget concern.

## Requirements

### Requirement 1: Campaigns are stored, then executed by id

**User Story:** As the operator, I want to define a campaign once and then run it by id, so
that I don't re-enter the tip, scope, and mode every time and can't fumble those fields on
a live send.

#### Acceptance Criteria

1. THE system SHALL persist a **campaign** as a stored record with at least: a
   system-generated id, a human-readable `name`, the tip it sends (by slug), the target
   scope (`tips` or `reminders`), the send mode (new-only vs. full re-send, per Requirement
   4), a status (e.g. draft / sending / sent / paused), and created / last-run timestamps.
   - **The id SHALL be system-generated and never reused** (e.g. a UUID, like subscriber
     ids), so a deleted campaign's id can never be re-assigned to a new campaign. This
     prevents a new campaign from inheriting a deleted one's send history via a reused id.
   - **The `name` SHALL be unique.** Creating or renaming a campaign to a name that already
     exists SHALL be rejected with a clear error ("a campaign named X already exists"). Name
     is the human-facing collision check; the id is the machine key.
2. A campaign SHALL reference the tip by slug; the tip CONTENT SHALL remain in
   `content/tips/*.md` (single source of truth). The campaign row holds sending parameters
   and state, NOT the tip body.
3. THE system SHALL support full CRUD on campaigns, all admin-only:
   - **Create** a campaign (tip slug + scope + mode).
   - **Read one** campaign by id (its config, status, timestamps, and send summary).
   - **List all** campaigns (not just one by id), so the operator can see everything that
     exists — supporting review and cleanup.
   - **Update** a not-yet-sent campaign's config (e.g. fix the scope, mode, or tip before
     sending). Editing a campaign that has already sent SHALL be restricted (see 5).
   - **Delete** a campaign by id, so the list can be kept clean (see 5 for the send-record
     rule).
4. THE operator SHALL be able to **execute a campaign by id** (dry-run or real send) without
   re-supplying tip/scope/mode each run. Execution and all CRUD are admin-only (shared
   secret, like the other admin endpoints).
5. **Delete/edit safety vs. the send record:** deleting or editing a campaign SHALL NOT
   erase the "who already received this tip" history in a way that could cause re-sends.
   Since dedupe is keyed by tip (Requirement 5), the send record SHALL survive a campaign
   delete. Draft/unsent campaigns MAY be deleted or edited freely; a campaign that has
   already sent SHALL either be blocked from destructive edits or handled so its send
   history is preserved. Deleting a campaign SHALL NOT send anything.
6. THE campaign record SHALL be thin and purpose-built for this stage (no scheduling,
   segmentation, or A/B variants); those are explicitly out of scope.

### Requirement 2: Execute a campaign — send the tip to its scope's opted-in audience

**User Story:** As the operator, I want executing a campaign to send its tip to everyone
opted into its scope, so that I run a real broadcast instead of emailing people one by one.

#### Acceptance Criteria

1. Executing a campaign SHALL send its tip (rendered via the existing tip email rendering)
   to subscribers currently opted into the campaign's scope, per its send mode.
2. THE recipient list SHALL come from the consent store, including only currently opted-in
   subscribers and excluding anyone unsubscribed from that scope.
3. THE tip content SHALL originate from the authored markdown (single source of truth), not
   be retyped into the request.
4. **Each recipient SHALL receive their own individual email addressed only to them.** The
   system SHALL NOT use BCC, CC, or multiple recipients on a single message. "Batch" (see
   Requirement 6) means many individual per-recipient sends, paced — never one email to
   many addresses. Rationale:
   - **Privacy:** no recipient can ever see another subscriber's address. For a
     mental-health mailing list this exposure would be a serious harm, so it must be
     structurally impossible.
   - **Personalization + unsubscribe:** each email carries that recipient's own greeting and
     their own per-token `List-Unsubscribe` header/footer link (Requirement 3), which a
     shared/BCC message cannot do.
   - **Per-recipient tracking:** individual sends are what make the tip+recipient send record
     and per-recipient resume/retry (Requirements 4-5) possible.

### Requirement 3: Consent enforcement at send time

**User Story:** As a subscriber who unsubscribed, I want to be certain I won't receive a
broadcast that was queued before I opted out, so that unsubscribe is trustworthy.

#### Acceptance Criteria

1. THE system SHALL re-check each recipient's current opt-in for the scope at the moment of
   sending, not only when the list was first selected, so that a recently-unsubscribed
   address is skipped even mid-run.
2. EVERY sent email SHALL retain the compliance features already built: `List-Unsubscribe`
   and `List-Unsubscribe-Post` headers and a footer preferences/unsubscribe link.
3. THE system SHALL respect the scope semantics (a `reminders` broadcast goes only to
   `reminders` opt-ins; a `tips` broadcast only to `tips` opt-ins).

### Requirement 4: Target only recipients who haven't received this tip (default)

**User Story:** As the operator, I want to run the same tip again later and have it reach
only people who signed up since the last run (and never got it), so that evergreen content
like the welcome email covers new subscribers over time without re-emailing everyone.

#### Acceptance Criteria

1. A broadcast SHALL be identified by the **tip** (its slug/identity), so that "who has
   already received this tip" persists across separate runs over time.
2. BY DEFAULT, running a broadcast for a tip SHALL send only to currently-opted-in
   subscribers who have NOT already received that tip. Running it again next week therefore
   reaches only the new sign-ups, automatically.
3. THE system SHALL provide an explicit override to deliberately re-send a tip to the full
   opted-in audience (e.g. a seasonal re-send). This SHALL require a distinct, intentional
   action so it can't happen by accident.
4. THE default (send-to-new-only) SHALL be the safe path; a full re-send is opt-in.
5. THE dry-run (Requirement 7) SHALL report, for the chosen mode, how many recipients WOULD
   receive it (e.g. "12 new subscribers since last run" vs. "all 40 opted-in"), so the
   operator sees the effect before sending.

### Requirement 5: Idempotency and no double-sends

**User Story:** As the operator, I want a broadcast that fails partway or gets re-run to not
email anyone twice, so that an interruption never causes duplicate messages.

#### Acceptance Criteria

1. THE system SHALL record which recipients have received a given tip (a send record keyed
   by **tip slug + recipient**, NOT by campaign id), so progress is durable and "already
   received this tip" is queryable across runs and survives campaign deletion.
2. BECAUSE dedupe is keyed by tip (not campaign id), deleting a campaign and later creating
   a different campaign for the SAME tip SHALL still skip everyone who already received that
   tip. Combined with non-reusable campaign ids (Requirement 1), there is no way for a new
   campaign to accidentally re-send a tip that was already delivered.
3. IF a broadcast is retried or resumed, THEN THE system SHALL send only to recipients not
   already sent for that tip (resume, not restart).
4. THE system SHALL guard against sending the same tip to the same recipient more than once
   (in new-only mode), even across separate campaigns or invocations.
5. THE system SHALL record BOTH outcomes explicitly per recipient — success (with the
   provider's message id and send time) AND failure (with an error) — after receiving the
   provider's response. Success is a recorded state, not merely the absence of a failure
   record (dedupe depends on an explicit "sent" record existing).
6. THE system SHALL favor **at-most-once** delivery: if a send's outcome is unknown (e.g. a
   crash/timeout after the provider accepted the email but before the result was recorded),
   THE system SHALL NOT blindly resend on the next run. It SHALL mark the attempt as pending/
   in-doubt for operator review, and SHOULD use a provider idempotency key so an identical
   retried send is de-duplicated by the provider. A rare missed send is preferred over a
   duplicate.

### Requirement 6: Batching and rate limiting

**User Story:** As the operator, I want the send to respect provider limits and not fail as a
single giant call, so that large lists send reliably.

#### Acceptance Criteria

1. THE system SHALL send in batches rather than a single request for the whole list.
2. THE send SHALL respect Resend's send-rate limits (throttle/pace between batches as
   needed).
3. IF individual sends fail (transient errors), THEN THE system SHALL record the failure and
   allow a safe retry of only the failed/unsent recipients (per Requirement 5), without
   re-sending successes.
4. THE system SHALL report a summary on completion: attempted, succeeded, skipped
   (unsubscribed / already received), and failed counts.

### Requirement 7: Dry-run / preview before sending

**User Story:** As the operator, I want to preview a broadcast before it goes out, so that I
can confirm the audience and content given the action is irreversible.

#### Acceptance Criteria

1. Executing a campaign SHALL support a dry-run that reports the recipient count AND the
   list of recipient email addresses that WOULD receive it (capped for very large lists),
   WITHOUT sending anything, distinguishing the default (new/not-yet-received) count from
   the full-audience count (per Requirement 4.5). Showing who (not just how many) lets the
   operator eyeball the audience before an irreversible send. Dry-run may be a
   mode/parameter of the same execute operation.
2. **Execution SHALL require an explicit `mode` with no dangerous default.** Rather than a
   boolean flag (which always has an implicit value when omitted), execute SHALL take a
   required `mode` whose allowed values are explicit, e.g. `dry-run` and `production` (or
   `live`/`send`). A real send happens ONLY when `mode` is the explicit production value.
3. IF `mode` is missing or not a recognized value, THEN execution SHALL be rejected (no
   send). Omitting or mistyping the mode can therefore never cause an accidental real send —
   the only way to actually email people is to pass the explicit production mode on purpose.
4. THE dry-run mode SHALL let the operator confirm the tip renders correctly (e.g. by
   sending a single preview to the operator's own address, reusing `send-tip`).
5. THE precise wiring (a `mode` param on one execute operation vs. separate actions) is a
   design choice, provided the explicit-mode / no-dangerous-default property in (2)-(3)
   holds. The production value SHOULD be a deliberate, self-documenting word (e.g.
   `production`/`live`/`send`), not the absence of a flag.

### Requirement 8: Operability and documentation

**User Story:** As the operator, I want a clear, safe way to run a broadcast and see what
happened, so that I can operate it confidently and review results.

#### Acceptance Criteria

1. THE broadcast SHALL be runnable via the operator tooling pattern already used
   (a script and/or admin endpoint), consistent with `docs/deployment/messaging-operations.md`.
2. THE send record SHALL be inspectable (which broadcast, to whom, when, status).
3. THE documentation SHALL describe how to dry-run, send, resume a failed send, and read
   results.
4. THE first real broadcast SHOULD follow the message release plan's guidance: send ONE
   message to one scope, then observe, rather than a backlog dump.

### Requirement 9: Campaigns dashboard (read-only operator UI)

> **Priority: LOWER / reconsider after seeing Resend.** Resend's own dashboard already shows
> per-email delivery (recipient, timestamp, status, opens/clicks), which likely covers most
> of the "who/when/delivered" need. The unique gap this UI would fill is the *campaign-level*
> view (grouping by campaign, run history, dedupe/skip state) that Resend doesn't model. Once
> the operator has used Resend's dashboard, decide whether this is worth building or whether
> the existing list/inspect endpoints (Requirements 1 & 8) plus Resend suffice. Do not build
> this until that call is made.

**User Story:** As the operator, I want a simple page that shows my campaigns and, for each,
who it was sent to and when, so that I can see what happened at a glance without running
queries.

#### Acceptance Criteria

1. THE messaging worker SHALL serve a simple HTML dashboard (same pattern as the analytics
   dashboard: a Worker-served page gated by the admin secret), NOT a public page and NOT part
   of the mobile app.
2. THE dashboard SHALL show a **campaigns list**: for each campaign, its name, tip, scope,
   mode, status, created/last-run timestamps, and send counts (sent / skipped / failed).
3. THE dashboard SHALL show a **per-campaign detail view**: the send records for that
   campaign/tip — recipient, timestamp, and status — answering "which campaign was sent to
   whom and when".
4. THE dashboard SHALL be **read-only in v1**: it displays campaigns and send history but does
   NOT create, execute, or delete campaigns. Those stay in the operator tooling/endpoints
   where the explicit `mode`/confirm guards live (Requirement 7), so a UI click can never
   trigger a real send. (Execute/manage actions in the UI are a possible later enhancement.)
5. **PII handling:** this dashboard legitimately shows subscriber email addresses (the send
   record), so it SHALL be behind the admin secret and never exposed publicly. (This differs
   from the analytics dashboard, which is deliberately anonymous.)
6. THE dashboard SHOULD reuse the messaging worker's existing endpoints (campaigns list,
   campaign detail, send records) rather than adding parallel query logic.

## Open Questions (design)

- Where the send record lives: a new D1 table in the messaging worker (e.g.
  `broadcast_sends` keyed by broadcast id + email) vs. another mechanism. A D1 table fits the
  existing architecture and makes resume/idempotency straightforward.
- Worker endpoint vs. local script vs. both: a long broadcast may exceed a single Worker
  request's limits; consider a script that drives batched calls, or a queue/cron. Decide
  based on expected list size.
- Decided (Requirements 1 & 5): campaign id is **system-generated and non-reusable**
  (UUID); a unique human `name` is the collision check; the send record is keyed by **tip
  slug + recipient** (not campaign id), so dedupe survives campaign delete and there's no
  id-reuse trap. Remaining design detail: whether the full-re-send override is a mode flag
  on the campaign or a separate campaign (either works since dedupe is tip-keyed).
- Schema: a `campaigns` D1 table (UUID id, unique name, tip slug, scope, mode, status,
  timestamps) plus a send-record table keyed by tip slug + email. Both fit the messaging
  worker's existing D1 architecture.
- Whether to throttle by Resend's documented rate limit or a conservative fixed pace; confirm
  the current plan's limits.
- Analytics: whether to emit any open/click tracking (Resend supports it) or keep sends
  minimal for now; note privacy implications before adding tracking.
