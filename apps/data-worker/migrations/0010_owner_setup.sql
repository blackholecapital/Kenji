-- Kenji Pass 10: owner-facing setup and demo-polish profile
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS owner_setup (
  id TEXT PRIMARY KEY,
  brand_label TEXT NOT NULL DEFAULT 'Kenji AI',
  assistant_name TEXT NOT NULL DEFAULT 'Isla',
  primary_goal TEXT NOT NULL DEFAULT 'Turn lead backlog into booked conversations',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  demo_mode INTEGER NOT NULL DEFAULT 1,
  current_step INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO owner_setup(id,brand_label,assistant_name,primary_goal,timezone,demo_mode,current_step,created_at,updated_at)
VALUES('default','Kenji AI','Isla','Turn lead backlog into booked conversations','America/New_York',1,1,unixepoch()*1000,unixepoch()*1000)
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS owner_demo_runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'guided',
  completed_steps_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_owner_demo_runs_time ON owner_demo_runs(created_at DESC);
