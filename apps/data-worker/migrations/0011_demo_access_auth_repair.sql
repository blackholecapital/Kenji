-- Kenji UI access patch: keep the dashboard browseable without blocking on login,
-- while ensuring owner authentication can still initialize cleanly when requested.
PRAGMA foreign_keys = ON;

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

CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON owner_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON owner_sessions(user_id,expires_at);

UPDATE owner_setup
SET assistant_name='EILA', updated_at=unixepoch()*1000
WHERE lower(trim(assistant_name)) IN ('isla','eila');
