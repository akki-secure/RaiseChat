# RaiseChat 要件定義書

## 概要

Slack風のリアルタイムチャットWebアプリケーション。  
中規模(20〜200人)のチームや組織向けに、ワークスペース・チャンネルベースのコミュニケーションを提供する。

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 14+ (App Router, TypeScript) |
| バックエンド | Node.js + Express + Socket.io |
| データベース | PostgreSQL |
| ファイルストレージ | AWS S3 |
| 認証 | JWT (bcrypt) |
| インフラ | AWS (ECS Fargate + RDS + S3) + Terraform |

---

## 機能要件

### 1. 認証・ユーザー管理

| 機能 | 詳細 |
|---|---|
| 新規登録 | **ユーザーIDとパスワードのみ**。メールアドレスは不要・入力なし |
| ログイン | JWT発行・httpOnly Cookie保存 |
| ログアウト | トークン無効化 |
| プロフィール設定 | アバター画像(S3)・表示名・ステータス(オンライン/離席中/取り込み中/オフライン) |

### 2. メッセージング

| 機能 | 詳細 |
|---|---|
| テキストチャット | チャンネル内リアルタイムメッセージ |
| ダイレクトメッセージ(DM) | ユーザー間の1対1チャット |
| メッセージ編集 | 送信者本人のみ編集可能。編集済みラベル表示 |
| メッセージ削除 | 送信者本人・管理者が削除可能 |
| スレッド(返信) | メッセージへの返信スレッドを展開表示 |
| マークダウン記法 | Bold・Italic・Code・リスト・コードブロック等に対応 |
| 画像・動画添付 | S3アップロード、プレビュー表示 |
| 絵文字リアクション | メッセージへの絵文字スタンプ、カウント表示 |
| メンション | `@ユーザー名` でメンション、通知を送信 |
| メッセージ検索 | キーワード全文検索(PostgreSQL全文検索) |

### 3. ワークスペース・チャンネル管理

| 機能 | 詳細 |
|---|---|
| ワークスペース作成 | 作成者が自動でオーナー権限を取得 |
| パブリックチャンネル | 全メンバーが参加・閲覧可能 |
| プライベートチャンネル | 招待制。メンバーのみ参加・閲覧可能 |
| チャンネル参加 | パブリックは自由参加。プライベートは招待のみ |

### 4. 管理者(オーナー)権限

| 機能 | 詳細 |
|---|---|
| ユーザー招待 | ワークスペースへの招待リンク生成 |
| ユーザーキック | 強制退出（メッセージは保持） |
| チャンネル管理 | チャンネルの追加・削除・設定変更 |

### 5. 通知

| 機能 | 詳細 |
|---|---|
| 未読メッセージ | チャンネル・DM別に未読件数をバッジ表示 |
| メンション通知 | `@ユーザー名` でのメンション時にブラウザ通知 |

### 6. 対象外機能

- ボイスチャンネル / ビデオ通話

---

## 非機能要件

| 項目 | 要件 |
|---|---|
| リアルタイム性 | WebSocket(Socket.io)によるリアルタイム配信 |
| 同時接続 | 200セッション以上に耐える構成 |
| レスポンス | APIレスポンス 200ms以内（メッセージ送信） |
| セキュリティ | JWT認証・HTTPS必須・SQLインジェクション対策・XSS対策 |
| ファイルサイズ制限 | 画像: 10MB以内、動画: 100MB以内 |

---

## データモデル(概要)

```
users
  id, username, display_name, avatar_url, status, password_hash, created_at
  ※ メールアドレスなし

workspaces
  id, name, owner_id, invite_code, created_at

workspace_members
  workspace_id, user_id, role(owner/member), joined_at

channels
  id, workspace_id, name, type(public/private), created_by, created_at

channel_members
  channel_id, user_id, joined_at, last_read_at

messages
  id, channel_id, user_id, content, parent_id(スレッド用), edited_at, deleted_at, created_at

attachments
  id, message_id, url, type(image/video), size, created_at

reactions
  id, message_id, user_id, emoji, created_at

direct_messages
  id, workspace_id, sender_id, receiver_id, content, read_at, created_at
```

---

## 画面遷移

```
[ログイン / 新規登録]
        ↓
[ワークスペース選択 / 作成]
        ↓
[メインレイアウト]
├── サイドバー
│   ├── チャンネル一覧(パブリック/プライベート)
│   ├── DM一覧
│   └── ユーザー設定
├── メインエリア
│   ├── チャンネルチャット
│   │   └── スレッドパネル(右側)
│   └── DM画面
└── 検索パネル
```

---

## セキュリティ方針

- パスワード: bcrypt (salt rounds 12)
- JWT: httpOnly Cookie保存、有効期限7日
- DBアクセス: アプリ専用ユーザー(最小権限)、rootアカウント不使用
- SQL: パラメータ化クエリ必須(SQLインジェクション対策)
- ファイルアップロード: MIMEタイプ・拡張子チェック
- 機密情報: `.env` 管理、シークレットスキャン実施
- CORS: フロントエンドオリジンのみ許可

---

## Git / ブランチ運用

- `main`: 本番ブランチ（ユーザーが管理、AIの直接pushは禁止）
- `develop`: 開発統合ブランチ
- `feature/*`: 機能ブランチ
- PR経由でmainへマージ

---

## 実装順序

1. バックエンド (Express + PostgreSQL + Socket.io)
   - DB設計・マイグレーション
   - 認証API (ユーザーID + パスワードのみ)
   - メッセージAPI
   - WebSocketハンドラ
2. フロントエンド (Next.js)
   - 認証画面
   - メインレイアウト
   - チャンネルチャット
   - DM・スレッド
3. ガードレール・ログ設計
4. テスト・品質チェック
5. AWS/Terraformデプロイ構成

---

*最終更新: 2026-10-22*
