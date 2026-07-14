# dig Architecture

## 目的

digは、Curiosityが建築・インテリアCG人材を発見、評価、比較し、人が採用判断するための社内プラットフォームである。AIは検索条件の構造化、作品評価、候補ランキング、文面下書きを補助する。

## システム構成

```text
Browser
  -> Next.js App Router / Vercel
      -> Supabase Auth (session verification)
      -> Supabase PostgreSQL (RLS)
      -> Supabase Storage (private candidate-images)
      -> OpenAI Responses API (server-only, selected public fields only)
      -> Vercel Cron (CRON_SECRET)
```

## 境界

- UI: Server Componentsを既定とし、比較・コピー・入力など必要箇所だけClient Componentにする。
- 認証: `requireUser()`をServer Component、Server Action、Route Handlerで再検証する。Proxyだけを認可境界にしない。
- DB: 通常操作はユーザーセッションとRLS、CronだけSupabase secret keyを使う。
- AI: OpenAI clientはサーバーモジュール内で遅延初期化する。
- Discovery: 外部候補は必ずInboxを経由し、人の承認後だけ`candidates`へ登録する。

## Phase 3 データフロー

```text
自然言語要件 (最大1,200文字)
  -> 認証・アプリ内レート制限
  -> Prompt Injectionをデータとして隔離
  -> OpenAI JSON Schema: structured_filters
  -> Supabaseで構造化フィルター・上限付き抽出
  -> 上位20件以下の公開職務情報だけをOpenAIへ送信
  -> JSON Schema: ranked_candidates
  -> scout_runs / scout_resultsへ保存
  -> ランキング、比較、文面生成UI
```

OpenAIへ送る候補情報は、候補者ID、公開プロフィール、職種、地域、スキル、言語、選考状態、AI総合点、8軸、公開作品の説明、強み、懸念、推奨案件に限定する。メール、電話、社内メモ、`created_by`等の内部識別情報は送らない。

## データモデル方針

- `scout_searches`: 保存済み検索。作成者が所有する。
- `scout_runs`: 実行単位。自然言語、構造化条件、状態、件数、モデル、エラー概要を保持する。
- `scout_results`: 候補者ごとの順位、Scout適合点、根拠、強み、懸念、案件、質問を保持する。
- AI Scout適合点は要件相対の指標であり、候補者の既存AI総合点と混同しない。

## 非機能要件

- 1回の候補抽出は最大50件、OpenAI再ランキングは最大20件、表示は最大10件。
- APIはユーザー単位で短時間の回数制限を行う。
- AIエラー時は途中runを`failed`にし、秘密値を含まない利用者向けメッセージを返す。
- 全結果に「判断材料」「自動不採用禁止」を表示する。
