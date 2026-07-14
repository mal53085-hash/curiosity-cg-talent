import Link from "next/link";
import {
  ArrowRight,
  Globe2,
  Plus,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { StatusBadge } from "@/components/status-badge";
import { getDashboardData } from "@/lib/candidates/data";
import { formatDate } from "@/lib/utils";
import { candidateStatuses, statusLabels } from "@/types/candidate";

export default async function DashboardPage() {
  const { candidates, totals } = await getDashboardData();
  const recentCandidates = candidates.slice(0, 6);

  const metrics = [
    { label: "登録候補者", value: totals.all, icon: Users, note: "全タレントプール" },
    { label: "選考進行中", value: totals.active, icon: Target, note: "面談・トライアル含む" },
    { label: "海外候補", value: totals.international, icon: Globe2, note: "日本国外の候補者" },
    { label: "Aランク以上", value: totals.highlyRated, icon: Sparkles, note: "優先アプローチ候補" },
  ] as const;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium tracking-[0.18em] text-muted uppercase">
            Overview
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
            ダッシュボード
          </h1>
          <p className="mt-2 text-sm text-muted">世界中のCG人材パイプラインを俯瞰します。</p>
        </div>
        <ButtonLink href="/candidates/new" className="w-full sm:w-auto">
          <Plus size={16} />
          候補者を追加
        </ButtonLink>
      </header>

      <section className="mt-8 grid gap-px overflow-hidden rounded-xl border bg-line sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted">{metric.label}</p>
              <metric.icon size={16} strokeWidth={1.6} className="text-[#85837b]" />
            </div>
            <p className="mt-6 font-mono text-4xl font-medium tracking-[-0.06em] tabular-nums">
              {String(metric.value).padStart(2, "0")}
            </p>
            <p className="mt-2 text-[11px] text-[#99978f]">{metric.note}</p>
          </article>
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <section className="overflow-hidden rounded-xl border bg-surface">
          <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-medium">最近更新された候補者</h2>
              <p className="mt-1 text-[11px] text-muted">優先度と進捗をすばやく確認</p>
            </div>
            <Link href="/candidates" className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
              すべて見る <ArrowRight size={13} />
            </Link>
          </div>
          {recentCandidates.length > 0 ? (
            <div className="divide-y">
              {recentCandidates.map((candidate) => (
                <Link
                  key={candidate.id}
                  href={`/candidates/${candidate.id}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-4 transition hover:bg-[#faf9f5] sm:grid-cols-[auto_1fr_90px_110px] sm:px-6"
                >
                  <CandidateAvatar
                    name={candidate.full_name}
                    imageUrl={candidate.image_url}
                    className="size-11"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{candidate.full_name}</p>
                    <p className="mt-1 truncate text-xs text-muted">
                      {candidate.primary_role} · {candidate.country}
                    </p>
                  </div>
                  <span className="hidden font-mono text-sm font-medium sm:block">
                    {candidate.rating === "unrated" ? "—" : candidate.rating}
                  </span>
                  <div className="justify-self-end">
                    <StatusBadge status={candidate.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-muted">候補者はまだ登録されていません。</p>
              <ButtonLink href="/candidates/new" variant="secondary" className="mt-5">
                最初の候補者を追加
              </ButtonLink>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">選考パイプライン</h2>
              <p className="mt-1 text-[11px] text-muted">ステータス別の現在数</p>
            </div>
            <span className="font-mono text-xs text-muted">{formatDate(new Date().toISOString())}</span>
          </div>
          <div className="mt-6 space-y-4">
            {candidateStatuses.slice(0, 6).map((status) => {
              const count = candidates.filter((candidate) => candidate.status === status).length;
              const width = totals.all ? Math.max((count / totals.all) * 100, count ? 6 : 0) : 0;
              return (
                <div key={status}>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-[#5f5e58]">{statusLabels[status]}</span>
                    <span className="font-mono text-muted">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-[#55544f]" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
