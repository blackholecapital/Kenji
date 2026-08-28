-- Kenji Pass 2: direct HighLevel bridge, sub-account hierarchy, webhook ledger and writeback tracking
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS highlevel_locations (
  location_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  business_id TEXT NOT NULL DEFAULT '',
  pipeline_id TEXT NOT NULL DEFAULT '',
  note_user_id TEXT NOT NULL DEFAULT '',
  stage_map_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_pull_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS highlevel_links (
  lead_id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  contact_id TEXT NOT NULL DEFAULT '',
  opportunity_id TEXT NOT NULL DEFAULT '',
  pipeline_id TEXT NOT NULL DEFAULT '',
  stage_id TEXT NOT NULL DEFAULT '',
  sync_state TEXT NOT NULL DEFAULT 'linked',
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES highlevel_locations(location_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS highlevel_webhooks (
  webhook_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  location_id TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'accepted',
  payload_json TEXT NOT NULL DEFAULT '{}',
  received_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS highlevel_writebacks (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  call_id TEXT,
  location_id TEXT NOT NULL DEFAULT '',
  contact_id TEXT NOT NULL DEFAULT '',
  opportunity_id TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  request_json TEXT NOT NULL DEFAULT '{}',
  response_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_highlevel_contact_link ON highlevel_links(location_id, contact_id) WHERE contact_id <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_highlevel_opportunity_link ON highlevel_links(location_id, opportunity_id) WHERE opportunity_id <> '';
CREATE INDEX IF NOT EXISTS idx_highlevel_location_links ON highlevel_links(location_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_highlevel_webhook_time ON highlevel_webhooks(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_highlevel_writeback_call ON highlevel_writebacks(call_id, action, status);
CREATE INDEX IF NOT EXISTS idx_highlevel_writeback_time ON highlevel_writebacks(created_at DESC);
