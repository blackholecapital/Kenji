-- Kenji Pass 9: handoff + launch acceptance
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS launch_profile (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT 'Kenji',
  operator_name TEXT NOT NULL DEFAULT '',
  handoff_status TEXT NOT NULL DEFAULT 'setup',
  notes TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

INSERT INTO launch_profile(id,company_name,operator_name,handoff_status,notes,updated_at)
VALUES('default','Kenji','','setup','',unixepoch()*1000)
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS launch_acceptance_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  checks_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT 'owner',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_seed_batches (
  id TEXT PRIMARY KEY,
  lead_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'owner',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_launch_acceptance_time ON launch_acceptance_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_seed_time ON demo_seed_batches(created_at DESC);
