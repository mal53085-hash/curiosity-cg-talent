# dig Release Notes

## Unreleased — Phase 3 AI Scout

- 自然言語要件の構造化フィルター変換
- Supabase候補の事前絞り込みとOpenAI再ランキング
- Scout適合点、根拠、比較、保存済み検索
- 日英のLinkedIn短文・メール長文の下書きとコピー
- `scout_searches`、`scout_runs`、`scout_results`と所有者RLS
- ユーザー単位レート制限、入力上限、Prompt Injection拒否、Zod Structured Outputs
- 正常系、Empty State、異常なAI出力、機密フィールド境界の自動テスト

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

- Supabase Security AdvisorのLeaked Password Protection警告はDashboardのAttack Protection設定で解消する。アプリコードのmigrationでは変更しない。
- 未使用indexのPerformance Advisor情報はデータ量が少ない初期段階では削除せず、実利用統計を蓄積して再評価する。
