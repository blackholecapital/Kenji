-- Kenji Pass 4: inbound receptionist routing audit
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS phone_routes (
  id TEXT PRIMARY KEY,
  number_sid TEXT NOT NULL,
  phone_number TEXT NOT NULL DEFAULT '',
  previous_voice_url TEXT NOT NULL DEFAULT '',
  new_voice_url TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT 'owner',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phone_routes_number ON phone_routes(number_sid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_provider_direction ON calls(provider_sid, direction, created_at DESC);
