# dig Release Notes

## 2026-07-14 — Visual Search result experience fix

- Visual Search完了後に`/visual-search/[id]`へ自動遷移
- 保存済み検索から結果再表示、削除、特徴量だけの再実行・複製を追加
- Visual Fit、Brand DNA、Lighting、Composition、Material、Luxury Brand、Display Design、Color Control、Visual Silenceを結果画面に表示
- 候補者0件時に明示的なEmpty StateとDiscovery導線を表示
- v0.4.6 Reference Privacy Modeを維持し、複製・再実行でも画像を保存・再取得しない

## 2026-07-14 — v0.4.6 Reference Privacy Mode

- dig EnterpriseのVisual SearchでReference Privacy Modeを常時ON化
- ブラウザとサーバーの二段階実形式・デコード検証、ブラウザ側WebP変換によるEXIF除去
- 参考画像をSupabase Storageへuploadせず、OpenAI特徴抽出直後にメモリバッファを破棄
- Lighting、Composition、Material、Brand Tone、Space Type、Camera Characteristics、16次元AI Feature Vector、処理日時、model versionだけを保存
- Visual Searchの事前抽出・上位20名再評価を保存特徴量だけで実行
- `store:false`、no-store response、画像preview/thumbnail/cache/public URL/一時ファイルなし
- 破棄成功・失敗、Storage object未作成、特徴量削除を`audit_events`へ記録
- 旧Visual Search Storage所有者policyを削除し、新規reference upload経路を閉鎖

## 2026-07-14 — Production Validation runbook completion

- 本番検証を15項目へ再編し、各項目に実施手順と期待結果を画面表示
- 実結果を検証履歴へ独立保存し、状態・証跡メモ・確認者・確認日時と一緒に管理
- `PV-YYYYMMDD-HHMM`によるテストデータ識別と終了後削除、秘密値を証跡へ残さない注意を画面へ追加

## 2026-07-14 — Phase 4.5 Candidate Acquisition & Production Validation

- URL一括（最大100）、汎用CSV列マッピング・プレビュー・エラー/重複確認、手動簡易登録
- `Acquisition`から自動正式登録せずDiscovery Inbox / Research Queueへ仮登録
- New〜Duplicateの8調査状態、担当、確認日時、調査品質、次に必要な項目
- 候補者/Discovery候補ごとに作品最大12枚、出典、確認日、4段階usage、権利メモ、AI選択を管理
- private `candidate-portfolio-images`、magic bytes、実デコード、WebP再エンコード、EXIF除去、Storage連動削除
- DQ60、公開プロフィール、見送り/重複除外、許可済み保存画像によるAI Review Eligibility
- Curiosity 12軸rubricのversion管理、AI評価へのversion保存、Review SamplingとAI/人間差
- Search Qualityの20/50名ゲート、Precision、人間差、検索別候補数、15項目の本番検証履歴
- Phase 4.5 migration 8テーブル、RLS、private bucket、Storage policy、Advisor indexを本番適用
- 自動テストはCSV 100件、重複、private/metadata URL、unknown画像拒否、50名相当性能を含む15件に合格
- 実候補者は1名のため検索精度は未評価。機能検証と精度評価を分離して継続する

## 2026-07-14 — Phase 3.5 Data Quality / Phase 4 Visual Search

- 10指標のデータ充足ダッシュボードと候補者別0〜100品質スコア
- Candidates / Discovery Inboxの確認付き一括補完
- Scoutテストケース、想定/実順位、Precision@3/5、サンプル状態、version保存
- 権利確認付き参考画像1〜5枚、非公開隔離・保存Storage、30日保持、即時削除
- magic bytes、実デコード、8MB、SVG拒否、WebP再エンコードによるEXIF除去
- 視覚特徴のStructured Outputs、DB事前抽出、上位20名だけ再評価、最大10名表示
- 10分3回、日次上限、利用画像/候補/token記録、期限削除Cron、監査イベント
- 本番DB migration適用済み。RLS 9テーブル、private bucket 2個、Storage所有者policy 4個を確認
- 候補者は1名（品質60点）のため、機能動作とセキュリティ検証のみ。検索精度はサンプル不足で未評価

## 2026-07-14 — Phase 3 AI Scout

- 自然言語要件の構造化フィルター変換
- Supabase候補の事前絞り込みとOpenAI再ランキング
- Scout適合点、根拠、比較、保存済み検索
- 日英のLinkedIn短文・メール長文の下書きとコピー
- `scout_searches`、`scout_runs`、`scout_results`と所有者RLS
- ユーザー単位レート制限、入力上限、Prompt Injection拒否、Zod Structured Outputs
- 正常系、Empty State、異常なAI出力、機密フィールド境界の自動テスト
- 本番で自然言語検索、1件ランキング、比較、保存履歴、日英4種の文面生成を確認
- Prompt Injection入力をHTTP 400で拒否し、利用者向けメッセージを表示
- 390px指定で横方向の溢れなし、モバイルナビゲーションと主要操作を確認
- `lint`、`typecheck`、`build`、`check`、4テスト、`npm audit`（脆弱性0）に合格
- 本番deployment: `a24f935` / Ready

## 2026-07-14 — Phase 2 Discovery

- URL・LinkedIn CSV取り込み、Discovery Inbox、重複判定
- 公開作品による仮AI評価と、承認時の候補者本評価引き継ぎ
- 一括承認・見送り・重複処理
- 上限付き日次Cron、実行履歴、失敗理由表示
- 本番Cron最新確認: `GET 200`
- DB確認: `discovery_runs`へ日時、状態、検出・新規・重複件数を保存
- ログ確認: APIキー、Supabase secret、Cron secretの露出なし

## 2026-07-14 — Phase 1 Recruiting Workspace

- Supabase Auth、候補者CRUD、private Storage
- 検索、フィルター、選考状態、レスポンシブUI
- OpenAIによる8軸作品評価、理由、強み、懸念、推奨案件、面談質問

## 既知の運用課題

- Supabase Security Advisorは重大指摘0。Leaked Password Protectionを有効化済みとの申告後もAdvisor APIが警告を返しているため、Dashboard設定の反映状態を再確認する。これはアプリコードやmigrationの問題ではない。
- 未使用indexのPerformance Advisor情報はデータ量が少ない初期段階では削除せず、実利用統計を蓄積して再評価する。
