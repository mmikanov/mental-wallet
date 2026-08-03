-- Analytics events table
-- Stores all anonymous usage events received from the app.

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  anonymous_user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  properties TEXT,          -- JSON string of event-specific properties
  received_at TEXT NOT NULL -- Server-side receipt time (ISO 8601)
);

-- Index for dashboard queries: filter by event_type, then scan by timestamp
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events (event_type, timestamp);

-- Index for per-user queries (retention, user list)
CREATE INDEX IF NOT EXISTS idx_events_user ON events (anonymous_user_id, timestamp);
