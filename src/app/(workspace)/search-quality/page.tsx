import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SearchQualityPage() {
  await requireUser(); const supabase = await createClient();
  const [candidateResult, eligibilityResult, testCaseResult, testRunResult, reviewResult, scoutRunResult, visualRunResult] = await Promise.all([
    supabase.from("candidates").select("id,ai_score,data_quality_score,work_image_count"),
    supabase.from("candidate_ai_review_eligibility").select("candidate_id,eligible"),
    supabase.from("scout_test_cases").select("id"),
    supabase.from("scout_test_runs").select("precision_at_3,precision_at_5,sample_status,executed_at").eq("status", "succeeded").order("executed_at", { ascending: false }),
    supabase.from("human_candidate_reviews").select("score_difference,reviewed_at"),
    supabase.from("scout_runs").select("id,original_query,candidate_pool_count,ranked_count,status,started_at").order("started_at", { ascending: false }).limit(10),
    supabase.from("visual_search_runs").select("id,candidate_pool_count,result_count,status,started_at,visual_searches(name)").order("started_at", { ascending: false }).limit(10),
  ]);
  const candidates = candidateResult.data ?? []; const eligible = (eligibilityResult.data ?? []).filter((item) => item.eligible).length;
  const reviews = reviewResult.data ?? []; const evaluableRuns = (testRunResult.data ?? []).filter((run) => run.sample_status === "evaluable");
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const total = candidates.length;
  const stage = total < 20 ? { label: "機能検証のみ可能", tone: "warning", detail: "検索精度を断定できるサンプル数ではありません。最低20名を登録してください。" } : total < 50 ? { label: "初期精度評価が可能", tone: "progress", detail: "推奨50名に向けてデータ品質と人間レビューを増やしてください。" } : { label: "改善サイクルを開始可能", tone: "ready", detail: "継続的にPrecisionとAI／人間差を追跡できます。" };
  const metrics = [
    ["候補者総数", total], ["AI評価可能", eligible], ["AI評価済み", candidates.filter((item) => item.ai_score !== null).length],
    ["Visual Search可能", candidates.filter((item) => item.ai_score !== null && item.work_image_count > 0).length], ["Scoutテストケース", testCaseResult.data?.length ?? 0],
    ["人間評価済み", reviews.length], ["AI／人間平均差", average(reviews.map((item) => Number(item.score_difference)))],
    ["Precision@3", average(evaluableRuns.flatMap((item) => item.precision_at_3 === null ? [] : [Number(item.precision_at_3)]))],
    ["Precision@5", average(evaluableRuns.flatMap((item) => item.precision_at_5 === null ? [] : [Number(item.precision_at_5)]))],
  ] as const;
  return <div className="mx-auto max-w-[1450px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10"><header><p className="text-[10px] font-medium tracking-[.18em] text-muted uppercase">Search quality</p><h1 className="mt-2 text-3xl font-medium tracking-[-.045em] sm:text-4xl">検索品質</h1><p className="mt-2 text-sm text-muted">AI ScoutとVisual Searchを、実データ量・人間評価・検索テストで分けて検証します。</p></header><section className={`mt-7 rounded-xl border p-5 ${stage.tone === "ready" ? "border-[#cfd8cf] bg-[#f3f7f3]" : "border-[#dfd5c6] bg-[#faf7f0]"}`}><div className="flex items-start gap-3">{stage.tone === "ready" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<div><h2 className="text-sm font-medium">{stage.label}</h2><p className="mt-1 text-xs leading-5 text-muted">{stage.detail}</p></div><span className="ml-auto font-mono text-2xl">{total}</span></div></section><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{metrics.map(([label, value]) => <div key={label} className="rounded-xl border bg-surface p-4"><p className="text-[10px] text-muted">{label}</p><p className="mt-2 font-mono text-2xl">{value === null ? "—" : typeof value === "number" && !Number.isInteger(value) ? value.toFixed(2) : value}</p></div>)}</div><div className="mt-6 grid gap-6 xl:grid-cols-2"><RunTable title="AI Scout 検索ごとの候補者数" rows={(scoutRunResult.data ?? []).map((run) => ({ id: run.id, name: run.original_query, pool: run.candidate_pool_count, results: run.ranked_count, status: run.status, at: run.started_at }))} /><RunTable title="Visual Search 検索ごとの候補者数" rows={(visualRunResult.data ?? []).map((run) => ({ id: run.id, name: run.visual_searches?.[0]?.name ?? "Visual Search", pool: run.candidate_pool_count, results: run.result_count, status: run.status, at: run.started_at }))} /></div><div className="mt-6 flex flex-wrap gap-3"><Link href="/data-quality/scout-tests" className="flex items-center gap-2 rounded-lg border bg-surface px-4 py-2.5 text-xs">Scoutテスト <ArrowUpRight size={13} /></Link><Link href="/calibration/reviews" className="flex items-center gap-2 rounded-lg border bg-surface px-4 py-2.5 text-xs">人間レビュー <ArrowUpRight size={13} /></Link></div></div>;
}

function RunTable({ title, rows }: { title: string; rows: Array<{ id: string; name: string; pool: number; results: number; status: string; at: string }> }) { return <section className="rounded-xl border bg-surface p-5"><h2 className="text-sm font-medium">{title}</h2>{rows.length ? <div className="mt-4 divide-y">{rows.map((row) => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_60px_60px] gap-3 py-3 text-xs"><div className="min-w-0"><p className="truncate">{row.name}</p><p className="mt-1 font-mono text-[9px] text-muted">{row.status} · {new Date(row.at).toLocaleDateString("ja-JP")}</p></div><div className="text-right"><p className="font-mono">{row.pool}</p><p className="text-[9px] text-muted">pool</p></div><div className="text-right"><p className="font-mono">{row.results}</p><p className="text-[9px] text-muted">results</p></div></div>)}</div> : <p className="mt-6 text-xs text-muted">実行履歴はありません。</p>}</section>; }
