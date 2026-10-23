-- RaiseChat 初期スキーマ
-- 物理削除禁止: メッセージはdeleted_atフラグで論理削除

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ユーザー
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) NOT NULL UNIQUE,
  display_name  VARCHAR(100),
  avatar_url    TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'offline'
                CHECK (status IN ('online','away','busy','offline')),
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ワークスペース
CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  owner_id    UUID        NOT NULL REFERENCES users(id),
  invite_code VARCHAR(32) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ワークスペースメンバー
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(10) NOT NULL DEFAULT 'member'
               CHECK (role IN ('owner','member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

-- チャンネル
CREATE TABLE IF NOT EXISTS channels (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  type         VARCHAR(10) NOT NULL DEFAULT 'public'
               CHECK (type IN ('public','private')),
  created_by   UUID        NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name)
);

-- チャンネルメンバー
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id   UUID        NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

-- メッセージ (親がNULLならチャンネルメッセージ, 親があればスレッド返信)
CREATE TABLE IF NOT EXISTS messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID        NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id),
  content    TEXT        NOT NULL,
  parent_id  UUID        REFERENCES messages(id) ON DELETE CASCADE,
  edited_at  TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 全文検索インデックス
CREATE INDEX IF NOT EXISTS messages_content_fts ON messages
  USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS messages_channel_created ON messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS messages_parent_id ON messages(parent_id) WHERE parent_id IS NOT NULL;

-- 添付ファイル
CREATE TABLE IF NOT EXISTS attachments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  url        TEXT        NOT NULL,
  file_type  VARCHAR(50) NOT NULL,
  size       BIGINT      NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 絵文字リアクション
CREATE TABLE IF NOT EXISTS reactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

-- ダイレクトメッセージ
CREATE TABLE IF NOT EXISTS direct_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sender_id    UUID        NOT NULL REFERENCES users(id),
  receiver_id  UUID        NOT NULL REFERENCES users(id),
  content      TEXT        NOT NULL,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dm_conversation ON direct_messages(workspace_id, sender_id, receiver_id, created_at);
