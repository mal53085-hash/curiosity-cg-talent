import Link from "next/link";
import { AlertTriangle, CheckCircle2, FlaskConical } from "lucide-react";
import { getDataQualityOverview, qualityFieldLabels } from "@/lib/data-quality";
import { buttonStyles } from "@/components/ui/button";

export default async function DataQualityPage() {
  const { metrics, candidates } = await getDataQualityOverview();
  const cards = [
    ["総候補者数", metrics.total], ["AI本評価済み", metrics.ai_evaluated], ["画像あり", metrics.with_images],
    ["公開プロフィールあり", metrics.public_profile], ["スキル入力済み", metrics.skills], ["ソフト入力済み", metrics.software],
    ["言語入力済み", metrics.languages], ["勤務地希望入力済み", metrics.work_location], ["AI Scout利用可能", metrics.scout_ready],
    ["データ不足", metrics.insufficient],
  ];
  return <div className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-medium tracking-[.18em] text-muted uppercase">Data readiness</p><h1 className="mt-2 text-3xl font-medium tracking-[-.045em] sm:text-4xl">データ品質</h1><p className="mt-2 text-sm text-muted">AI検索の前提となる候補者データの充実状況を確認します。</p></div><Link href="/data-quality/scout-tests" className={buttonStyles("secondary")}><FlaskConical size={15}/>Scout評価テスト</Link></header>
    <div className={`mt-7 rounded-xl border p-4 ${metrics.total < 20 ? "border-amber-300 bg-amber-50" : "bg-surface"}`}><div className="flex gap-3">{metrics.total < 20 ? <AlertTriangle className="mt-0.5 text-amber-700" size={18}/> : <CheckCircle2 size={18}/>}<div><p className="text-sm font-medium">Reverse Search評価のデータ目安</p><p className="mt-1 text-xs leading-5 text-muted">適切な評価には最低20名、推奨50名以上。現在{metrics.total}名のため、{metrics.total < 20 ? "検索精度はサンプル不足として扱います。" : metrics.total < 50 ? "最低評価ラインです。50名以上を推奨します。" : "精度評価を開始できる規模です。"}</p></div></div></div>
    <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([label, value]) => <article key={String(label)} className="rounded-xl border bg-surface p-4"><p className="text-xs text-muted">{label}</p><p className="mt-3 font-mono text-3xl">{value}</p></article>)}</section>
    <section className="mt-7 overflow-hidden rounded-xl border bg-surface"><div className="border-b px-5 py-4"><h2 className="text-sm font-medium">候補者別スコア</h2></div>{candidates.length ? <div className="divide-y">{candidates.map((c) => <div key={c.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(180px,1fr)_100px_2fr]"><div><Link href={`/candidates/${c.id}`} className="text-sm font-medium hover:underline">{c.full_name}</Link></div><div className="font-mono text-lg">{c.data_quality_score}<span className="text-xs text-muted">/100</span></div><div><p className="text-xs text-muted">次に入力: {c.data_quality_missing.slice(0, 3).map((key) => qualityFieldLabels[key] ?? key).join("、") || "主要項目は入力済み"}</p>{c.data_quality_missing.length ? <div className="mt-2 flex flex-wrap gap-1">{c.data_quality_missing.map((key) => <span key={key} className="rounded border px-2 py-1 text-[10px] text-muted">{qualityFieldLabels[key] ?? key}</span>)}</div> : null}</div></div>)}</div> : <div className="px-6 py-16 text-center text-sm text-muted">候補者がまだ登録されていません。</div>}</section>
  </div>;
}
