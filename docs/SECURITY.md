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
- v0.4.6のReference Privacy Modeは企業向け標準として常時ONで、無効化UI・画像保存経路を持たない。
- ブラウザで実形式確認、画像デコード、最大辺縮小、WebP再エンコードを行いEXIFを除去する。Vercelの4.5MB本文上限を超えない解析用データを1枚ずつ送る。サーバーでもmagic bytesとSharp decodeを再検証する。
- 解析用画像はメモリ内だけでOpenAIへ送り、特徴量保存後または失敗時に入力・正規化バッファをゼロ化する。Supabase Storage、サムネイル、キャッシュ画像、EXIF、公開URL、サーバー一時ファイルを作成しない。
- 保存対象はLighting / Composition / Material / Brand Tone / Space Type / Camera Characteristics / 16次元AI Feature Vector / Processing Timestamp / Processing Model Versionだけ。検索削除または30日Cronで派生特徴量と結果を削除する。
- `visual_reference.discarded`監査イベントに特徴量ID、処理日時、model、`source_retained=false`、`storage_object_created=false`、破棄方式を残す。画像、ファイル名、hash、URLは監査ログへ残さない。
- OpenAI Responses APIは`store:false`を指定する。アプリケーションで元画像を復元する手段はない。OpenAI側の保持条件は契約・Zero Data Retention適格性を別途管理確認する。
- ユーザー単位10分3回、1日上限は`VISUAL_SEARCH_DAILY_LIMIT`（既定10）、候補再評価20名、結果10名。
- OpenAIには参考画像、検索条件、候補者UUID、公開プロフィール、スキル/ソフト、既存の画像ベース8軸評価、強み/懸念/推奨案件だけを送る。メール、電話、住所、社内メモ、認証IDは送らない。
- 人物特定、顔認識、センシティブ属性推定、自動不採用を禁止し、Structured OutputsをZod検証する。

## Candidate Acquisition / 作品画像境界

- URL一括とCSVは1回100件まで。登録前に対応、未対応、重複、新規、保存予定項目を表示し、人の確認後だけDiscovery Inboxへ登録する。
- CSVのメール、電話、住所列はマッピング対象外で、`raw_input`にも保存しない。
- LinkedInはURL、手入力、CSVだけを扱い、本文・検索結果の自動大量取得を行わない。
- サーバーが外部URLへ接続する経路はDNS解決後もprivate IP、localhost、link-local、metadata endpointを拒否し、最大2 redirect、7秒、HTML 512KB、画像8MBを上限とする。
- 公開画像URLは`link_only`で参照するだけとし、全画像の自動コピーを行わない。保存コピーは利用者が許可根拠を記録してアップロードする。
- `unknown`と`link_only`はDB eligibility、AI Route Handler、UIの3層でOpenAI送信対象外にする。
- `candidate-portfolio-images`はprivate bucket。8MB、JPEG/PNG/WebP、ユーザーフォルダupload、認証済みread/delete policyを適用する。
- 候補者削除時はStorage APIでlegacy画像と作品画像を先に削除し、その後DB行を削除する。Discovery候補の画像削除も同じ順序にする。
- 評価基準は外部テキストではなく内部versionデータだが、プロンプト内ではデータとして隔離し、system instructionを上書きできないようにする。

## 運用確認

- Vercelログを`CRON_SECRET`、`SUPABASE_SECRET_KEY`、`OPENAI_API_KEY`、`Bearer`、`sk-`、`sb_secret_`のパターンで確認する。
- Supabase Security/Performance Advisorをmigration適用後とリリース前に確認する。
- 2026-07-14のv0.4.6 migration適用後もSecurity Advisorの重大指摘は0。最新Advisor APIは`Leaked Password Protection Disabled`警告を返す一方、Dashboardでは有効化・再デプロイ済みとの申告がある。Authentication > Attack Protectionで対象project ref `vrfsaasawsgwxzgsnatk`、設定ON、保存完了を手動確認し、数分後にAdvisorを再実行する。これはDashboard/Auth設定の反映状態であり、アプリコードやv0.4.6 migrationの問題ではなく、実装をブロックしない。
