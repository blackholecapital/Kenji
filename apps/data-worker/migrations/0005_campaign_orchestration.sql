-- Kenji Pass 5: campaign execution, audience membership and retry orchestration
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source_filter TEXT NOT NULL DEFAULT '',
  source_account_filter TEXT NOT NULL DEFAULT '',
  stage_filter TEXT NOT NULL DEFAULT '',
  min_score INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  retry_minutes INTEGER NOT NULL DEFAULT 60,
  calls_per_tick INTEGER NOT NULL DEFAULT 5,
  total_members INTEGER NOT NULL DEFAULT 0,
  launched_at INTEGER,
  completed_at INTEGER,
  created_by TEXT NOT NULL DEFAULT 'owner',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_members (
  campaign_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER,
  last_call_id TEXT,
  last_disposition TEXT NOT NULL DEFAULT '',
  stop_reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, lead_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (last_call_id) REFERENCES calls(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS campaign_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  lead_id TEXT,
  type TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

ALTER TABLE calls ADD COLUMN campaign_id TEXT;
ALTER TABLE calls ADD COLUMN call_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_members_due ON campaign_members(campaign_id, status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_campaign_members_call ON campaign_members(last_call_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_time ON campaign_events(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_campaign ON calls(campaign_id, created_at DESC);
