# RaiseChat

Slack 風のリアルタイムチャット Web アプリケーション。  
中規模（20〜200 人）のチームや組織向けに、ワークスペース・チャンネルベースのコミュニケーションを提供する。

---

## 画面遷移図

```
/auth/login
  └─ ログイン成功 → /  → /workspace/:id  → /workspace/:id/channel/:cid
                                          └─ /workspace/:id/dm/:uid
                                          └─ /workspace/:id/search
/auth/register
  └─ 登録成功   → /workspace/new → /workspace/:id

未認証アクセス → /auth/login にリダイレクト
```

---

## UIモック

| 画面 | 説明 |
|---|---|
| ログイン | ユーザーID + パスワード |
| チャット | 左サイドバー（チャンネル・DM）＋ メッセージ一覧 ＋ スレッドパネル |
| DM | バブル形式の1対1チャット |
| 検索 | 全文検索結果一覧 |

---

## ER図

```
users
  id (PK)  username  display_name  avatar_url  status  password_hash  created_at

workspaces
  id (PK)  name  owner_id (FK→users)  invite_code  created_at

workspace_members
  workspace_id (FK)  user_id (FK)  role(owner|member)  joined_at

channels
  id (PK)  workspace_id (FK)  name  type(public|private)  created_by (FK→users)  created_at

channel_members
  channel_id (FK)  user_id (FK)  joined_at  last_read_at

messages
  id (PK)  channel_id (FK)  user_id (FK)  content  parent_id (FK→messages)
  edited_at  deleted_at  created_at

attachments
  id (PK)  message_id (FK)  url  file_type  size  created_at

reactions
  id (PK)  message_id (FK)  user_id (FK)  emoji  created_at
  UNIQUE(message_id, user_id, emoji)

direct_messages
  id (PK)  workspace_id (FK)  sender_id (FK→users)  receiver_id (FK→users)
  content  read_at  created_at
```

---

## API仕様

### 認証 `/api/auth`

| Method | Path | 概要 |
|---|---|---|
| POST | `/register` | ユーザー登録 |
| POST | `/login` | ログイン (JWT Cookie 発行) |
| POST | `/logout` | ログアウト |
| GET | `/me` | 自分の情報取得 |
| PATCH | `/profile` | プロフィール更新 |

### ワークスペース `/api/workspaces`

| Method | Path | 概要 |
|---|---|---|
| GET | `/` | 所属ワークスペース一覧 |
| POST | `/` | 新規作成 |
| POST | `/join` | 招待コードで参加 |
| GET | `/:id/members` | メンバー一覧 |
| GET | `/:id/members/:uid` | 特定メンバー情報 |
| GET | `/:id/search?q=` | 全文検索 |
| POST | `/:id/invite` | 招待コード再生成 |
| POST | `/:id/kick` | メンバーキック |

### チャンネル `/api/workspaces/:wid/channels`

| Method | Path | 概要 |
|---|---|---|
| GET | `/` | チャンネル一覧 |
| POST | `/` | チャンネル作成 |
| POST | `/:id/join` | 参加 |

### メッセージ `/api/channels/:cid/messages`

| Method | Path | 概要 |
|---|---|---|
| GET | `/` | 一覧 (カーソルページネーション) |
| POST | `/` | 送信 |
| PUT | `/:mid` | 編集 |
| DELETE | `/:mid` | 論理削除 |

### リアクション `/api/messages/:mid/reactions`

| Method | Path | 概要 |
|---|---|---|
| POST | `/` | 追加 |
| DELETE | `/:emoji` | 削除 |

### DM `/api/workspaces/:wid/dms`

| Method | Path | 概要 |
|---|---|---|
| GET | `/:uid` | DM一覧 |
| POST | `/:uid` | 送信 |

### アップロード `/api/upload`

| Method | Path | 概要 |
|---|---|---|
| POST | `/` | S3 署名付きURL取得 |

---

## Socket.io イベント

| イベント | 方向 | 概要 |
|---|---|---|
| `channel:join` | client→server | チャンネルルーム参加 |
| `channel:leave` | client→server | ルーム離脱 |
| `message:new` | server→client | 新着メッセージ配信 |
| `message:update` | server→client | 編集通知 |
| `message:delete` | server→client | 削除通知 |
| `presence:snapshot` | server→client | オンラインユーザー全量 |
| `presence:online` | server→client | ユーザーオンライン |
| `presence:offline` | server→client | ユーザーオフライン |

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| 状態管理 | Zustand |
| バックエンド | Node.js + Express + Socket.io |
| データベース | PostgreSQL |
| ファイルストレージ | AWS S3 |
| 認証 | JWT + bcrypt (httpOnly Cookie) |
| インフラ | AWS (ECS Fargate + RDS + S3) + Terraform |

---

## ローカル起動

### 前提条件

- Node.js 20+
- pnpm 9+
- Docker / Docker Compose

### 手順

```bash
# 1. 依存インストール
pnpm install

# 2. 環境変数
cp apps/server/.env.example apps/server/.env
# .env を編集して JWT_SECRET, DB_*, AWS_* を設定

# 3. DB 起動
pnpm db:up

# 4. DB マイグレーション
psql -U raisechat -d raisechat -f apps/server/src/db/migrations/001_init.sql

# 5. 開発サーバー起動
pnpm dev
# server: http://localhost:4000
# web:    http://localhost:3000
```

### テスト実行

```bash
# 全テスト
pnpm test

# 個別
pnpm --filter server test
pnpm --filter web test
```

### 静的解析

```bash
pnpm lint
```

### シークレットスキャン（要 gitleaks）

```bash
pnpm secret:scan
```

---

## セキュリティ対策

| 対策 | 内容 |
|---|---|
| レート制限 | グローバル 300req/15min、認証 10req/15min、アップロード 10req/min |
| XSS | helmet による CSP + HTML エスケープ |
| CSRF | httpOnly Cookie + SameSite=Strict |
| SQLインジェクション | pg プリペアドステートメント |
| 入力バリデーション | Zod スキーマ |
| シークレット管理 | .env + .gitignore、gitleaks でスキャン |

---

## ✨ 追加機能一覧

> [!TIP]
> 以下はベース機能に追加で実装した機能です。初期実装とは別ファイルで管理されています。

| 機能 | 説明 | サーバー | フロントエンド |
|---|---|---|---|
| 🔐 **TOTP 2段階認証** | ログイン時にパスワード＋認証アプリの6桁コードで本人確認。AI悪用フィッシング攻撃への対策として導入。 | `apps/server/src/features/totp/` | `apps/web/features/totp/` |

### 🔐 TOTP 2段階認証の詳細

> [!NOTE]
> Google Authenticator・Authy・Microsoft Authenticator（iOS / Android 両対応）で利用できます。

**有効化の流れ**
1. サイドバー下部の「2段階認証を設定する」をクリック
2. QRコードを認証アプリで読み取る（手動入力にも対応）
3. アプリに表示された6桁コードを入力して「有効にする」

**ログイン時の流れ（有効化後）**
1. ユーザー名・パスワードを入力してログイン
2. 「6桁コードを入力してください」画面が表示される
3. スマホの認証アプリに表示されたコードを入力

> [!WARNING]
> コードは30秒ごとに自動更新されます。期限切れの場合は新しいコードを入力してください。

**関連ファイル**

```
apps/server/src/
  db/migrations/002_totp.sql          # users テーブルへの totp_secret/totp_enabled 追加
  features/totp/
    totpService.ts                    # シークレット生成・コード検証・QRコード生成
    totpRouter.ts                     # GET /setup  POST /enable  POST /verify  DELETE /disable

apps/web/features/totp/
  TotpSetupModal.tsx                  # QRコード表示・有効化モーダル
  TotpVerifyStep.tsx                  # ログイン時6桁コード入力コンポーネント
```
