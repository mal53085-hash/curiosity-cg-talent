# dig

Curiosityの建築・インテリアCG人材を世界中から発見、評価、管理する採用管理Webアプリです。

Phase 1では、Supabase Authによる実認証、候補者CRUD、検索・フィルター、ギャラリー/テーブル表示、非公開画像アップロード、選考ステータス、AI評価表示UIを実装しています。

## 技術スタック

- Next.js 16 App Router / React 19 / TypeScript
- Tailwind CSS 4
- Supabase Auth / PostgreSQL / Storage
- Vercel
- OpenAI Responses API（画像とプロフィールによる構造化AI評価）

## 主な機能

- 英語のログイン画面と、招待されたユーザーのみ利用できるSupabase Auth
- 日本語のレスポンシブ管理画面
- 候補者ダッシュボードと選考パイプライン集計
- 候補者一覧のギャラリー/テーブル切り替え
- 氏名、専門領域、地域の検索
- ステータス、評価、国・地域のフィルター
- 候補者の追加、編集、削除
- 候補者画像の非公開Storage保存と期限付きURL表示
- AIによる8軸採点、採点理由、強み、懸念点、推奨案件、面談質問の保存・表示
- PostgreSQL RLSとServer Action内の認証再検証

## ローカルセットアップ

### 1. 必要環境

- Node.js 20.9以上
- npm
- Supabaseアカウントとプロジェクト
- ローカルSupabaseを使う場合はDocker Desktop

### 2. 依存関係をインストール

```bash
npm install
```

### 3. Supabaseプロジェクトを作成

1. [Supabase Dashboard](https://supabase.com/dashboard) で新規プロジェクトを作成します。
2. AuthenticationのEmail/Password認証を有効にします。
3. このアプリにはサインアップ画面がないため、Authentication > Usersから管理者が利用者を作成または招待します。
4. 不特定ユーザーの登録を防ぐため、本番では公開サインアップを無効にしてください。

#### 初期管理者ユーザーの作成

1. Supabase Dashboardで対象プロジェクトを開き、Authentication > Usersへ移動します。
2. `Add user`から、次のいずれかを選びます。
   - `Create new user`: 管理者メールアドレスと十分に強い一時パスワードを入力し、メールを確認済みにします。
   - `Send invitation`: 管理者メールアドレスへ招待を送り、受信者がリンクからパスワードを設定します。
3. Authentication > URL Configurationで、Vercelの本番URLをSite URLに設定します。招待を使う場合は本番URLと`/auth/callback`をRedirect URLsにも登録します。
4. Authentication > Sign In / Providers > Emailで`Allow new users to sign up`を無効にし、管理者が作成・招待したユーザーだけがログインできる状態にします。
5. Vercel本番の`/login`からメールアドレスとパスワードでログインし、`/dashboard`へ遷移することを確認します。

このPhaseでは全Authユーザーを共有ワークスペースの管理者として扱います。役割分離が必要になった時点で、`app_metadata`を使った権限とRLSを追加してください。`user_metadata`を認可には使用しません。

### 4. データベースとStorageを作成

Supabase CLIでプロジェクトに接続し、コミット済みのマイグレーションを適用します。

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

マイグレーションは [`supabase/migrations/20260714025650_initial_dig_schema.sql`](supabase/migrations/20260714025650_initial_dig_schema.sql) にあります。次を一括で作成します。

- `candidates` テーブル、enum、index、更新監査trigger
- 認証済みワークスペースメンバー向けRLS policy
- `candidate-images` 非公開Storage bucket
- 画像取得・アップロード・削除用Storage policy
- Data API向けの明示的な権限

ローカルSupabaseを使う場合は、Docker Desktopを起動して次を実行します。

```bash
npx supabase start
npx supabase db reset
```

### 5. 環境変数を設定

`.env.example` を `.env.local` にコピーします。

```bash
cp .env.example .env.local
```

Windows PowerShellの場合:

```powershell
Copy-Item .env.example .env.local
```

Supabase DashboardのConnectダイアログまたはProject Settings > APIから値を取得し、`.env.local` を更新します。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
OPENAI_API_KEY=
```

`service_role` / secret keyはブラウザへ公開しないでください。このアプリは公開可能なpublishable keyとRLSを使用します。

### 6. 開発サーバーを起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開き、手順3で作成したユーザーでログインします。

## 検証

```bash
npm run check
```

このコマンドでESLint、TypeScript型チェック、production buildを順に実行します。

## Vercelへデプロイ

1. GitHubリポジトリをVercelへImportします。
2. Framework PresetがNext.jsになっていることを確認します。
3. Project Settings > Environment Variablesに次を登録します。
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `OPENAI_API_KEY`（Productionのみでも可。必ずサーバー専用の名前のまま登録）
4. Supabase DashboardのAuthentication > URL ConfigurationでVercelの本番URLをSite URLに設定します。
5. Preview Deploymentを使う場合は、必要なPreview URLをRedirect URLsにも追加します。
6. Deploy後、招待ユーザーでログイン、候補者CRUD、画像アップロードを確認します。

## OpenAI AI採点

候補者詳細で「AIで採点」を押すと、認証必須のRoute Handlerが非公開Storageから画像を取得し、プロフィールの職務関連情報とともにOpenAI Responses APIへ送信します。構図、ライティング、マテリアル、高級ブランド適性、インテリア理解、ディテール、仕上げ、技術適応力を各100点で評価し、総合点と説明項目を`candidates`へ保存します。

- `OPENAI_API_KEY`はRoute Handlerからだけ参照し、Client Componentやレスポンスには含めません。
- 候補者のメール、電話、氏名、国・地域、社内メモはAIへ送りません。
- 人物の保護属性を推測・評価しないようプロンプトで制約し、作品品質と職務関連情報だけを対象にします。
- AI結果は参考情報です。採用可否は必ず人が判断してください。

## セキュリティモデル

- Supabase Authユーザーは管理者が作成・招待するワークスペースメンバーです。
- `anon` ロールには候補者テーブルの権限を付与していません。
- `candidates` と `storage.objects` の双方でRLSを有効化しています。
- 候補者画像は非公開bucketに保存し、認証済み画面で1時間のsigned URLを発行します。
- ProxyはUX上のリダイレクトとCookie更新に使い、実際のデータ取得・更新時にもユーザーを再検証します。
- `.env.local` とその他の `.env*` はGit管理対象外です。`.env.example` に秘密情報を入れないでください。

## ディレクトリ構成

```text
src/
  app/
    (workspace)/        # 認証必須の日本語管理画面
    actions/            # Auth / 候補者Server Actions
    auth/callback/      # Supabase PKCE callback
    login/              # 英語ログイン画面
  components/           # 共通UI、候補者UI
  lib/
    candidates/         # validationとdata access
    supabase/           # browser/server/proxy clients
  proxy.ts              # セッション更新とルート保護
supabase/
  migrations/           # PostgreSQL / RLS / Storage migration
```
