-- Kenji Pass 3: outcome intelligence, appointment intents, and operator action confirmation
PRAGMA foreign_keys = ON;

ALTER TABLE highlevel_locations ADD COLUMN calendar_id TEXT NOT NULL DEFAULT '';
ALTER TABLE highlevel_locations ADD COLUMN assigned_user_id TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS call_outcomes (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL UNIQUE,
  lead_id TEXT NOT NULL,
  disposition TEXT NOT NULL DEFAULT 'unknown',
  confidence REAL NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  callback_at INTEGER,
  appointment_start INTEGER,
  raw_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointment_intents (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  call_id TEXT,
  start_at INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  title TEXT NOT NULL DEFAULT 'Follow-up appointment',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  external_appointment_id TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'voice-worker',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS operator_actions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  instruction TEXT NOT NULL DEFAULT '',
  action_type TEXT NOT NULL,
  target_id TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  explanation TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  result_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES owner_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_call_outcomes_lead ON call_outcomes(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointment_intents_status ON appointment_intents(status, start_at);
CREATE INDEX IF NOT EXISTS idx_operator_actions_owner ON operator_actions(owner_user_id, status, created_at DESC);
