# Production Validation

対象: `https://dig-mal1956.vercel.app`  
Supabase project: `vrfsaasawsgwxzgsnatk`

## 実施原則

- 本番で実施した確認だけを`本番検証`画面へ記録する。
- 各カードの実施手順と期待結果を確認し、実結果を入力してから、未実施、成功、失敗、再確認必要のいずれかを選ぶ。
- テストデータ名は`PV-YYYYMMDD-HHMM`とし、対象resource IDを実結果へ記録して終了後に削除する。
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

本番画面に次の15項目について、実施手順、期待結果、実結果、状態、証跡メモを表示・履歴保存する。

1. 候補者・Discovery候補への実画像アップロード
2. JPEG・PNG・WebPの正常登録
3. SVG・偽装MIME・8MB超過の拒否
4. `unknown`／`link_only`画像のAI送信拒否
5. 許可済み実画像によるAI本評価
6. Visual Searchへの実画像アップロードと検索
7. AI Scoutの実検索
8. 候補者・検索削除時のStorage連動削除
9. 期限切れ画像削除Cronの認証付き実行
10. `audit_events`への記録
11. 429レート制限
12. OpenAIエラー時の安全な表示
13. 390pxモバイル表示
14. CSVエラー処理
15. URL一括登録と重複処理

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
