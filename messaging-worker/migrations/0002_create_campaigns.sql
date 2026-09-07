-- Campaigns: a stored, reusable definition of "send tip X to scope Y in mode Z",
-- executed by id. Content stays in content/tips/<tip_slug>.md; this row holds only
-- sending parameters and state.

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,                    -- system-generated UUID, never reused
  name TEXT NOT NULL UNIQUE,              -- human label; unique (collision check)
  tip_slug TEXT NOT NULL,                 -- references content/tips/<slug>.md
  scope TEXT NOT NULL,                    -- 'tips' | 'reminders'
  mode TEXT NOT NULL DEFAULT 'new_only',  -- 'new_only' | 'resend_all'
  status TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'sending' | 'sent' | 'paused'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_campaigns_name ON campaigns (name);
