-- Subscription change log: an append-only audit trail of consent events per subscriber.
--
-- The subscribers table only keeps CURRENT scope flags + the LAST-changed timestamp per
-- scope, so a full history of changes could not be reconstructed. This table records every
-- change going forward (signup, scope change, unsubscribe) so the admin can see a complete
-- timeline — interleaved with email sends — of what happened and when.
--
-- Historical changes made before this table existed are not recoverable; a one-time backfill
-- seeds a single 'signed_up' event per existing subscriber from their created_at, so every
-- subscriber's timeline at least starts correctly.

CREATE TABLE IF NOT EXISTS subscriber_events (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,                 -- normalized lowercase
  event_type TEXT NOT NULL,            -- 'signed_up' | 'scope_changed' | 'unsubscribed'
  scope TEXT,                          -- 'tips' | 'reminders' | NULL (for signup/unsubscribe-all)
  old_value INTEGER,                   -- previous opt-in (0/1) for scope_changed; NULL otherwise
  new_value INTEGER,                   -- new opt-in (0/1) for scope_changed; NULL otherwise
  detail TEXT,                         -- human-readable summary (e.g. "signed up: tips+reminders")
  created_at TEXT NOT NULL             -- when the change happened (ISO 8601)
);

CREATE INDEX IF NOT EXISTS idx_subscriber_events_email ON subscriber_events (email, created_at);

-- Backfill: one 'signed_up' event per existing subscriber, dated at their created_at, with a
-- detail describing which scopes they started with. INSERT ... SELECT; id via hex(randomblob).
INSERT INTO subscriber_events (id, email, event_type, scope, old_value, new_value, detail, created_at)
SELECT
  lower(hex(randomblob(16))),
  email,
  'signed_up',
  NULL,
  NULL,
  NULL,
  'signed up (backfilled): ' ||
    CASE WHEN scope_tips = 1 AND scope_reminders = 1 THEN 'tips + reminders'
         WHEN scope_tips = 1 THEN 'tips'
         WHEN scope_reminders = 1 THEN 'reminders'
         ELSE 'no scopes' END,
  created_at
FROM subscribers;
