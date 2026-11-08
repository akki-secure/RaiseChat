ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_mode VARCHAR(10) NOT NULL DEFAULT 'any'
  CHECK (mfa_mode IN ('any', 'both'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_2fa_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS recovery_codes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash      TEXT NOT NULL,
  used_at        TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id ON recovery_codes(user_id);
