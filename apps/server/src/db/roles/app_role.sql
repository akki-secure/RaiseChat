-- アプリ専用ユーザー（最小権限）を作成・更新する。何度実行しても同じ結果になる。
-- 管理用ユーザー（マイグレーション実行者）で実行すること。
--   psql -v app_password='...' -f app_role.sql
-- 付与するのは SELECT / INSERT / UPDATE のみ。DELETE・TRUNCATE・DDL は付与しない。

SELECT format('CREATE ROLE raisechat_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'raisechat_app') \gexec

ALTER ROLE raisechat_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION LOGIN
  PASSWORD :'app_password';

GRANT CONNECT ON DATABASE :"DBNAME" TO raisechat_app;
GRANT USAGE ON SCHEMA public TO raisechat_app;
-- バージョンによる差をなくすため、public スキーマでのテーブル作成を全員から剥奪する
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- 既存のテーブル・シーケンス
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO raisechat_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO raisechat_app;

-- 今後マイグレーションで作られるテーブル・シーケンス
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO raisechat_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO raisechat_app;
