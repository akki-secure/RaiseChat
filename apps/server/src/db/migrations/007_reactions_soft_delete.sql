-- リアクションの論理削除（取り消しは印をつけるだけ。付け直しは deleted_at を NULL に戻す）
ALTER TABLE reactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
