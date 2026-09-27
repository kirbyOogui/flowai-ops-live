# FlowAI OPS（本物版）

**Gmail・Slack・Webフォームに届いた業務依頼を AI が読み取り、要約・カテゴリ・重要度・担当者・期限・次のアクション・返信案まで決めて仕事として登録する** AI オペレーション管理ツールです。外部への返信だけは、人が確認してから実際に送信します。

- 架空の企業「NEXORA株式会社」の社内ツールという設定です。
- **この版は外部サービスと実際に連携しています。** Gmail で受信したメールや Slack の投稿を取り込み、返信も Gmail・Slack から実際に送ります。
- 誰でも操作できるサンドボックス版（受信と送信はシミュレーション）は、別リポジトリの「FlowAI OPS デモ版」です。

## 画面と公開範囲

| パス | 対象 | 内容 |
| --- | --- | --- |
| `/` | 誰でも | サービス紹介 |
| `/form` | 誰でも | 公開の依頼フォーム。送信すると AI の分析の様子をその場で表示し、受付部署・重要度・期限を返す |
| `/login` | オーナー | パスワードでログイン |
| `/app` | オーナーのみ | ダッシュボード（ホーム・受信箱・仕事一覧・メンバー・分析・連携） |

実際のメールや Slack の内容を扱うため、ダッシュボードはオーナーだけが操作できます。

## 主な機能

- **3 つの受付窓口**
  - **Gmail**：Gmail API で受信（Pub/Sub のプッシュ通知でリアルタイム、または定期・手動の同期）。返信は元のメールと同じスレッドに送る
  - **Slack**：Events API で指定チャンネルの投稿を受信。返信は元の投稿のスレッドに送る
  - **Webフォーム**：誰でも送れる公開フォーム。返信は入力されたメールアドレスへ Gmail から送る
- **AI 分析**：OpenAI Responses API + Structured Outputs で、要約・カテゴリ・重要度・担当者・期限・次のアクション・返信案を構造化データとして生成する
- **過去の依頼との照合**：「先日の件」のように本文だけでは分からない依頼は、同じ依頼者の過去の依頼から関連する依頼を特定して担当者を引き継ぐ。特定できなければ人に判断を戻す
- **人による確認**：AI の判断はすべて画面で修正できる。確信が持てない担当者判断は「確認待ち」にする。返信は送信前に人が確認・編集する
- **リアルタイム更新**：新着の依頼は数秒で一覧に現れる。AI の分析中・失敗の受信も表示し、失敗したものは再分析できる
- **処理履歴**：受信 → AI の各判断 → 人の操作 → 実際の送信（送信先・日時）をすべて記録する

## アーキテクチャ

```text
Gmail ──(Pub/Sub push / Cron / 手動同期)──┐
Slack ──(Events API, 署名検証)────────────┼─► InboundMessage に保存（外部IDで重複排除）─► すぐ応答
Webフォーム ──(公開API, 回数制限)─────────┘                     │
                                                          after() で非同期実行
                                                                 ▼
                                  AI Pipeline（過去の依頼の照合 → OpenAI → スキーマ検証・業務ルールで補正）
                                                                 ▼
                                             Request / AiAnalysis / ActivityLog に登録
                                                                 ▼
                                      ダッシュボード（5秒ごとに新着を確認）→ 人が確認して返信
                                                                 ▼
                                             Gmail API / Slack chat.postMessage で実際に送信
```

- `src/lib/channels/`：外部サービスとの出入り口（Gmail・Slack・返信の振り分け）
- `src/lib/pipeline/process.ts`：受信の保存と、AI 分析 → 依頼登録
- `src/lib/ai/`：プロンプト・スキーマ・OpenAI 呼び出し・後処理
- `src/lib/services/`：依頼の編集・返信の送信・処理履歴・過去の依頼の検索
- `src/lib/auth/`・`src/proxy.ts`：オーナーのログイン（署名付き Cookie）

### 実運用を想定した設計

- **Webhook はすぐ応答し、AI 分析は後から実行する**：Slack は 3 秒以内に応答しないと再送するため、受信を保存したら 200 を返し、分析は `after()` で行う（Vercel ではレスポンス後に処理が止まるため、`after()` で完了まで実行させる）。
- **二重登録の防止**：受信を `(受付元, 外部ID)` の一意制約付きで保存し、再送や重複通知を無視する。分析中の二重実行も状態の更新で防ぐ。途中で止まった処理は 5 分後に再分析できる。
- **返信の二重送信の防止**：依頼の行をロックしたまま送信し、成功したときだけ「送信済み」にする。
- **セキュリティ**：Slack はリクエストの署名（5 分以内）を検証する。Gmail の通知は秘密のトークンで照合する。Gmail の OAuth トークンは AES-256-GCM で暗号化して DB に保存する。ログインは総当たり対策付き。
- **費用・いたずら対策**：フォームは IP ごとの送信回数を制限し、ボット対策の隠し項目を置く。AI 分析は 1 日の回数に上限を設ける。メルマガや自動送信のメールは取り込まない。
- **公開フォームでの情報の出し方**：送信者には受付部署・重要度・期限だけを返し、AI の要約や担当者名は返さない（過去の依頼との照合結果など、社内の情報が含まれうるため）。

## 技術スタック

Next.js 16（App Router / Route Handlers / `after()`）・React 19・TypeScript・Tailwind CSS v4・shadcn/ui・PostgreSQL・Prisma 7・OpenAI API・Gmail API・Google Cloud Pub/Sub・Slack Events API・jose・Zod・Vercel

## セットアップ

### ローカル

```bash
npm install
cp .env.example .env          # 値を設定する（下記）
docker compose up -d          # PostgreSQL（ホストの 5433 番）
npm run setup                 # マイグレーション + メンバーの登録
npm run dev
```

### 環境変数

`.env.example` に説明付きで一覧があります。主なもの：

| 変数 | 説明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL の接続文字列 |
| `APP_URL` | 公開 URL（OAuth のリダイレクト先に使う） |
| `ADMIN_PASSWORD` / `SESSION_SECRET` / `ENCRYPTION_KEY` | ログインとトークン暗号化の設定（`openssl rand -base64 32` で生成） |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | AI 分析 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail の OAuth クライアント |
| `GMAIL_PUBSUB_TOPIC` / `GMAIL_PUSH_TOKEN` | Gmail のリアルタイム受信（任意） |
| `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET` / `SLACK_CHANNEL_ID` | Slack 連携 |
| `CRON_SECRET` | Vercel Cron の認証 |

### Slack アプリの設定

1. [api.slack.com/apps](https://api.slack.com/apps) で「Create New App → From scratch」。
2. **OAuth & Permissions** の Bot Token Scopes に `channels:history`・`channels:read`・`chat:write`・`users:read` を追加し、ワークスペースにインストールする。**Bot User OAuth Token** を `SLACK_BOT_TOKEN` に設定する。
3. **Basic Information** の **Signing Secret** を `SLACK_SIGNING_SECRET` に設定する。
4. **Event Subscriptions** を有効にし、Request URL を `{APP_URL}/api/webhooks/slack` にして、Bot Events に `message.channels` を追加する。
5. 受付用のチャンネルにボットを招待し、チャンネル ID を `SLACK_CHANNEL_ID` に設定する。

### Gmail の設定

1. Google Cloud でプロジェクトを作り、**Gmail API** を有効にする。
2. **OAuth 同意画面**を作成する（外部・テストユーザーに受付用の Gmail アカウントを追加）。スコープは `gmail.readonly` と `gmail.send`。
   - テスト中の OAuth アプリは、リフレッシュトークンが 7 日で失効します。長く使う場合は公開ステータスを「本番環境」に切り替えてください（未確認のアプリとして警告が出ますが、自分のアカウントでの利用には支障ありません）。
3. **OAuth クライアント ID**（ウェブ アプリケーション）を作成し、承認済みのリダイレクト URI に `{APP_URL}/api/integrations/google/callback` を追加する。ID とシークレットを環境変数に設定する。
4. （任意・リアルタイム受信）**Pub/Sub** でトピックを作成し、`gmail-api-push@system.gserviceaccount.com` に「Pub/Sub パブリッシャー」の権限を付与する。プッシュ型のサブスクリプションのエンドポイントを `{APP_URL}/api/webhooks/gmail?token={GMAIL_PUSH_TOKEN}` にし、トピック名を `GMAIL_PUBSUB_TOPIC` に設定する。
5. ダッシュボードの「連携」から「Gmail を接続」を押し、受付用のアカウントで許可する。

### Vercel で公開する

1. リポジトリを Vercel にインポートする。
2. Storage から Neon（Postgres）を追加すると、`DATABASE_URL` が自動で設定される。
3. 上記の環境変数を設定してデプロイする。ビルド時に `prisma migrate deploy` が実行される。
4. `vercel.json` の Cron（1 日 1 回）で、Gmail の通知の登録を更新し、取りこぼしを同期する。
