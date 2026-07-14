alter table public.validation_checklists
  add column if not exists procedure text,
  add column if not exists expected_result text;

alter table public.validation_checklists
  add constraint validation_checklists_procedure_length
  check (procedure is null or char_length(procedure) <= 8000),
  add constraint validation_checklists_expected_result_length
  check (expected_result is null or char_length(expected_result) <= 4000);

alter table public.validation_checklist_runs
  add column if not exists actual_result text;

alter table public.validation_checklist_runs
  add constraint validation_checklist_runs_actual_result_length
  check (actual_result is null or char_length(actual_result) <= 8000);

update public.validation_checklists set is_active = false;

insert into public.validation_checklists
  (code, label, description, procedure, expected_result, sort_order, is_active)
values
  (
    'portfolio_image_upload',
    '候補者・Discovery候補への実画像アップロード',
    '本番データと区別できる識別子 PV-YYYYMMDD-HHMM を使用し、許可のあるテスト画像だけを登録する。',
    E'1. AcquisitionまたはCandidatesで PV-YYYYMMDD-HHMM の候補を1件作成する。\n2. 候補者詳細またはResearch詳細の作品画像管理を開く。\n3. 出典URL、確認日、権利メモを入力し、権利状態を internal_reference_authorized にする。\n4. JPEG画像をアップロードし、表示とStorageパスを確認する。\n5. 検証後、作成した候補と画像を削除する。',
    'アップロードが成功し、非公開Storageに保存され、出典・確認日・権利状態が画面に表示される。本番の既存候補は変更されない。',
    10, true
  ),
  (
    'portfolio_supported_formats',
    'JPEG・PNG・WebPの正常登録',
    '同じテスト候補に3形式を1枚ずつ登録する。個人情報や第三者の無許可画像を使用しない。',
    E'1. JPEG、PNG、WebPの小さなテスト画像を用意する。\n2. 各形式を順にアップロードする。\n3. 各画像のプレビュー、MIME、保存結果を確認する。\n4. 検証後に3画像を削除する。',
    '3形式すべてが登録でき、保存後は安全なWebPへ正規化される。EXIFなどのメタデータは保持されない。',
    20, true
  ),
  (
    'portfolio_invalid_files',
    'SVG・偽装MIME・8MB超過の拒否',
    '拒否テスト専用ファイルを使用し、機密ファイルをアップロードしない。',
    E'1. SVGファイルを選択して拒否を確認する。\n2. 拡張子だけjpgに変更した非画像テキストを選択して拒否を確認する。\n3. 8MBを超えるJPEG/PNGを選択して拒否を確認する。\n4. Storageに対象オブジェクトが作られていないことを確認する。',
    '各ファイルが安全な日本語エラーで拒否され、StorageにもDBにもレコードが残らない。',
    30, true
  ),
  (
    'portfolio_rights_boundary',
    'unknown／link_only画像のAI送信拒否',
    '外部AIへ送らない権利状態を実データで確認する。',
    E'1. テスト候補に unknown と link_only の画像レコードを登録する。\n2. selected_for_ai_reviewを選択してAI評価を試す。\n3. AI Review Eligible表示とAPI応答を確認する。\n4. OpenAI呼び出し前に停止したことを実結果へ記録する。',
    '候補者はNot Eligibleとなり、不足理由に利用許可済み画像がない旨が表示される。OpenAIへの画像送信は発生しない。',
    40, true
  ),
  (
    'authorized_ai_evaluation',
    '許可済み実画像によるAI本評価',
    'internal_reference_authorizedかつselected_for_ai_reviewの画像だけを使用する。',
    E'1. 公開プロフィールとデータ品質60以上のテスト候補を用意する。\n2. internal_reference_authorized画像を選択する。\n3. AI Review Eligibleを確認して本評価を実行する。\n4. 12軸、総合点、理由、rubric versionの保存を確認する。\n5. テスト候補と画像を削除する。',
    '評価が完了し、12軸と評価理由が保存される。連絡先・社内メモ・未許可画像は送信されない。自動不採用は行われない。',
    50, true
  ),
  (
    'real_image_visual_search',
    'Visual Searchへの実画像アップロードと検索',
    '検索名にPV識別子を付け、利用権確認チェックを行う。',
    E'1. Visual Searchで検索名 PV-YYYYMMDD-HHMM を入力する。\n2. 権利確認をチェックし、1〜5枚の参考画像をアップロードする。\n3. 推定利用量を確認して検索を実行する。\n4. run、結果、audit_events、非公開Storage保存を確認する。\n5. 検索を削除し、Storage連動削除を確認する。',
    '検索が安全に完了し、Visual Fit Scoreと説明が表示される。候補者不足時はEmpty Stateまたはサンプル不足として表示される。',
    60, true
  ),
  (
    'ai_scout_search',
    'AI Scoutの実検索',
    'Supabase内の候補者のみを対象にし、連絡先や社内メモを送らない。',
    E'1. AI Scoutで「高級リテールの人工照明と構図が強い候補」と入力する。\n2. 構造化条件を確認して実行する。\n3. 結果、適合理由、Scout適合点を確認する。\n4. 候補者不足時のEmpty Stateも確認する。\n5. 保存したテスト検索を削除する。',
    '認証済みユーザーだけが実行でき、AI総合点とは別のScout適合点が表示される。AIによる採否決定は表示されない。',
    70, true
  ),
  (
    'storage_cascade_delete',
    '候補者・検索削除時のStorage連動削除',
    'PV識別子のテストデータだけを削除し、削除前後のStorageパスを証跡に記録する。',
    E'1. テスト候補画像とVisual Search参考画像のStorageパスを記録する。\n2. それぞれの削除操作を実行する。\n3. DBレコード消失後、同じStorageパスが存在しないことを確認する。\n4. audit_eventsの削除イベントを確認する。',
    'DBレコードと対応するStorageオブジェクトが削除される。既存の本番データは変更されない。',
    80, true
  ),
  (
    'storage_expiry_cron',
    '期限切れ画像削除Cronの認証付き実行',
    'CRON_SECRETは画面・証跡・ログへ記載しない。期限切れにしたPVテスト検索だけを対象にする。',
    E'1. PV識別子のVisual Search画像を作成し、テスト用にexpires_atを期限切れへ設定する。\n2. Vercel CronまたはAuthorization付きGETで /api/cron/visual-search-cleanup を1回実行する。\n3. HTTP 200、削除件数、run/audit記録を確認する。\n4. StorageとDBから対象だけが削除されたことを確認する。',
    '認証なしは401、正しいCron認証は200となり、期限切れの対象だけが削除される。秘密値はログ・証跡に出ない。',
    90, true
  ),
  (
    'audit_log',
    'audit_eventsへの記録',
    'PV操作に対応するイベントだけを時刻・resource_idで照合する。',
    E'1. 画像登録、AI評価、Visual Search、削除、Validation保存を実行する。\n2. audit_eventsで対応するevent_type、actor_id、resource_id、created_atを確認する。\n3. metadataに秘密値・連絡先・画像バイナリがないことを確認する。',
    '各重要操作が追跡でき、metadataにAPIキー、Cookie、Bearer token、個人連絡先が含まれない。',
    100, true
  ),
  (
    'rate_limit_429',
    '429レート制限',
    '本番負荷を避け、実装された最小回数だけ同一ユーザーで連続実行する。',
    E'1. Visual SearchまたはAI Scoutの同じ操作を制限回数まで実行する。\n2. 上限を超える1回だけ追加実行する。\n3. HTTP 429と安全な画面表示を確認する。\n4. Retry-Afterまたは再実行可能時刻を記録する。',
    '上限超過時は429で停止し、OpenAI呼び出しや追加Storage保存を行わず、画面は再試行方法を表示する。',
    110, true
  ),
  (
    'openai_safe_error',
    'OpenAIエラー時の安全な表示',
    '本番のOPENAI_API_KEYを変更・無効化しない。既存の安全な失敗記録または制御されたテスト手段を使用する。',
    E'1. OpenAI障害を安全に再現できるテスト手段がある場合だけ実行する。\n2. 503等の外部障害時に画面がクラッシュしないことを確認する。\n3. API応答、画面メッセージ、保存されたrun statusを確認する。\n4. キーやプロンプト全文が表示・ログ出力されていないことを確認する。',
    '安全な日本語エラーと再試行案内が表示され、部分的な結果を成功扱いしない。秘密値は応答・画面・ログに出ない。',
    120, true
  ),
  (
    'mobile_390',
    '390pxモバイル表示',
    '管理画面の主要導線を390px幅で確認する。',
    E'1. 390×844の表示領域にする。\n2. Production Validation、Acquisition、Research Queue、Visual Search、AI Scoutを開く。\n3. 横スクロール、操作不能なボタン、切れた入力欄がないことを確認する。',
    '主要操作が390px幅で利用でき、意図しない横スクロールがなく、注意文と状態が読める。',
    130, true
  ),
  (
    'csv_error',
    'CSVエラー処理',
    'PV識別子を含む少量CSVを使い、メール・電話・住所を登録しない。',
    E'1. 必須列不足、未知のsource_type、不正URLを含むCSVをプレビューする。\n2. 行ごとのエラーと列マッピングを確認する。\n3. エラー行が登録されないことを確認する。\n4. 正常行を登録した場合はDiscovery Inboxから削除する。',
    'エラー行と理由が登録前に表示され、PII列は取り込み対象にならない。確認なしの一括登録は行われない。',
    140, true
  ),
  (
    'url_bulk_duplicate',
    'URL一括登録と重複処理',
    'PV識別子に紐づく公開URLだけを使い、自動で正式候補者にしない。',
    E'1. 同じURLを表記違いを含めて2回、正常URLを1件入力する。\n2. プレビューで件数、対応サイト、未対応、重複、新規を確認する。\n3. 確認後にDiscovery Inboxへ登録する。\n4. 重複候補がduplicateとして扱われることを確認する。\n5. 作成したInbox項目を削除する。',
    '正規化URLで重複が検出され、新規だけが人間確認後にInboxへ仮登録される。正式候補者への自動登録はない。',
    150, true
  )
on conflict (code) do update set
  label = excluded.label,
  description = excluded.description,
  procedure = excluded.procedure,
  expected_result = excluded.expected_result,
  sort_order = excluded.sort_order,
  is_active = true;
