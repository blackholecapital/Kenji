-- Kenji Pass 16: owner authentication hardening
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS owner_login_attempts (
  key_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  blocked_until INTEGER,
  last_attempt_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_owner_login_blocked ON owner_login_attempts(blocked_until);
CREATE INDEX IF NOT EXISTS idx_owner_login_last_attempt ON owner_login_attempts(last_attempt_at);
