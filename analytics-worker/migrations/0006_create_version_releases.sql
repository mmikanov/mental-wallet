-- Per-platform / per-version go-live times. Metrics ignore events RECEIVED before a
-- version's live_at (store review + tester traffic). No row => events included.
-- Read-time filter only; nothing is deleted. live_at is ISO-8601 UTC.
CREATE TABLE IF NOT EXISTS version_releases (
  platform TEXT NOT NULL,
  app_version TEXT NOT NULL,
  live_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  PRIMARY KEY (platform, app_version)
);
