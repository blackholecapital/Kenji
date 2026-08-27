-- Kenji Pass 1 call-center data plane
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  source_account TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'New',
  score INTEGER NOT NULL DEFAULT 50,
  assigned_to TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  contactable INTEGER NOT NULL DEFAULT 1,
  dnc INTEGER NOT NULL DEFAULT 0,
  last_contacted_at INTEGER,
  next_callback_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  status TEXT NOT NULL DEFAULT 'queued',
  disposition TEXT NOT NULL DEFAULT '',
  provider_sid TEXT NOT NULL DEFAULT '',
  started_at INTEGER,
  ended_at INTEGER,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  transcript TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS call_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS callbacks (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  reason TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'operator',
  call_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_events (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  text TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS owner_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  pass_salt TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS owner_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES owner_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'chat',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_updated ON leads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_callback ON leads(next_callback_at);
CREATE INDEX IF NOT EXISTS idx_calls_lead ON calls(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_callbacks_due ON callbacks(status, due_at);
CREATE INDEX IF NOT EXISTS idx_events_lead ON lead_events(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON owner_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_assistant_session ON assistant_messages(session_id, created_at ASC);
