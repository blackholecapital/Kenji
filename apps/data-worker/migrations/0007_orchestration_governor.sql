-- Kenji Pass 7: orchestration governor and lane control
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orchestration_lanes (
  lane TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'queue',
  enabled INTEGER NOT NULL DEFAULT 1,
  circuit_open INTEGER NOT NULL DEFAULT 0,
  per_minute INTEGER NOT NULL,
  burst INTEGER NOT NULL DEFAULT 0,
  shard_count INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

INSERT INTO orchestration_lanes(lane,mode,enabled,circuit_open,per_minute,burst,shard_count,note,updated_at)
VALUES
  ('voice','queue',1,0,120,20,4,'Campaign voice ingress → kenji-call-jobs',unixepoch()*1000),
  ('sms','queue',1,0,300,50,4,'Nurture SMS ingress → kenji-sms-jobs',unixepoch()*1000),
  ('email','queue',1,0,600,100,4,'Nurture email ingress → kenji-email-jobs',unixepoch()*1000),
  ('video','external',1,0,20,5,2,'External blackhole-video-worker capacity hint',unixepoch()*1000)
ON CONFLICT(lane) DO NOTHING;

CREATE TABLE IF NOT EXISTS orchestration_events (
  id TEXT PRIMARY KEY,
  lane TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orchestration_load_tests (
  id TEXT PRIMARY KEY,
  lane TEXT NOT NULL,
  requested_jobs INTEGER NOT NULL,
  per_minute INTEGER NOT NULL,
  shard_count INTEGER NOT NULL,
  estimated_minutes REAL NOT NULL,
  estimated_daily_capacity INTEGER NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'owner',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orchestration_events_time ON orchestration_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orchestration_events_lane ON orchestration_events(lane,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orchestration_load_tests_time ON orchestration_load_tests(created_at DESC);
