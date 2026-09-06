# Requirements Document

## Introduction

Phase A of the messaging & content plan (`docs/messaging-and-content-plan.md`) establishes the subscriber/consent store and email sending infrastructure that every later phase builds on. It introduces a new **messaging worker** (Cloudflare Worker + its own D1 database) that owns subscriber consent as the authoritative record, exposes HTTP endpoints for subscribe / update-preferences / unsubscribe, integrates **Resend** for sending from a verified domain, and imports the existing warm-launch opt-ins as the seed list.

A separate worker is used deliberately: the existing `analytics-worker` is anonymous by design (no PII), and subscriber consent stores email addresses. Keeping PII out of the anonymous analytics database is a privacy boundary. The new worker mirrors the analytics-worker's conventions (structure, CORS/auth helpers, migration pattern, wrangler config, deploy scripts).

Out of scope for this spec: authoring tips (Phase B), the marketing-website form UI (Phase C), the in-app feed (Phase D), and remote push (deferred).

## Requirements

### Requirement 1: Subscriber Record with Granular Consent

**User Story:** As the operator, I want an auditable subscriber record with independent consent scopes, so that I only message people who agreed and can prove what they agreed to.

#### Acceptance Criteria

1. THE messaging store SHALL persist each subscriber with: an id, a unique lowercase-normalized email, per-scope opt-in flags, a per-scope change timestamp, an unguessable unsubscribe token, a source marker, and created/updated timestamps.
2. THE system SHALL support two independent consent scopes: `reminders` (come-back nudges) and `tips` (tips & newsletter).
3. A subscriber MAY be opted into any subset of scopes, including none (fully unsubscribed but record retained for audit).
4. WHEN any scope changes, THE system SHALL record the timestamp of that change.
5. THE system SHALL support an OPTIONAL `first_name` field for email personalization, and SHALL NOT collect full or last name (least-data principle).
6. WHEN a subscriber has no `first_name`, THE system SHALL fall back to a neutral greeting so a missing name never blocks or breaks a send.

### Requirement 2: Subscribe Endpoint

**User Story:** As a website visitor, I want to opt in with my email and chosen scopes, so that I start receiving the content I asked for.

#### Acceptance Criteria

1. WHEN a valid email and scope selection are POSTed to `/subscribe`, THE system SHALL create or update the subscriber accordingly, and SHALL accept an OPTIONAL `first_name`.
2. IF the email format is invalid, THEN THE system SHALL reject the request with HTTP 400. THIS server-side check is authoritative and SHALL NOT be skipped even when a client validates first.
3. THE subscribe form (implemented in Phase C) SHALL perform a client-side email-format check before submitting and surface an inline error, so users can correct typos without a server round-trip. This is a UX aid only and does not replace criterion 2.
4. WHEN the email already exists, THE system SHALL update that record's scopes rather than create a duplicate.
5. WHEN a subscriber is created, THE system SHALL generate a unique unsubscribe token.
6. THE response SHALL be uniform whether or not the email already existed, so existence cannot be probed.

### Requirement 3: Preferences Update Endpoint

**User Story:** As a subscriber, I want to change which messages I receive, so that I keep the ones I value and drop the rest.

#### Acceptance Criteria

1. WHEN a valid token and desired scope states are POSTed to `/preferences`, THE system SHALL update that subscriber's scopes.
2. IF the token is unknown or invalid, THEN THE system SHALL respond with HTTP 404 without leaking whether the token exists.
3. WHEN scopes are updated, THE system SHALL update the affected per-scope timestamps.

### Requirement 4: Unsubscribe Endpoint

**User Story:** As a subscriber, I want a one-click way to stop all messages, so that opting out is effortless and trustworthy.

#### Acceptance Criteria

1. WHEN `/unsubscribe` is requested with a valid token, THE system SHALL disable all consent scopes for that subscriber.
2. THE unsubscribe action SHALL be idempotent (safe to call repeatedly).
3. THE endpoint SHALL be reachable both from an email `List-Unsubscribe` header and from a footer link.

### Requirement 5: Consent-Aware Recipient Query

**User Story:** As the operator, I want to fetch the current recipients for a scope, so that a send only reaches people opted into that scope.

#### Acceptance Criteria

1. THE system SHALL expose an authenticated endpoint that returns subscribers currently opted into a given scope.
2. THE endpoint SHALL require the shared admin secret via `?secret=` query param or `Authorization: Bearer`, matching the analytics-worker pattern.

### Requirement 6: Sending via Resend

**User Story:** As the operator, I want to send email through Resend from a verified domain, so that messages are compliant and deliverable.

#### Acceptance Criteria

1. THE system SHALL send email through Resend from a verified domain (`productsforgood.co`), using sender `moshe@productsforgood.co` with replies routed to a monitored inbox.
2. Every marketing email SHALL include a `List-Unsubscribe` header pointing to the unsubscribe endpoint, a `List-Unsubscribe-Post` header for one-click (RFC 8058), and a visible unsubscribe/preferences link in the footer.
3. A send SHALL be restricted to subscribers opted into the relevant scope, enforced server-side against the recipient query rather than trusted from the caller.
4. Phase A SHALL prove the send path with a single test send to a controlled address; batch campaigns are deferred to Phase C.

### Requirement 7: Security and Privacy

**User Story:** As the operator of a health-adjacent app, I want the messaging store hardened and privacy-preserving, so that user trust and data are protected.

#### Acceptance Criteria

1. THE public endpoints (`/subscribe`, `/preferences`, `/unsubscribe`) SHALL NOT require the admin secret but SHALL validate all input.
2. THE admin endpoints (recipient query, send trigger) SHALL require the shared secret.
3. THE unsubscribe token SHALL be unguessable and SHALL be the only credential required for preference and unsubscribe actions.
4. THE system SHALL NOT persist plaintext email addresses in logs beyond operational necessity.
5. THE public endpoints SHALL permit the marketing website origin via CORS.
6. Rate limiting SHALL be noted as a follow-up and is not required for Phase A given low volume.

### Requirement 8: Seed Data Migration

**User Story:** As the operator, I want the existing warm-launch opt-ins imported, so that the first sends reach the people who already agreed.

#### Acceptance Criteria

1. THE opt-ins tracked in `docs/warm-launch-messages.md` (the "Mailing list" column) SHALL be importable as the initial subscriber list.
2. Imported records SHALL carry a `source` marker of `warm_launch`, a best-effort consent timestamp, and the subscriber's `first_name` where available in the warm-launch list, so the audit trail reflects reality and seeded records can be personalized from day one.
3. Only rows marked opted-in SHALL be subscribed; opted-out and blank rows SHALL NOT be subscribed. Opted-in rows SHALL be subscribed to BOTH scopes (`tips` and `reminders`).
4. THE import SHALL run locally against the gitignored source file and SHALL NOT commit any real PII into the repository.
