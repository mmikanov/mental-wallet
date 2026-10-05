-- Singleton state for the daily drip automation.
--
-- - paused: when 1, the scheduled daily run is a no-op (operator pause/resume).
-- - running_since: set to a timestamp when a drip pass starts, cleared (NULL) when it ends
--   (even on error). Powers the admin UI's "running now" indicator.
-- - last_run_at: timestamp of the last completed pass.
--
-- Exactly one row, id = 'singleton'.

CREATE TABLE IF NOT EXISTS drip_state (
  id TEXT PRIMARY KEY,
  paused INTEGER NOT NULL DEFAULT 0,
  running_since TEXT,
  last_run_at TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO drip_state (id, paused, running_since, last_run_at, updated_at)
VALUES ('singleton', 0, NULL, NULL, datetime('now'));
