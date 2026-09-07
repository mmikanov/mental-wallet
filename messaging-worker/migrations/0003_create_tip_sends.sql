-- Send record: one row per tip + recipient. Keyed by TIP (not campaign) so dedupe
-- ("already received this tip") survives campaign deletion and can't be re-triggered
-- by a new campaign for the same tip.

CREATE TABLE IF NOT EXISTS tip_sends (
  id TEXT PRIMARY KEY,
  tip_slug TEXT NOT NULL,                 -- dedupe key
  email TEXT NOT NULL,                    -- normalized lowercase
  campaign_id TEXT,                       -- which campaign triggered it (audit only; nullable)
  status TEXT NOT NULL,                   -- 'pending' | 'sent' | 'failed'
  resend_id TEXT,                         -- Resend message id when sent
  error TEXT,                             -- detail when failed
  sent_at TEXT,                           -- when actually sent (null until sent; set on success/retry)
  created_at TEXT NOT NULL,               -- when this row was first created (audit ordering)
  updated_at TEXT NOT NULL,               -- last status change
  UNIQUE (tip_slug, email)                -- one row per tip+recipient; enforces no double-send
);

CREATE INDEX IF NOT EXISTS idx_tip_sends_tip ON tip_sends (tip_slug);
CREATE INDEX IF NOT EXISTS idx_tip_sends_campaign ON tip_sends (campaign_id);
