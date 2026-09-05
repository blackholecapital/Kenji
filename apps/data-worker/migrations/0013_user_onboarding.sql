-- Pass 21: multi-user onboarding + signup control
PRAGMA foreign_keys = ON;

ALTER TABLE owner_users ADD COLUMN role TEXT NOT NULL DEFAULT 'operator';

CREATE TABLE IF NOT EXISTS owner_auth_settings (
  id TEXT PRIMARY KEY,
  signup_enabled INTEGER NOT NULL DEFAULT 1,
  owner_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES owner_users(id) ON DELETE SET NULL
);

INSERT INTO owner_auth_settings(id, signup_enabled, owner_user_id, created_at, updated_at)
SELECT 'default', 1,
  (SELECT id FROM owner_users ORDER BY created_at ASC LIMIT 1),
  unixepoch()*1000, unixepoch()*1000
WHERE NOT EXISTS (SELECT 1 FROM owner_auth_settings WHERE id='default');

UPDATE owner_users
SET role='owner'
WHERE id=(SELECT owner_user_id FROM owner_auth_settings WHERE id='default')
  AND role<>'owner';

CREATE INDEX IF NOT EXISTS idx_owner_users_role ON owner_users(role, created_at);
