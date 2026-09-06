-- Subscribers table
-- Authoritative consent record for messaging (kept in its own D1 database,
-- separate from the anonymous analytics worker, so PII stays isolated).

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,              -- normalized lowercase
  first_name TEXT,                         -- optional, for email personalization
  scope_reminders INTEGER NOT NULL DEFAULT 0,
  scope_tips INTEGER NOT NULL DEFAULT 0,
  reminders_updated_at TEXT,               -- timestamp of last reminders scope change
  tips_updated_at TEXT,                    -- timestamp of last tips scope change
  unsubscribe_token TEXT NOT NULL UNIQUE,
  source TEXT,                             -- 'warm_launch' | 'website'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscribers_token ON subscribers (unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_subscribers_tips ON subscribers (scope_tips);
CREATE INDEX IF NOT EXISTS idx_subscribers_reminders ON subscribers (scope_reminders);
