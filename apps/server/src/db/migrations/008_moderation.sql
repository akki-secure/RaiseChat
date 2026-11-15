-- 警告の記録（物理削除しない。取り消しは revoked_at に印をつける）
CREATE TABLE IF NOT EXISTS member_warnings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  issued_by    UUID NOT NULL REFERENCES users(id),
  reason       TEXT NOT NULL,
  message_id   UUID REFERENCES messages(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_member_warnings_ws_user
  ON member_warnings (workspace_id, user_id);

-- キック（論理削除。再参加ブロックの判定にも使う）
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS removed_at     TIMESTAMPTZ;
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS removed_reason TEXT;
ALTER TABLE channel_members   ADD COLUMN IF NOT EXISTS removed_at     TIMESTAMPTZ;
