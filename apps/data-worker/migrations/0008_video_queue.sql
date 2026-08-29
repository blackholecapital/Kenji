-- Kenji Pass 8: queue-backed video lane and asynchronous session jobs
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS video_jobs (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  result_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  queued_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_owner ON video_jobs(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status, updated_at DESC);

UPDATE orchestration_lanes
SET mode='queue',
    per_minute=20,
    burst=5,
    shard_count=2,
    note='Kenji video ingress → governed queue → shared blackhole-video-worker',
    updated_at=unixepoch()*1000
WHERE lane='video';
