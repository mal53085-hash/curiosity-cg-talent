# dig

Curiosityの建築・インテリアCG人材を世界中から発見、評価、管理する採用管理Webアプリです。

Phase 1〜4.5の採用管理・Discovery・AI Scout・Visual Reverse Search・候補者獲得基盤に加え、v0.4.6では企業向けReference Privacy Modeを標準化しています。

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
- Behance / ArtStation / LinkedIn / 個人サイト / 手動候補のソース管理
- URLプレビュー、LinkedIn CSV取り込み、重複排除
- Discovery Inboxでの単件・一括承認、見送り、重複判定
- 検索テーマ、1日あたりの取得上限、Cron実行履歴と失敗ログ
- 公開作品画像と公開説明だけを使うDiscovery AI仮評価
- 自然言語要件から構造化条件へ変換するAI Scout
- DBで最大50件を絞り、上位20件だけをOpenAIで最大10件へ再ランキング
- Scout適合点、適合理由、強み、懸念、推奨案件、面談質問の保存
- 最大3人の比較、保存済み検索、日英スカウト文面のコピー
- データ充足ダッシュボード、候補者品質スコア、確認付き一括補完、Scout評価テスト
- 権利確認付き参考CGのメモリ内解析、視覚特徴分析、Visual Fit Scoreと差異説明
- Reference Privacy Mode常時ON、解析直後の元画像破棄、特徴量のみ30日保持、期限切れCron、利用量・監査記録
- PostgreSQL RLSとServer Action内の認証再検証
- URL最大100件、CSV列マッピング、手動簡易登録を備えたCandidate Acquisition
- 8段階のResearch Queue、担当、確認日時、次に必要な情報、調査品質スコア
- 候補者ごと最大12枚の作品画像、出典・確認日・利用許可・AI選択の管理
- 12軸Curiosity rubricのversion管理、Review Sampling、Search Quality、本番検証チェックリスト

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

マイグレーションは `supabase/migrations/` にあり、ファイル名順に適用されます。次を作成します。

- `candidates` テーブル、enum、index、更新監査trigger
- 認証済みワークスペースメンバー向けRLS policy
- `candidate-images` 非公開Storage bucket
- 画像取得・アップロード・削除用Storage policy
- Data API向けの明示的な権限
- `discovery_sources`、`discovery_items`、`discovery_runs`、`import_jobs`
- source URLと`source_type + external_id`の一意制約、検索用index、監査trigger
- Discoveryテーブルの認証済みワークスペース向けRLS
- `scout_searches`、`scout_runs`、`scout_results`と所有者単位RLS
- AI Scout用の公開プロフィール、契約形態、希望勤務地、確認済み希望年収
- `data_quality_snapshots`、`scout_test_cases`、`scout_test_runs`、`scout_test_expected_results`
- `visual_searches`、`visual_search_images`、`visual_search_runs`、`visual_search_results`、`audit_events`
- Visual Searchの特徴量専用列、所有者RLS、Reference Privacy制約（旧Visual Search bucketはupload policyを廃止）
- `acquisition_batches`、`acquisition_batch_items`、`candidate_portfolio_images`
- `evaluation_rubrics`、`evaluation_rubric_versions`、`human_candidate_reviews`
- `validation_checklists`、`validation_checklist_runs`と全テーブルRLS
- `candidate-portfolio-images`非公開Storage、8MB/MIME制限、Storage policy

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
SUPABASE_SECRET_KEY=
CRON_SECRET=
BRAVE_SEARCH_API_KEY=
BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED=false
VISUAL_SEARCH_DAILY_LIMIT=10
```

`SUPABASE_SECRET_KEY`、`OPENAI_API_KEY`、`CRON_SECRET`、`BRAVE_SEARCH_API_KEY`はサーバー専用です。`NEXT_PUBLIC_`を付けず、ブラウザ、ログ、Gitへ公開しないでください。通常の画面操作はpublishable keyとRLSを使用し、Supabase secret keyはログインユーザーが存在しないCron処理だけで使用します。

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
   - `SUPABASE_SECRET_KEY`（Productionのみ。CronのDB書き込み専用）
   - `CRON_SECRET`（十分に長いランダム値）
   - `BRAVE_SEARCH_API_KEY`（自動探索を使う場合のみ）
   - `BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED=true`（契約プランが検索結果の保存を明示的に許可する場合のみ）
   - `VISUAL_SEARCH_DAILY_LIMIT=10`（ユーザー1日あたり。1〜100で調整）
4. Supabase DashboardのAuthentication > URL ConfigurationでVercelの本番URLをSite URLに設定します。
5. Preview Deploymentを使う場合は、必要なPreview URLをRedirect URLsにも追加します。
6. Deploy後、招待ユーザーでログイン、候補者CRUD、画像アップロードを確認します。

## OpenAI AI採点

候補者詳細で「AIで採点」を押すと、認証必須のRoute Handlerが非公開Storageから利用許可済み・AI選択済み画像だけを取得し、プロフィールの職務関連情報とともにOpenAI Responses APIへ送信します。Curiosityのversion管理された12軸を各100点で評価し、総合点、説明項目、rubric versionを`candidates`へ保存します。

- `OPENAI_API_KEY`はRoute Handlerからだけ参照し、Client Componentやレスポンスには含めません。
- 候補者のメール、電話、住所、氏名、社内メモ、確認メモはAIへ送りません。
- Vercel Productionに設定済みの`OPENAI_API_KEY`をそのままserver-onlyで参照します。新しいキーの発行、取得、表示、Git保存は不要です。
- 人物の保護属性を推測・評価しないようプロンプトで制約し、作品品質と職務関連情報だけを対象にします。
- AI結果は参考情報です。採用可否は必ず人が判断してください。

## Discovery運用

### Behance

Behance検索結果ページのスクレイピングは実装していません。Adobeが採用向けに提供する[Behance Recruiter Pro](https://help.behance.net/hc/en-us/articles/51497046899227-Behance-Recruiter-Pro-Overview)で検索し、確認した公開URLを`Discovery > URL / CSV取り込み`へ登録する方法が標準です。

自動探索は[Brave Search API](https://brave.com/search/api/)を任意で利用します。digは`site:behance.net`等の上限付き検索をAPIへ送り、検索結果ページやBehanceページをクロールしません。Braveは検索結果を保存する利用には保存権を含む契約プランが必要と案内しています。契約を確認するまで`BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED=false`のままにしてください。キーまたは確認フラグがないCron実行は失敗扱いにせず`skipped`として履歴へ保存されます。

### URL取り込み

- LinkedInとBehanceは自動ページ取得を行わず、URLと人が確認した情報を入力します。
- ArtStationと一般Webサイトは、公開IP限定、robots.txt、最大512KB、7秒タイムアウト、最大2回のリダイレクトを通過したHTMLだけからOG情報を候補表示します。
- 取得結果はそのまま正式候補にせず、登録前に修正し、Discovery Inboxで承認します。
- source URLと`source_type + external_id`で重複登録を防止します。

### Phase 4.5 Acquisition

左メニューの`Acquisition`から、URL一括（最大100）、CSV、手動簡易登録を行います。登録前に対応/未対応、重複、新規、保存予定情報を確認し、正式候補ではなくResearch Queueへ送ります。CSVは`name,source_type,source_url,portfolio_url,region,skills,software,languages,employment_types,work_location_preferences,notes_for_review`に対応し、メール、電話、住所列は無視します。

Research Queueで公開情報を確認し、作品画像は公開リンクまたは利用許可済みファイルとして最大12枚管理します。`unknown`と`link_only`はOpenAIへ送信されません。AI本評価/仮評価には、DQ60以上、公開プロフィール、許可済み保存画像、AI選択、非重複・非見送りが必要です。

詳細手順は[`docs/CANDIDATE_ACQUISITION_GUIDE.md`](docs/CANDIDATE_ACQUISITION_GUIDE.md)、評価運用は[`docs/HUMAN_REVIEW_GUIDE.md`](docs/HUMAN_REVIEW_GUIDE.md)、本番確認は[`docs/PRODUCTION_VALIDATION.md`](docs/PRODUCTION_VALIDATION.md)を参照してください。

### LinkedIn CSV（旧Discovery互換）

CSVは最大500データ行、1MBまでです。必須列は`profile_url,name`、任意列は`headline,country,skills,project,stage`です。LinkedInプロフィールの本文や検索結果を自動取得しません。

```csv
profile_url,name,headline,country,skills,project,stage
https://www.linkedin.com/in/example,Example Artist,Senior CG Artist,United Kingdom,"3ds Max;Corona",Luxury Retail,Shortlist
```

### 日次Cron

`vercel.json`は毎日20:00 UTC（日本時間05:00）に`/api/cron/discovery`を起動します。Route Handlerは`Authorization: Bearer $CRON_SECRET`を必須とし、1回最大5テーマ、1テーマ最大20件に制限します。LinkedInと手動ソースは常に自動探索対象外です。実行件数、重複、失敗理由は`discovery_runs`へ保存されます。

同じ`CRON_SECRET`で20:30 UTCに`/api/cron/visual-search-cleanup`を実行し、30日を過ぎた派生特徴量・検索結果を削除します。v0.4.6以降、参考画像はStorageへ作成されません。

## データ品質とVisual Search

`データ品質`では候補者の公開プロフィール、作品画像、スキル、ソフト、言語、地域、契約形態、勤務地希望、AI本評価、8軸等を0〜100で集計します。Reverse Searchの精度評価は最低20名、推奨50名以上です。20名未満のScout/Visual評価は「サンプル不足」と表示します。

`Visual Search`は権利確認済みの参考CGを1〜5枚受け付けます。Reference Privacy Modeは常時ONで無効化できません。8MB以下のJPEG/PNG/WebPをブラウザでmagic bytes確認・デコードし、EXIFを含まない解析用WebPへ変換します。サーバーでも実形式とデコードを再検証し、`store:false`のOpenAI Responses APIで特徴抽出後、入力・解析バッファを直ちに破棄します。Storage、サムネイル、画像キャッシュ、EXIF、公開URL、一時ファイルは作成せず、光・構図・素材・ブランドトーン・空間・カメラ特性・16次元AI特徴ベクトル・処理日時・モデルversionだけを30日保持します。候補者の事前順位化と再評価はこの特徴量だけで行い、上位20名から最大10名を表示します。

### Discovery AI仮評価

Research Queueの「AI仮評価」は、人が許可確認したprivate Storage作品画像、公開説明、職務関連スキルだけをOpenAIへ送ります。氏名、メール、電話、住所、LinkedIn Recruiter項目、確認メモ、社内メモは送信しません。AIによる自動承認・自動不採用は行わず、承認・見送り・重複は必ず人が操作します。承認時はAI評価とrubric version、権利記録付き作品画像を正式候補へ引き継ぎます。

## AI Scout運用

`AI Scout`で案件要件を5〜1,200文字の自然言語で入力します。OpenAIは最初に要件を構造化し、Supabase内の候補だけを絞り込みます。全候補を外部へ送らず、ローカル事前順位の上位20件だけを最大10件へ再ランキングします。

- AI Scout適合点は案件相対、既存AI総合点は作品評価であり、別の指標です。
- 候補者のメール、電話、社内メモ、Auth ID、秘密情報はOpenAIへ送りません。
- スカウト文面は日本語・英語のLinkedIn短文とメール長文を生成しますが、送信機能はなくコピー専用です。
- 検索はユーザー単位で10分5回、文面生成は10分10件までです。
- 入力の命令注入パターンを拒否し、AI出力をJSON SchemaとZodで検証します。
- 結果は判断材料です。自動不採用や採用状態の自動変更は行いません。

設計・運用判断は [`docs/PRODUCT_ROADMAP.md`](docs/PRODUCT_ROADMAP.md)、[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)、[`docs/SECURITY.md`](docs/SECURITY.md)、[`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)を参照してください。

## セキュリティモデル

- Supabase Authユーザーは管理者が作成・招待するワークスペースメンバーです。
- `anon` ロールには候補者テーブルの権限を付与していません。
- `candidates` と `storage.objects` の双方でRLSを有効化しています。
- 候補者画像は非公開bucketに保存し、認証済み画面で1時間のsigned URLを発行します。
- ProxyはUX上のリダイレクトとCookie更新に使い、実際のデータ取得・更新時にもユーザーを再検証します。
- `.env.local` とその他の `.env*` はGit管理対象外です。`.env.example` に秘密情報を入れないでください。
- Cron用Supabase secret keyと検索APIキーはRoute Handler内だけで遅延初期化し、クライアントbundleへ含めません。

## ディレクトリ構成

```text
src/
  app/
    (workspace)/        # 認証必須の日本語管理画面
    actions/            # Auth / 候補者 / Discovery Server Actions
    auth/callback/      # Supabase PKCE callback
    login/              # 英語ログイン画面
  components/           # 共通UI、候補者UI
  lib/
    candidates/         # validationとdata access
    discovery/          # URL安全取得、検索プロバイダー、data access
    scout/              # 構造化フィルター、候補抽出、事前順位
    ai/                 # server-onlyの評価・Scout OpenAI処理
    supabase/           # browser/server/proxy clients
  proxy.ts              # セッション更新とルート保護
supabase/
  migrations/           # PostgreSQL / RLS / Storage migration
```
