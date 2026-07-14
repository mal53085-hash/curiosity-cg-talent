# dig Release Notes

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
