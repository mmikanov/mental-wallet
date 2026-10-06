-- Add the acquisition channel column to events table.
-- Promoted from properties.channel at ingest so it is a first-class, indexed
-- predicate alongside platform. Historical rows get NULL (organic/untagged; no
-- backfill). The reserved value 'organic' maps to channel IS NULL at query time.

ALTER TABLE events ADD COLUMN channel TEXT;

-- Index for dashboard breakdown + filter queries by channel
CREATE INDEX IF NOT EXISTS idx_events_channel ON events (channel);
