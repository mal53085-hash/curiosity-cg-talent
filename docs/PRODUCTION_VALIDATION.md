# Production Validation

対象: `https://dig-mal1956.vercel.app`  
Supabase project: `vrfsaasawsgwxzgsnatk`

## 実施原則

- 本番で実施した確認だけを`本番検証`画面へ記録する。
- ステータスは未実施、成功、失敗、再確認必要のいずれかを選ぶ。
- 証跡には時刻、画面/API、HTTP status、run IDなどを記録し、APIキー、Bearer token、Cookie、個人連絡先を書かない。
- 失敗を成功で上書きせず、再実行ごとに履歴を追加する。
- 実候補者が少ない場合、機能動作確認と検索精度評価を分ける。

## 事前条件

- Vercel Productionに`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`、`OPENAI_API_KEY`、`SUPABASE_SECRET_KEY`、`CRON_SECRET`が設定されている。
- `OPENAI_API_KEY`は既存Production値を再利用し、新規キーを作成・取得・表示・リポジトリ保存しない。
- Supabase migrationsが最新で、全Phase 4.5テーブルのRLSが有効。
- `candidate-portfolio-images`がprivate、8MB、JPEG/PNG/WebP制限である。
- 本番ログの秘密情報検査は値そのものではなく、`sk-`、`sb_secret_`、`Bearer`等の安全なパターンで行う。

## チェック項目と証跡

| 項目 | 成功条件 | 証跡例 |
|---|---|---|
| 認証済み画像アップロード | ログイン時のみ許可、WebP保存、EXIF除去 | image ID、時刻 |
| 実画像Visual Search | 1〜5枚でrun成功、最大10結果 | visual run ID |
| AI Scout 3名比較 | DBに3名以上あるとき比較可能 | scout run ID |
| Visual Search 3名以上比較 | 結果3名以上のとき表示可能 | visual run ID |
| 429レート制限 | 上限超過で安全な429表示 | endpoint、時刻 |
| OpenAI 503処理 | 秘密値/内部エラーを出さず再試行案内 | HTTP status、画面文言 |
| Storage期限切れCron | 期限切れ画像・派生データ・quarantine削除 | cron時刻、削除件数 |
| 削除時Storage連動 | 候補/検索削除でStorage objectも消える | resource ID |
| 監査ログ | 取込、権利変更、AI、削除、検証を記録 | audit event ID/type |
| Vercel秘密情報ログ | 秘密パターンがログにない | 確認期間 |
| モバイル表示 | 390pxで横溢れなし、主要操作可能 | screenshot/時刻 |
| CSVエラー処理 | 不正列/URL/101件を登録せず表示 | batch/テスト名 |
| URL一括登録 | プレビュー後に新規だけInbox登録 | batch ID |
| 重複処理 | batch/Discovery/candidate重複を区別 | duplicate count |

## セキュリティ異常系

- 未認証で`/acquisition`、`/calibration`、`/search-quality`、`/production-validation`へアクセスし、`/login`へ遷移する。
- APIへOriginなし/別OriginでPOSTし403を確認する。
- localhost、RFC1918、link-local、`169.254.169.254`、認証情報付きURLを拒否する。
- SVG、偽装MIME、破損画像、8MB超過を拒否し、quarantine/最終bucketに残らないことを確認する。
- `unknown`または`link_only`画像をAI選択/評価し、422と不足理由が表示されることを確認する。
- 候補者削除後にDB行だけでなくStorage objectがないことを確認する。

## Advisor

- Security AdvisorのERROR/WARNを確認する。Phase 4.5適用直後の重大指摘は0。
- Advisor APIが`Leaked Password Protection Disabled`を返す場合、Authentication > Attack Protectionでproject refを再確認する。これはDashboard/Auth設定でありコード修正対象ではない。
- Performance Advisorのunindexed foreign keyはPhase 4.5 advisor index migrationで解消する。未使用index INFOはデータが少ない初期状態では予想されるため、実運用統計後に再評価する。

## 精度ゲート

- 20名未満: 機能検証のみ。PrecisionやVisual類似検索の精度を「確認済み」と記録しない。
- 20〜49名: 初期精度評価。最低5 Scoutテストと複数のVisual検索を実行する。
- 50名以上: rubric versionを固定した改善サイクルを開始し、Precision、人間差、順位安定性を継続比較する。
