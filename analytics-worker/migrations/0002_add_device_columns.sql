-- Add device metadata columns to events table.
-- These store platform (ios/android), OS version, and app version
-- sent by the client on every analytics event.

ALTER TABLE events ADD COLUMN platform TEXT;
ALTER TABLE events ADD COLUMN os_version TEXT;
ALTER TABLE events ADD COLUMN app_version TEXT;

-- Index for dashboard breakdown queries by platform and app version
CREATE INDEX IF NOT EXISTS idx_events_platform ON events (platform);
CREATE INDEX IF NOT EXISTS idx_events_app_version ON events (app_version);
