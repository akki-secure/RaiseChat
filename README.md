# RaiseChat

Slack 風のリアルタイムチャット Web アプリケーション。  
中規模（20〜200 人）のチームや組織向けに、ワークスペース・チャンネルベースのコミュニケーションを提供する。

---

## 画面遷移図

```
/auth/login
  └─ パスワード認証後（2段階認証が有効な場合）
       → 認証手段の選択（認証アプリ / パスキー / リカバリーコード）→ /
          ※「両方必須」の設定では、認証アプリ → パスキーの両方を完了してから /
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
  totp_secret  totp_enabled  security_question  security_answer_hash
  mfa_mode(any|both)  failed_2fa_attempts  locked_until

workspaces
  id (PK)  name  owner_id (FK→users)  invite_code  created_at

workspace_members
  workspace_id (FK)  user_id (FK)  role(owner|member)  joined_at
  removed_at  removed_reason  ※キックの論理削除。removed_at があるメンバーは再参加できない

member_warnings
  id (PK)  workspace_id (FK)  user_id (FK)  issued_by (FK→users)  reason  message_id (FK→messages)
  created_at  revoked_at  ※警告の記録。物理削除せず、取り消しは revoked_at

channels
  id (PK)  workspace_id (FK)  name  type(public|private)  created_by (FK→users)  created_at
  deleted_at  ※論理削除。削除時に name の末尾へ `~deleted~<id先頭8桁>` を足し、同名で作り直せるようにする

channel_members
  channel_id (FK)  user_id (FK)  joined_at  last_read_at  removed_at  ※キック時に設定。入り直しで NULL に戻る

messages
  id (PK)  channel_id (FK)  user_id (FK)  content  parent_id (FK→messages)
  edited_at  deleted_at  created_at

attachments
  id (PK)  message_id (FK)  url  file_type  size  created_at

reactions
  id (PK)  message_id (FK)  user_id (FK)  emoji  created_at  deleted_at
  UNIQUE(message_id, user_id, emoji)
  ※論理削除。取り消しは deleted_at を設定し、付け直しは deleted_at を NULL に戻す

direct_messages
  id (PK)  workspace_id (FK)  sender_id (FK→users)  receiver_id (FK→users)
  content  read_at  created_at

passkeys
  id (PK)  user_id (FK→users)  credential_id (UNIQUE)  public_key  counter  transports
  device_name  created_at  last_used_at  deleted_at

recovery_codes
  id (PK)  user_id (FK→users)  code_hash  used_at  invalidated_at  created_at
```

---

## API仕様

### 認証 `/api/auth`

| Method | Path | 概要 |
|---|---|---|
| POST | `/register` | ユーザー登録 |
| POST | `/login` | ログイン (JWT Cookie 発行)。2段階認証が有効なら `{requireTotp, methods, mfa_mode}` を返し、認証ステップへ |
| DELETE | `/logout` | ログアウト |
| GET | `/me` | 自分の情報取得 |
| PATCH | `/profile` | プロフィール更新 |

### TOTP `/api/totp`

| Method | Path | 概要 |
|---|---|---|
| GET | `/setup` | QRコード・シークレット発行（要ログイン） |
| POST | `/enable` | 6桁コード確認後に有効化（要ログイン） |
| POST | `/verify` | ログイン中のTOTP検証（pending_token 必須）。完了なら `{user}`、「両方必須」で残りがあれば `{remaining}` |
| DELETE | `/disable` | 無効化（「両方必須」の間は不可） |

### パスキー `/api/passkey`

| Method | Path | 概要 |
|---|---|---|
| GET | `/` | 登録済みパスキー一覧（要ログイン） |
| POST | `/register/options` | 登録用オプション発行（要ログイン） |
| POST | `/register/verify` | 登録の検証・保存（要ログイン） |
| POST | `/authenticate/options` | 認証用オプション発行（pending_token 必須） |
| POST | `/authenticate/verify` | 認証の検証。レスポンスはTOTPの `/verify` と同形式 |
| DELETE | `/:id` | 論理削除（パスワード確認必須。「両方必須」の間は不可） |

### 2段階認証の設定 `/api/mfa`

| Method | Path | 概要 |
|---|---|---|
| GET | `/status` | 認証モード・TOTP有無・パスキー数・リカバリーコード残数（要ログイン） |
| PATCH | `/mode` | `any`（どちらか一方）/ `both`（両方必須）の切替。パスワード確認必須 |
| POST | `/recovery/regenerate` | リカバリーコード（8個）の再発行。旧コードは無効化。平文は1回のみ返す |
| POST | `/recovery/verify` | リカバリーコードでログイン（pending_token 必須） |

### ワークスペース `/api/workspaces`

| Method | Path | 概要 |
|---|---|---|
| GET | `/` | 所属ワークスペース一覧 |
| POST | `/` | 新規作成 |
| POST | `/join` | 招待コードで参加 |
| GET | `/:id/members` | メンバー一覧 |
| GET | `/:id/members/:uid` | 特定メンバー情報 |
| GET | `/:id/search?q=` | 全文検索 |
| POST | `/:id/invite` | 招待コード再生成（owner のみ） |

### 警告・キック `/api/workspaces/:wid/members`（owner のみ）

| Method | Path | 概要 |
|---|---|---|
| GET | `/removed` | キックされたメンバー一覧 |
| POST | `/:uid/warn` | 警告する（理由必須。本人へ通知） |
| GET | `/:uid/warnings` | 警告履歴と有効な警告回数 |
| POST | `/:uid/kick` | キックする（理由必須。警告3回、または `severe: true` が条件） |
| POST | `/:uid/unkick` | キックを解除する |

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
| `message:notify` | server→client | 新着通知（`user:<id>` ルーム宛て。開いていないチャンネルの発言も届く） |
| `message:update` | server→client | 編集通知 |
| `message:delete` | server→client | 削除通知 |
| `presence:snapshot` | server→client | オンラインユーザー全量 |
| `presence:online` | server→client | ユーザーオンライン |
| `presence:offline` | server→client | ユーザーオフライン |
| `member:warned` | server→client | 管理者から警告を受けた（本人のみ） |
| `member:kicked` | server→client | ワークスペースからキックされた（本人のみ） |

---

## 技術スタック

全体は pnpm ワークスペースのモノレポで、言語は TypeScript。

### フロントエンド（`apps/web`）

| 分類 | 技術 |
|---|---|
| フレームワーク | Next.js 15 (App Router) + React 18 |
| スタイリング | Tailwind CSS |
| 状態管理 | Zustand |
| リアルタイム通信 | socket.io-client |
| パスキー | @simplewebauthn/browser |
| Markdown 表示 | react-markdown + remark-gfm |
| テスト | Vitest + Testing Library (jsdom) |

### バックエンド（`apps/server`）

| 分類 | 技術 |
|---|---|
| フレームワーク | Node.js + Express 4 |
| リアルタイム通信 | Socket.IO 4 |
| データベース | PostgreSQL 16（`pg` で直接接続、ORM なし） |
| 認証 | JWT (httpOnly Cookie) + bcrypt |
| 2段階認証 | otplib (TOTP) + qrcode / @simplewebauthn/server (パスキー) |
| セキュリティ | helmet / cors / express-rate-limit |
| バリデーション | zod |
| ファイルストレージ | AWS S3 (@aws-sdk/client-s3) + multer |
| ログ | winston |
| テスト | Vitest + supertest |

### 開発環境・CI

| 分類 | 技術 |
|---|---|
| パッケージ管理 | pnpm 9 (workspace) |
| ローカルDB | Docker Compose (postgres:16-alpine) |
| 静的解析 | ESLint + TypeScript |
| シークレット検出 | gitleaks |
| PR レビュー | Claude Code による自動レビュー (GitHub Actions) |

---|---|
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
cp .env.example apps/server/.env
# .env を編集して JWT_SECRET, DB_*（DB_ADMIN_* を含む）, AWS_*, WEBAUTHN_* を設定
# DB_USER は raisechat_app 固定。DB_ADMIN_USER は別名にする（例: raisechat_admin）
# 開発時の例: WEBAUTHN_RP_ID=localhost / WEBAUTHN_RP_NAME=RaiseChat / WEBAUTHN_ORIGIN=http://localhost:3000

# 3. DB 起動（初回起動時に、アプリ専用ユーザーの作成とマイグレーション適用まで自動で行う）
pnpm db:up

# 4. 開発サーバー起動
pnpm dev
# server: http://localhost:4000
# web:    http://localhost:3000
```

### 既存のDBを最小権限に移行する（初回起動済みのボリュームがある場合）

初期化スクリプトは初回起動時にしか動かないため、既存のDBには次を手動で一度だけ実行する。データは消えない。事前に `pg_dump` でバックアップを取ること。

まず、`raisechat_app` がブートストラップ（最初に作られた）スーパーユーザーかを確認する。

```bash
psql -h localhost -p <port> -d raisechat -tA -c "SELECT oid FROM pg_roles WHERE rolname = 'raisechat_app'"
# oid が 10 なら「ブートストラップ」（Docker を旧設定で初期化した場合）→ パターンB
# それ以外（通常のロール）                                           → パターンA
```

**パターンA: `raisechat_app` が通常のロールの場合**

```bash
# スーパーユーザー（例: 自分のOSユーザー）で、管理用ユーザーを作り、所有権を移す
psql -h localhost -p <port> -d raisechat <<'SQL'
CREATE ROLE raisechat_admin SUPERUSER LOGIN PASSWORD '<DB_ADMIN_PASSWORD>';
REASSIGN OWNED BY raisechat_app TO raisechat_admin;
SQL

# アプリ用ユーザーを最小権限にする（SELECT/INSERT/UPDATE のみ付与）
psql -h localhost -p <port> -U raisechat_admin -d raisechat \
  -v app_password='<DB_PASSWORD>' -f apps/server/src/db/roles/app_role.sql
```

**パターンB: `raisechat_app` がブートストラップ（oid=10）の場合**

ブートストラップのロールは、所有権の移管（`REASSIGN OWNED`）も降格もできない（Postgres 内部のオブジェクトを所有しているため）。管理用ユーザーを作って個別に付け替え、旧ロールを改名してログイン不可にする。

```bash
psql -h localhost -p <port> -U raisechat_app -d raisechat <<'SQL'
CREATE ROLE raisechat_admin SUPERUSER LOGIN PASSWORD '<DB_ADMIN_PASSWORD>';
SQL

psql -h localhost -p <port> -U raisechat_admin -d raisechat <<'SQL'
BEGIN;
SELECT format('ALTER TABLE %I.%I OWNER TO raisechat_admin', schemaname, tablename) FROM pg_tables WHERE schemaname='public' \gexec
SELECT format('ALTER SEQUENCE %I.%I OWNER TO raisechat_admin', schemaname, sequencename) FROM pg_sequences WHERE schemaname='public' \gexec
SELECT format('ALTER DATABASE %I OWNER TO raisechat_admin', current_database()) \gexec
ALTER ROLE raisechat_app RENAME TO raisechat_boot;
ALTER ROLE raisechat_boot NOLOGIN;
COMMIT;
SQL

# 新しい最小権限の raisechat_app を作る
psql -h localhost -p <port> -U raisechat_admin -d raisechat \
  -v app_password='<DB_PASSWORD>' -f apps/server/src/db/roles/app_role.sql
```

以後、新しいマイグレーションは `raisechat_admin` で適用する（`-U raisechat_admin`）。移行後は、アプリ用ユーザーで `DELETE`・`TRUNCATE`・`DROP`・`CREATE` が拒否されることを確認する。

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
| レート制限 | グローバル 300req/15min、認証 100req/15min、アップロード 10req/min |
| ログイン失敗の制限 | ユーザー名+IP の組み合わせで、失敗10回/15分（メモリ上で集計） |
| 2段階認証の失敗ロック | 失敗5回で15分ロック（DB保存・ユーザー単位） |
| パスキー（WebAuthn） | フィッシング耐性のある認証。生体認証（userVerification）を必須化 |
| リカバリーコード | bcrypt ハッシュで保存。使い捨て・再発行で旧コードを無効化 |
| XSS | helmet による CSP + HTML エスケープ |
| CSRF | httpOnly Cookie + SameSite=Strict |
| SQLインジェクション | pg プリペアドステートメント |
| 入力バリデーション | Zod スキーマ |
| シークレット管理 | .env + .gitignore、gitleaks でスキャン |
| DB権限の分離 | マイグレーション用の管理ユーザーと、アプリ用の最小権限ユーザー（`raisechat_app`：SELECT/INSERT/UPDATE のみ）を分離。アプリからは DELETE・TRUNCATE・DROP を実行できない（CI で検証） |

---

## ✨ 追加機能一覧

> [!TIP]
> 以下はベース機能に追加で実装した機能です。初期実装とは別ファイルで管理されています。

| 機能 | 説明・実装ファイル |
|---|---|
| 🔐 **TOTP 2段階認証** | パスワード＋認証アプリの6桁コードによるログイン。AI悪用フィッシング対策として導入。<br>`apps/server/src/features/totp/` · `apps/web/features/totp/` |
| ⚙️ **アカウント設定** | サイドバー歯車アイコンから開くモーダル。ユーザーID・パスワード・TOTP・秘密の質問を変更できる。<br>`apps/server/src/routes/auth.ts` · `apps/web/features/settings/` |
| 🔑 **パスワードリセット** | 秘密の質問で本人確認しパスワードをリセット。ログイン画面の「パスワードをお忘れですか？」から遷移。<br>`apps/server/src/routes/auth.ts` · `apps/web/app/auth/reset-password/` |
| 🛡️ **パスワード強度チェック** | 8文字以上・英字・数字・記号の必須バリデーション。NordPass 2024年版上位200弱パスワードをブロック。<br>`apps/server/src/utils/blockedPasswords.ts` · `apps/web/lib/passwordValidation.ts` |
| 🔔 **受信ボックス・通知機能** | 画面右上のベルアイコン（通知ドロップダウン）と受信ボックスアイコン。新着通知（他チャンネルの発言・DM・メンション・警告）・未読バッジ・Web Audio API 通知音。<br>`apps/web/features/notifications/` |
| 📎 **ファイル・画像添付** | チャンネルで画像（10MBまで）・動画（100MBまで）を最大5件添付して投稿。入力欄の「＋」メニューから「ファイルをアップロード」を選択。アップロード後にプレビュー表示。<br>`apps/web/features/fileUpload/` · `apps/server/src/routes/messages.ts` |
| 👆 **パスキー（指紋認証）** | Touch ID などの生体認証による2段階認証。複数登録・論理削除に対応。<br>`apps/server/src/features/passkey/` · `apps/web/features/passkey/` |
| 🛡️ **2段階認証の強化** | 認証アプリとパスキーの「両方必須」切替、失敗5回で15分ロック、リカバリーコード。<br>`apps/server/src/features/mfa/` · `apps/web/features/mfa/` |
| 🔗 **招待リンク・コード管理** | owner がサイドバーの「管理」から招待リンク・コードをコピー／再生成。未ログインでリンクを開いてもログイン後に参加ページへ戻る。<br>`apps/web/features/invite/` · `apps/web/app/invite/[code]/` · `apps/web/lib/safeNext.ts` |
| 📺 **チャンネル作成・参加** | サイドバーの「+」から公開／非公開チャンネルを作成。未参加の公開チャンネルは「参加する」ボタンで入れる（キック解除後の入り直しにも使う）。<br>`apps/web/features/channels/` |
| 🚨 **警告とキック** | owner が警告を記録し、3回で（または重大違反の場合は警告なしで）手動でキックできる。再参加はブロックされ、owner が解除できる。<br>`apps/server/src/features/moderation/` · `apps/web/features/moderation/` |

### 🔐 TOTP 2段階認証の詳細

> [!NOTE]
> Google Authenticator・Authy・Microsoft Authenticator（iOS / Android 両対応）で利用できます。

**有効化の流れ**
1. サイドバー下部の歯車アイコン → 設定 → ワンタイムパスワードのトグルをONにする
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

### 👆 パスキーと2段階認証の強化の詳細

> [!NOTE]
> Mac の Touch ID で動作確認済みです。Windows Hello など他の環境は未検証です。
> 開発時は `http://localhost:3000` で開いてください（`127.0.0.1` では `WEBAUTHN_ORIGIN` と一致せず失敗します）。

**パスキーの登録**
1. 設定 → 「パスキー（指紋認証）」→「追加する」
2. 名前（任意）を入力して「パスキーを登録」→ 指紋認証を行う
3. 紛失に備え、複数の端末に登録しておくことを推奨

**認証方法の切り替え**（設定 → 「ログイン時の認証方法」。パスワード確認が必要）

| モード | ログイン時 |
|---|---|
| どちらか一方（既定） | 認証アプリ・パスキーのどちらか1つで認証 |
| 両方必須 | 認証アプリとパスキーの両方を完了して認証。TOTP・パスキー・リカバリーコードがすべて揃っている場合のみ切り替え可能 |

**リカバリーコード**
- 認証アプリやパスキーが使えないときの予備。8個を発行し、使い捨て。
- 平文は発行時の1回だけ表示。DB には bcrypt ハッシュで保存。再発行すると旧コードはすべて無効。
- ログイン画面の「リカバリーコードを使う」から入力（パスワード認証は通過済みであることが前提）。

**ロック**
- 2段階認証（TOTP・パスキー・リカバリーコード）の失敗が5回に達すると、15分間ロック。

> [!WARNING]
> リカバリーコードは再表示できません。安全な場所に保管してください。
> 「両方必須」の間は、TOTP の無効化とパスキーの削除はできません（先に「どちらか一方」へ切り替えます）。

**関連ファイル**

```
apps/server/src/
  db/migrations/
    004_passkeys.sql                  # passkeys テーブル（論理削除: deleted_at）
    005_mfa_settings.sql              # users に mfa_mode 等、recovery_codes テーブル
  features/passkey/
    passkeyService.ts                 # WebAuthn のオプション生成・検証、チャレンジ管理
    passkeyRouter.ts                  # /api/passkey
  features/mfa/
    mfaService.ts                     # 失敗ロック・リカバリーコードの生成と照合
    mfaFlow.ts                        # pending_token の管理・手段ごとの完了判定
    mfaRouter.ts                      # /api/mfa
    loginLimiter.ts                   # ユーザー名+IP のログイン失敗制限

apps/web/features/
  passkey/PasskeyVerifyStep.tsx       # ログイン時のパスキー認証
  passkey/PasskeySettings.tsx         # 設定: 登録・一覧・削除
  mfa/MfaStep.tsx                     # ログイン時の認証手段の選択・「両方必須」の進行
  mfa/RecoveryCodeStep.tsx            # ログイン時のリカバリーコード入力
  mfa/MfaSettings.tsx                 # 設定: 認証モード切替・リカバリーコード発行
```

### 🚨 警告とキックの詳細

> [!NOTE]
> 警告・キックは**すべて owner の手動操作**です。メッセージ内容の自動判定や自動キックはありません。
> 発言を制限する「ミュート」は実装していません（Slack と同様、最終手段はキックです）。

**運用ルール**

| 状況 | できること |
|---|---|
| 警告 1〜2回目 | 本人に通知（理由つき）。2回目は次がキック対象になることを伝える |
| 警告 3回目 | キックできるようになる（自動ではキックされない）。回数は `KICK_WARNING_THRESHOLD` で変更可 |
| 人格否定などの重大違反 | 「重大違反」にチェックし理由を記録すれば、警告なしでキックできる |
| キック後 | 招待コードを入力しても再参加できない。owner が「キック解除」したときだけ再参加できる |

- キックはメンバーの論理削除です。過去のメッセージは残ります。
- 解除後、チャンネルへは入り直しです（キック前の所属は自動では戻りません）。公開チャンネルは「参加する」で戻れます。**プライベートチャンネルは、招待されるまで戻れません**（「招待された人だけ」という約束を、キック後も守るためです）。
- キックを同時に押されても、対象の行をロックして判定するため、二重にキックされたり、通知が二重に出たりしません。
- 警告の取り消し（`revoked_at`）は DB には用意していますが、画面からの操作は未実装です。

> [!WARNING]
> `008_moderation.sql` は既存の DB には自動で適用されません。`raisechat_admin` で手動実行してください。
> **デプロイの順序: ① `008` を適用 → ② アプリをデプロイ**。適用前に新しいサーバーを動かすと、`removed_at` が無いため各 API がエラーになります。

**関連ファイル**

```
apps/server/src/
  db/migrations/008_moderation.sql    # member_warnings、workspace_members / channel_members の removed_at
  features/moderation/
    moderationService.ts              # 警告回数の集計、キック条件（KICK_WARNING_THRESHOLD = 3）
    moderationRouter.ts               # /api/workspaces/:wid/members の warn・kick・unkick など

apps/web/
  features/invite/InvitePanel.tsx             # 招待リンク・コードの表示、コピー、再生成
  features/moderation/AdminModal.tsx          # 「管理」モーダル（招待／メンバー管理）
  features/moderation/MemberModerationPanel.tsx  # 警告・キック・キック解除
  features/moderation/useModerationEvents.ts  # member:warned / member:kicked の受信
  app/invite/[code]/page.tsx                  # 招待リンクから参加
  lib/safeNext.ts                             # ログイン後の戻り先（招待ページのみ許可）
```

## ライセンス

[MIT License](./LICENSE)
