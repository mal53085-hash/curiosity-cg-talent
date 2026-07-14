# dig Architecture

## v0.5.0 Simple hiring layer

`/dashboard`、`/candidates`、`/add-candidates`、`/hiring-pipeline`を日本採用の主導線とする。`/advanced`は既存のScout、Visual Search、Discovery、Acquisition、Data Quality、Evaluation、Validationへの索引であり、既存URLとデータモデルを変更しない。

`candidates.hiring_pipeline_stage`は新しい操作列、旧`candidates.status`はAdvanced互換列として併存する。状態変更Server Actionは両方を同期し、migrationは旧statusを一度だけ新Pipelineへ写像する。Japan Readinessは値と`readiness_verification` JSONBのprovenanceを分ける。`user_preferences`はユーザー自身のSimple/Advanced設定、`candidate_interactions`は接触・返信・面談・状態変更の追記履歴を持つ。

Contact PriorityはOpenAIの単一出力ではなく、CG Fit 40%、Japan Readiness最大30点、確認度最大15点、案件適性5点、接触状況最大10点をルールベースで合成する。ClosedまたはBlockedは優先度0にするが、自動見送りはせず人間確認の次アクションを返す。

## 目的

digは、Curiosityが建築・インテリアCG人材を発見、評価、比較し、人が採用判断するための社内プラットフォームである。AIは検索条件の構造化、作品評価、候補ランキング、文面下書きを補助する。

## システム構成

```text
Browser
  -> Next.js App Router / Vercel
      -> Supabase Auth (session verification)
      -> Supabase PostgreSQL (RLS)
      -> Supabase Storage (private candidate-images / candidate-portfolio-images; Visual Search references are never stored)
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

## Phase 3.5 / Phase 4 データフロー

候補者の14分類を重み付きで集計し、`data_quality_score`と不足項目をDB triggerで更新する。Scoutテストは想定上位候補、実順位、Precision@3/5、Scout versionを保存し、候補者20名未満を必ず`insufficient`とする。

```text
権利確認 + 参考画像1〜5枚
  -> browser memory: magic bytes + decode + WebP再エンコード（EXIF除去、1枚ずつ送信）
  -> server memory: magic bytes + Sharp decode
  -> OpenAI Responses API (store:false) で構造化視覚特徴を抽出
  -> raw/normalized bufferを即時ゼロ化、Storage objectは作成しない
  -> visual_search_imagesへ特徴表現・vector・処理model/日時だけを保存
  -> 保存特徴量だけで全候補を事前順位化
  -> 上位20名以下の既存画像ベース8軸評価・公開職務情報だけを再ランキング
  -> 最大10名をvisual_search_resultsへ保存
```

`visual_searches`削除時は外部キー削除連動で特徴量/run/result行を削除する。日次Cronも期限切れの派生データを削除し、`audit_events`へ件数だけを残す。画像復元・再ダウンロード・署名URL生成の経路は存在しない。旧`visual-search-*` bucketは空の互換資産で、v0.4.6 migrationが所有者Storage policyを削除するため新規uploadには使えない。

## v0.4.7 Reference Analysis / Style Profile

`/visual-search/[id]`は、所有者の保存済み特徴量をServer Componentで取得し、実測数値と記述カバレッジだけから12指標とスタイル要約を構成する。品質値が存在しないLighting / Composition / Material / Colorは特徴記述のカバレッジとして明示し、未確認能力を補完しない。

`style_profiles`は人が承認した名前・説明・active/archive状態、`style_profile_versions`は不変の派生特徴・vector・weights・model versionを保持する。Visual SearchはProfileから特徴レコードを複製して再ランキングでき、AI Scoutは自然言語条件とProfile特徴を上位20名の再評価時だけ組み合わせる。候補者詳細のProfile適合点は既存`visual_search_results`を参照し、別の重複結果テーブルを作らない。

```text
保存済みvisual_search_images（特徴量のみ）
  -> 管理者が明示保存
  -> style_profiles / style_profile_versions
  -> Visual Search再ランキング または AI Scout条件
  -> visual_search_results / scout_results
```

## 非機能要件

- 1回の候補抽出は最大50件、OpenAI再ランキングは最大20件、表示は最大10件。
- APIはユーザー単位で短時間の回数制限を行う。
- AIエラー時は途中runを`failed`にし、秘密値を含まない利用者向けメッセージを返す。
- 全結果に「判断材料」「自動不採用禁止」を表示する。

## Phase 4.5 Candidate Acquisitionデータフロー

```text
URL（最大100）/ CSV（最大100）/ 手動公開情報
  -> 構文・private host・列・件数検証
  -> 対応 / 未対応 / 重複 / 新規をプレビュー
  -> 人間の一括確認
  -> acquisition_batches / acquisition_batch_items
  -> discovery_items (Research Queue)
  -> 公開情報・出典・確認日時を人が補完
  -> 作品画像をリンク参照、または許可済みコピーとして登録
  -> AI Review Eligibility
  -> 人が承認した場合だけcandidatesへ移行
```

- `candidate_portfolio_images`は候補者またはDiscovery候補のどちらか一方を親とし、`image_order` 1〜12の一意制約で最大12枚にする。
- 公開URL画像は`link_only`として記録し、サーバーは自動保存しない。アップロードはmagic bytes、Sharp decode、WebP再エンコードを通し、EXIFを除去する。
- AI本評価・仮評価は、`selected_for_ai_review=true`かつ`review_copy_authorized`または`internal_reference_authorized`のprivate Storage画像だけを読む。
- `evaluation_rubric_versions`は追記型で、AI評価結果に当時のversion IDを保存する。
- `human_candidate_reviews`はAIスナップショット、人間の12軸、平均絶対差、抽出理由を保存する。
- `validation_checklist_runs`は本番検証を履歴として追記し、過去の失敗や再確認を上書きしない。
