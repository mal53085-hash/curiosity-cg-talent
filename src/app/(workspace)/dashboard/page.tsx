import Link from "next/link";
import { ArrowRight, CalendarClock, CircleAlert, Clock3, MailQuestion, UserRoundSearch } from "lucide-react";
import { quickCandidateAction } from "@/app/actions/hiring";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { buttonStyles } from "@/components/ui/button";
import { getDashboardData } from "@/lib/candidates/data";
import { coverageSegment, currentHiringTime, getHiringSignals, isCandidateStale } from "@/lib/candidates/japan-hiring";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const { candidates } = await getDashboardData();
  const now = currentHiringTime();
  const week = 7 * 86_400_000;
  const tasks = [
    { label: "今日確認すべき新着候補", value: candidates.filter((candidate) => candidate.hiring_pipeline_stage === "new" && now - new Date(candidate.created_at).getTime() <= week).length, icon: UserRoundSearch, href: "/candidates?pipeline=new" },
    { label: "日本勤務条件が未確認", value: candidates.filter((candidate) => candidate.hiring_readiness_status === "D" || candidate.hiring_readiness_confidence < 50).length, icon: CircleAlert, href: "/candidates?readiness=D" },
    { label: "スカウト文面の確認待ち", value: candidates.filter((candidate) => candidate.outreach_review_status === "review_pending").length, icon: MailQuestion, href: "/candidates?view_name=contact_week" },
    { label: "返信待ち", value: candidates.filter((candidate) => candidate.hiring_pipeline_stage === "contacted").length, icon: Clock3, href: "/candidates?pipeline=contacted" },
    { label: "面談予定", value: candidates.filter((candidate) => candidate.next_interview_at && new Date(candidate.next_interview_at).getTime() >= now).length, icon: CalendarClock, href: "/hiring-pipeline#interview" },
    { label: "7日以上更新なし", value: candidates.filter((candidate) => isCandidateStale(candidate, now)).length, icon: Clock3, href: "/candidates?view_name=stale" },
  ];
  const featured = candidates.filter((candidate) => candidate.hiring_pipeline_stage !== "closed").map((candidate) => ({ candidate, signals: getHiringSignals(candidate) })).sort((a, b) => b.signals.contactPriority - a.signals.contactPriority).slice(0, 5);
  const segments = candidates.reduce<Record<string, number>>((counts, candidate) => { const segment = coverageSegment(candidate); counts[segment] = (counts[segment] ?? 0) + 1; return counts; }, {});
  const coverage = [
    ["日本在住・日本語対応", "japan_japanese", 40], ["日本在住の外国籍人材", "japan_international", 20], ["海外在住・日本勤務関心", "relocation", 20], ["海外リモート", "overseas_remote", 15], ["世界トップ級参考候補", "global_reference", 5],
  ] as const;

  return <div className="mx-auto max-w-[1420px] px-4 py-7 sm:px-7 sm:py-10 xl:px-10">
    <header className="max-w-3xl"><p className="text-[10px] font-medium tracking-[.18em] text-muted uppercase">Today</p><h1 className="mt-2 text-3xl font-medium tracking-[-.045em] sm:text-4xl">今日の採用アクション</h1><p className="mt-2 text-sm text-muted">優先して確認する候補と、次に進める作業だけを表示します。</p></header>

    <section className="mt-8 grid gap-px overflow-hidden rounded-xl border bg-line sm:grid-cols-2 xl:grid-cols-3">{tasks.map((task) => <Link key={task.label} href={task.href} className="group flex items-center gap-4 bg-surface p-5 transition hover:bg-[#faf9f5]"><span className="grid size-10 place-items-center rounded-full bg-surface-muted text-muted"><task.icon size={16}/></span><div className="min-w-0 flex-1"><p className="text-xs text-muted">{task.label}</p><p className="mt-1 font-mono text-2xl">{task.value}</p></div><ArrowRight size={14} className="text-muted transition group-hover:translate-x-0.5"/></Link>)}</section>

    <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section><div className="flex items-end justify-between"><div><p className="text-[10px] tracking-[.16em] text-muted uppercase">Priority</p><h2 className="mt-2 text-xl font-medium">注目候補</h2></div><Link href="/candidates" className="text-xs text-muted hover:text-foreground">すべて見る</Link></div>
        <div className="mt-4 divide-y border-y">{featured.length ? featured.map(({ candidate, signals }) => <article key={candidate.id} className="py-5"><div className="flex gap-4"><CandidateAvatar name={candidate.full_name} imageUrl={candidate.image_url} className="size-14 shrink-0"/><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><Link href={`/candidates/${candidate.id}`} className="font-medium hover:underline">{candidate.full_name}</Link><p className="mt-1 text-xs text-muted">{[candidate.current_city ?? candidate.city, candidate.current_country ?? candidate.country].filter(Boolean).join(", ")}</p></div><div className="grid grid-cols-3 gap-3 text-right text-[10px]"><Score label="CG Fit" value={signals.cgFit}/><Score label="Japan" value={signals.japanReadiness}/><Score label="Priority" value={signals.contactPriority}/></div></div><p className="mt-3 text-xs text-muted">{candidate.software.slice(0, 3).join(" / ") || "使用ソフト未確認"} · {candidate.project_fit_tags.slice(0, 2).join(" / ") || "案件適性未確認"}</p><p className="mt-2 text-xs"><span className="text-muted">次：</span>{signals.nextAction}</p></div></div><div className="mt-4 flex flex-wrap justify-end gap-2"><Link href={`/candidates/${candidate.id}`} className={buttonStyles("ghost", "h-8 px-3 text-xs")}>詳細</Link><form action={quickCandidateAction.bind(null, candidate.id, "shortlist")}><button className={buttonStyles("secondary", "h-8 px-3 text-xs")}>Shortlistへ</button></form><form action={quickCandidateAction.bind(null, candidate.id, "close")}><button className={buttonStyles("ghost", "h-8 px-3 text-xs text-muted")}>見送り</button></form></div></article>) : <p className="py-16 text-center text-sm text-muted">確認対象の候補者はいません。</p>}</div>
      </section>
      <aside><p className="text-[10px] tracking-[.16em] text-muted uppercase">Data coverage</p><h2 className="mt-2 text-xl font-medium">候補者構成</h2><p className="mt-2 text-xs leading-5 text-muted">日本採用に必要な候補構成との現在差分です。属性は確認済み情報だけで分類します。</p><div className="mt-6 space-y-5">{coverage.map(([label, key, target]) => { const count = segments[key] ?? 0; const actual = candidates.length ? Math.round(count / candidates.length * 100) : 0; return <div key={key}><div className="flex justify-between text-xs"><span>{label}</span><span className="font-mono text-muted">{actual}% / {target}%</span></div><div className="mt-2 h-1.5 bg-surface-muted"><div className={cn("h-full", actual >= target ? "bg-[#657564]" : "bg-[#77756d]")} style={{ width: `${Math.min(100, actual)}%` }}/></div><p className="mt-1 text-[10px] text-muted">{count}名</p></div>; })}</div></aside>
    </div>
  </div>;
}

function Score({ label, value }: { label: string; value: number | string | null }) { return <div><p className="text-muted">{label}</p><p className="mt-1 font-mono text-sm text-foreground">{value ?? "—"}</p></div>; }
