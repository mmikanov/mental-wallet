-- The drip sequence: a single, global, ordered list of campaigns that every subscriber
-- moves through one at a time. There is exactly ONE sequence (multiple parallel sequences
-- are out of scope). Each row links a campaign into the sequence at a position.
--
-- The sequence is built from scratch via the admin endpoints (no seed script): it starts
-- empty and the operator adds steps one at a time. When there are no enabled steps, the
-- daily run simply sends nothing.
--
-- A subscriber's position is NOT stored here — it is derived live from their send history
-- (the earliest enabled step they have not yet received and are eligible for). So editing
-- this table (reorder/add/remove) just changes what the next run resolves, with no
-- per-subscriber state to migrate.

CREATE TABLE IF NOT EXISTS sequence_steps (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,               -- which campaign this step sends
  position INTEGER NOT NULL,               -- order within the sequence (ascending)
  enabled INTEGER NOT NULL DEFAULT 1,      -- 0 = removed/disabled (skipped by the run)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (position),                       -- one step per position
  UNIQUE (campaign_id)                     -- a campaign appears at most once in the sequence
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_position ON sequence_steps (position);
