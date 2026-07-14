# dig Security

## セキュリティ原則

- 最小権限、データ最小化、人間による最終判断を既定とする。
- `OPENAI_API_KEY`、`SUPABASE_SECRET_KEY`、`CRON_SECRET`はserver-onlyで、`NEXT_PUBLIC_`を付けない。
- `.env*`は`.env.example`以外Gitへ追加しない。
- Proxyは利便的なリダイレクトに限定し、サーバー処理で毎回ユーザーを検証する。

## RLS

- `public`の全アプリテーブルでRLSを有効化する。
- Scoutの保存検索、run、resultは`created_by = auth.uid()`または親run/searchの所有者一致を必須にする。
- `TO authenticated`だけの無条件ポリシーを新規作成しない。
- 認可に`user_metadata`を使わない。将来のRBACは`app_metadata`または組織メンバーテーブルで行う。

## OpenAIデータ境界

送信可能:

- 公開プロフィール情報、職種、地域、スキル、使用ソフト、言語
- 選考状態、AI総合点、8軸、公開作品説明
- AI評価の強み、懸念、推奨案件
- ランキング出力をDB候補へ安全に照合するための候補者UUID

送信禁止:

- メール、電話、住所
- 社内メモ、Recruiterメモ、非公開コメント
- AuthユーザーID、作成者・更新者の監査ID、APIキー、セッショントークン
- 保護属性の推測や、採用可否の自動判断に不要な個人情報

## AI防御

- 自然言語入力は最大1,200文字、検索名は最大120文字。
- ユーザー入力と候補者公開テキストを命令ではなく引用データとして扱う。
- 外部テキスト内の「前の指示を無視」等を実行しないようsystem instructionを固定する。
- Responses APIのStructured Outputsを使い、さらにZodで検証する。
- DB絞り込み後の上位候補だけを送信する。
- AI Scout適合点は相対評価で、自動見送り・状態変更には使わない。

## レート制限

- `scout_runs`の作成時刻を用い、ユーザー単位で10分あたり5回を上限とする。
- 文面生成は候補者・ユーザー単位で同等の制限を設ける。
- OpenAIやSupabaseのエラー本文をそのままクライアントへ返さない。

## Visual Search画像境界

- 権利または許可を持つという利用者チェックを必須にする。システムは権利を保証しない。
- 1〜5枚、1枚8MB以下、JPEG/PNG/WebPのみ。SVGを禁止し、拡張子や申告MIMEを信用せずmagic bytesとSharp decodeを検証する。
- raw画像は非公開quarantineへ一時送信し、サーバーでWebPへ再エンコードしてEXIF等を除去後、非公開referencesへ保存する。quarantineは成功・失敗時に削除する。
- 画像は既定30日で期限切れ。手動削除と日次CronはStorage APIを使い、画像・派生データを削除する。
- ユーザー単位10分3回、1日上限は`VISUAL_SEARCH_DAILY_LIMIT`（既定10）、候補再評価20名、結果10名。
- OpenAIには参考画像、検索条件、候補者UUID、公開プロフィール、スキル/ソフト、既存の画像ベース8軸評価、強み/懸念/推奨案件だけを送る。メール、電話、住所、社内メモ、認証IDは送らない。
- 人物特定、顔認識、センシティブ属性推定、自動不採用を禁止し、Structured OutputsをZod検証する。

## 運用確認

- Vercelログを`CRON_SECRET`、`SUPABASE_SECRET_KEY`、`OPENAI_API_KEY`、`Bearer`、`sk-`、`sb_secret_`のパターンで確認する。
- Supabase Security/Performance Advisorをmigration適用後とリリース前に確認する。
- 2026-07-14のPhase 4適用後もSecurity Advisorの重大指摘は0。Advisor APIは`Leaked Password Protection Disabled`警告を返す一方、Dashboardでは有効化済みとの申告がある。Authentication > Attack Protectionで対象project ref `vrfsaasawsgwxzgsnatk`、設定ON、保存完了を手動確認し、反映後にAdvisorを再実行する。これはDashboard設定状態であり、Phase 3.5/4のコードやmigrationをブロックしない。
