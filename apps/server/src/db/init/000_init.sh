#!/bin/bash
# Docker 初回起動時のみ実行される（管理用ユーザー POSTGRES_USER として）。
# 1) アプリ専用ユーザーを作成  2) マイグレーションを順に適用
set -euo pipefail

: "${DB_APP_PASSWORD:?DB_APP_PASSWORD を設定してください}"

psql -v ON_ERROR_STOP=1 -v app_password="$DB_APP_PASSWORD" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f /roles/app_role.sql

for f in $(ls /migrations/*.sql | sort); do
  echo "apply $f"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done
