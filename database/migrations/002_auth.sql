-- Login support. The API also applies this on startup for dev databases.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_user ON auth_sessions(user_id);

-- Email verification (one-time codes).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
UPDATE users SET email_verified_at = now() WHERE password_hash IS NOT NULL AND email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_otps (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  salt text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_email_otps_user ON email_otps(user_id);

-- Password reset codes share the table; purpose keeps them separate from sign-up codes.
ALTER TABLE email_otps ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'verify';
