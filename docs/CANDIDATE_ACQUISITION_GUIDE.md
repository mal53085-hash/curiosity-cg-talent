# Candidate Acquisition Guide

## 目的

この手順は、AI ScoutとVisual Searchを実データで評価するため、公開情報と画像利用条件を追跡しながら候補者を最低20名、推奨50名まで登録するためのものです。URL登録は候補の発見・整理であり、正式候補への自動登録や大量スクレイピングではありません。

## 推奨する登録順序

1. `Acquisition`でURL、CSV、または手動情報を入力する。
2. 件数、対応/未対応、重複、新規、保存予定情報を確認する。
3. 確認チェック後、Discovery Inbox / Research Queueへ仮登録する。
4. 公開ページを人が開き、公開名、地域、スキル、ソフト、言語、契約形態、勤務地希望、公開プロフィールを確認する。
5. 出典と最終確認日時を記録し、Research Statusを更新する。
6. 作品画像をリンク登録するか、利用許可を確認したコピーをアップロードする。
7. DQ60以上かつAI利用許可済み画像を選択し、必要な場合だけAI仮評価を実行する。
8. 人が内容を確認し、正式候補へ承認する。AI点だけで承認・見送りを決めない。

## URL一括登録

- 1行1URL、1回最大100件です。
- Behance、ArtStation、LinkedIn、CGArchitect、個人サイト、会社プロフィールを扱えます。
- LinkedInとBehanceのページ本文は自動取得しません。
- URLは正規化され、追跡パラメータを除去して既存Discovery/正式候補と照合します。
- private IP、localhost、link-local、metadata endpoint、認証情報付きURLは拒否します。
- 未対応/不正URLと重複URLはInboxへ登録しませんが、バッチ結果には記録します。

## CSVインポート

対応列:

```csv
name,source_type,source_url,portfolio_url,region,skills,software,languages,employment_types,work_location_preferences,notes_for_review
Example Artist,artstation,https://example.artstation.com,https://example.artstation.com/projects,United Kingdom,"archviz;lighting","3ds Max;Corona","English","freelance","Tokyo;remote","公開情報の確認が必要"
```

- UTF-8、1MB以下、データ100行までです。
- `name`と`source_url`のマッピングが必須です。
- 読込後に各ヘッダーを対応フィールドへマッピングし、プレビューで行エラーと重複を確認します。
- `email`、`phone`、`telephone`、`address`、`postal_address`は強制的に除外し、バッチのraw dataにも保存しません。
- リスト項目はセミコロン、カンマ、読点で区切れます。

## Research Status

| Status | 運用上の意味 |
|---|---|
| New | 未着手 |
| Reviewing | 公開情報を確認中 |
| Needs More Info | AI/承認に必要な情報が不足 |
| Ready for AI Review | 権利・品質条件を確認しAI仮評価の候補 |
| Ready for Approval | 人が正式候補化を判断できる状態 |
| Approved | 正式候補へ登録済み |
| Rejected | 人が見送りと判断 |
| Duplicate | 人が重複と判断 |

`research_quality_score`と「次に確認」は公開情報の充足度から自動更新されます。担当者と`last_verified_at`を更新し、古い情報を確認済みとして扱わないでください。

## 作品画像と権利

候補者ごとに最大12枚です。

| usage_status | 保存/表示 | OpenAI送信 |
|---|---|---:|
| `link_only` | 外部リンクだけを記録 | 不可 |
| `review_copy_authorized` | 許可根拠付きprivateコピー | 選択時のみ可 |
| `internal_reference_authorized` | 許可根拠付きprivateコピー | 選択時のみ可 |
| `unknown` | privateコピーでも権利未確認 | 不可 |

- 公開URLから全画像を自動保存しません。まず`link_only`で候補画像を人が確認します。
- 許可済みコピーをアップロードするときは出典ページ、確認日、許可根拠を残します。
- 画像はJPEG/PNG/WebP、8MB以下です。実形式を検証し、WebP再エンコードでEXIFを除去します。
- `selected_for_ai_review`は保存済みかつ許可済み画像にだけ設定できます。
- 削除要求があれば作品画像を削除し、必要に応じて候補者/Discovery候補も削除します。

## AI Review Eligibility

正式候補では次をすべて満たす必要があります。

- 公開プロフィールがある。
- `data_quality_score >= 60`。
- 見送り状態ではない。
- 許可済みprivate Storage画像があり、AI評価対象に選択されている。

Discovery仮評価も同じ画像条件とDQ60を要求します。メール、電話、住所、社内メモ、`notes_for_review`はOpenAIへ送りません。

## 20名から50名への運用

- 1〜19名: 機能動作だけを検証し、Precisionや検索精度を断定しない。
- 20〜49名: 5つ以上のScoutテストケースと複数のVisual Searchで初期精度を評価する。
- 50名以上: 高/低得点、AI/人間差、Visual順位の不安定性をReview Samplingで継続確認する。

本番へテスト用候補者を作らないでください。実データでない性能確認はローカル/テスト環境で行い、終了後に削除します。
