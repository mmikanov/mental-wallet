-- 0004_backfill_tool_added_source.sql
--
-- One-time DATA backfill (not a schema change). Stamps source = 'library_browser'
-- into the properties JSON of every historical `tool_added` row that lacks a source.
-- Before 1.0.4, the only way tool_added fired was the Library Browser, so this is the
-- accurate historical value.
--
-- Idempotent: the `IS NULL` guard means re-running is a no-op and post-1.0.4 rows that
-- already carry source (e.g. 'emotion_session') are never overwritten.
-- Scope: does NOT touch `tool_created` rows, and does NOT write `entry_point` on
-- historical rows (there is no truthful list/preview value — that dimension did not
-- exist before 1.0.4; its absence is intentional).
--
-- BEFORE running this file, run the dry-run count interactively to see the blast radius:
--   wrangler d1 execute analytics-db --remote --command "SELECT COUNT(*) AS to_backfill FROM events WHERE event_type = 'tool_added' AND json_extract(properties, '$.source') IS NULL;"
-- Then apply:
--   wrangler d1 execute analytics-db --remote --file=migrations/0004_backfill_tool_added_source.sql

UPDATE events
SET properties = json_set(properties, '$.source', 'library_browser')
WHERE event_type = 'tool_added'
  AND json_extract(properties, '$.source') IS NULL;
