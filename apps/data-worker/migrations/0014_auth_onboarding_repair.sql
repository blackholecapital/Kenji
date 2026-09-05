-- Pass 21 hotfix: complete auth onboarding schema
PRAGMA foreign_keys = ON;

ALTER TABLE owner_users ADD COLUMN pass_iterations INTEGER NOT NULL DEFAULT 180000;

UPDATE owner_users
SET pass_iterations = 180000
WHERE pass_iterations IS NULL OR pass_iterations < 1;
