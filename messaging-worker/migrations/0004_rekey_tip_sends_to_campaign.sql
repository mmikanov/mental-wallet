-- Re-key the send record from TIP to CAMPAIGN.
--
-- Previously tip_sends enforced UNIQUE (tip_slug, email) so "already received this tip"
-- was permanent across campaigns. The drip needs the SAME tip to be deliverable by
-- MORE THAN ONE campaign (a tip can intentionally recur later in the sequence), so
-- uniqueness/dedupe must be per CAMPAIGN, not per tip. tip_slug is retained as an
-- informational/audit column.
--
-- SQLite cannot alter a UNIQUE constraint in place, so this rebuilds the table.
--
-- Verified safe on current production data: tip_sends has 47 rows, 0 with NULL
-- campaign_id, and every tip maps to exactly one campaign — so the old (tip_slug,email)
-- and new (campaign_id,email) uniqueness are equivalent on existing rows; no row can
-- collide or merge during the copy, and no NULL-handling/sentinel is needed.

CREATE TABLE IF NOT EXISTS tip_sends_new (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,               -- dedupe key (was tip_slug)
  tip_slug TEXT NOT NULL,                  -- informational/audit only
  email TEXT NOT NULL,                     -- normalized lowercase
  status TEXT NOT NULL,                    -- 'pending' | 'sent' | 'failed'
  resend_id TEXT,                          -- Resend message id when sent
  error TEXT,                              -- detail when failed
  sent_at TEXT,                            -- when actually sent (null until sent)
  created_at TEXT NOT NULL,                -- when this row was first created
  updated_at TEXT NOT NULL,                -- last status change
  UNIQUE (campaign_id, email)              -- one row per campaign+recipient
);

-- Copy every existing row. campaign_id is NOT NULL on all current rows.
INSERT INTO tip_sends_new (id, campaign_id, tip_slug, email, status, resend_id, error, sent_at, created_at, updated_at)
SELECT id, campaign_id, tip_slug, email, status, resend_id, error, sent_at, created_at, updated_at
FROM tip_sends;

DROP TABLE tip_sends;
ALTER TABLE tip_sends_new RENAME TO tip_sends;

CREATE INDEX IF NOT EXISTS idx_tip_sends_campaign ON tip_sends (campaign_id);
CREATE INDEX IF NOT EXISTS idx_tip_sends_email ON tip_sends (email);
