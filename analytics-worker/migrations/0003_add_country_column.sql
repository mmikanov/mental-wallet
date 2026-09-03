-- Add coarse geo (country) to events.
-- Populated server-side at ingest from Cloudflare's request.cf.country
-- (derived from the request IP). Country-level only; the app sends no
-- location data. Existing rows stay NULL; only events received after
-- this ships will have a country.

ALTER TABLE events ADD COLUMN country TEXT;

-- Index for country breakdown / per-user latest-country lookups
CREATE INDEX IF NOT EXISTS idx_events_country ON events (country);
