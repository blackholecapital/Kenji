-- Kenji Pass 6: explicit channel consent, SMS/email queues and nurture orchestration
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lead_channel_consent (
  lead_id TEXT PRIMARY KEY,
  sms_opt_in INTEGER NOT NULL DEFAULT 0,
  email_opt_in INTEGER NOT NULL DEFAULT 0,
  sms_opt_in_at INTEGER,
  email_opt_in_at INTEGER,
  sms_opt_out_at INTEGER,
  email_opt_out_at INTEGER,
  consent_source TEXT NOT NULL DEFAULT '',
  consent_note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS communication_settings (
  id TEXT PRIMARY KEY,
  sms_from_number TEXT NOT NULL DEFAULT '',
  email_from TEXT NOT NULL DEFAULT '',
  reply_to TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO communication_settings(id,sms_from_number,email_from,reply_to,updated_at)
VALUES('default','','','',0);

CREATE TABLE IF NOT EXISTS nurture_sequences (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source_filter TEXT NOT NULL DEFAULT '',
  source_account_filter TEXT NOT NULL DEFAULT '',
  stage_filter TEXT NOT NULL DEFAULT '',
  min_score INTEGER NOT NULL DEFAULT 0,
  total_members INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'owner',
  launched_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS nurture_steps (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  channel TEXT NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE(sequence_id, step_order),
  FOREIGN KEY (sequence_id) REFERENCES nurture_sequences(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nurture_members (
  sequence_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  next_step_order INTEGER NOT NULL DEFAULT 1,
  next_run_at INTEGER,
  last_message_id TEXT NOT NULL DEFAULT '',
  stop_reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(sequence_id, lead_id),
  FOREIGN KEY (sequence_id) REFERENCES nurture_sequences(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS communication_messages (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  sequence_id TEXT,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  status TEXT NOT NULL DEFAULT 'queued',
  provider_id TEXT NOT NULL DEFAULT '',
  from_value TEXT NOT NULL DEFAULT '',
  to_value TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (sequence_id) REFERENCES nurture_sequences(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_channel_consent_sms ON lead_channel_consent(sms_opt_in, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_consent_email ON lead_channel_consent(email_opt_in, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nurture_sequence_status ON nurture_sequences(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nurture_member_due ON nurture_members(sequence_id, status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_comm_messages_lead ON communication_messages(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_messages_sequence ON communication_messages(sequence_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_messages_status ON communication_messages(channel, status, created_at DESC);
