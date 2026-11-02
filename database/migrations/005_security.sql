-- Limits shared between workers, and an audit trail that outlives deleted accounts.
CREATE TABLE IF NOT EXISTS rate_events (
  id uuid PRIMARY KEY,
  key varchar(320) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_events_key_idx ON rate_events (key);
CREATE INDEX IF NOT EXISTS rate_events_created_at_idx ON rate_events (created_at);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  action varchar(40) NOT NULL,
  user_id varchar(36) NOT NULL,
  target varchar(64),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_user_id_idx ON audit_events (user_id);
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events (created_at);
