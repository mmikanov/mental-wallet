-- Mark test subscribers used by the drip time-travel test harness.
--
-- Test subscribers are isolated: all drip test actions and the simulate endpoint operate
-- ONLY on rows with is_test = 1, and never touch or advance real subscribers (is_test = 0).
-- A test subscriber's signup age is set by backdating its created_at (joined N days ago),
-- so it behaves exactly like a real subscriber of that age for sequence/gap resolution.

ALTER TABLE subscribers ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_subscribers_is_test ON subscribers (is_test);
