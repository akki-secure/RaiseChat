-- チャンネルの論理削除（復元機能は作らない。削除は印をつけるだけ）
ALTER TABLE channels ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
