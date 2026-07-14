import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronLeft,
  Edit3,
  ExternalLink,
  Globe2,
  Languages,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { AiEvaluationPanel } from "@/components/ai-evaluation-panel";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { DeleteCandidateButton } from "@/components/delete-candidate-button";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { getCandidate } from "@/lib/candidates/data";
import { formatDate } from "@/lib/utils";

interface CandidateDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CandidateDetailPage({ params }: CandidateDetailPageProps) {
  const { id } = await params;
  const candidate = await getCandidate(id);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ButtonLink href="/candidates" variant="ghost" className="-ml-3 h-9 self-start px-3">
          <ChevronLeft size={15} /> 候補者一覧
        </ButtonLink>
        <ButtonLink href={`/candidates/${candidate.id}/edit`} variant="secondary" className="w-full sm:w-auto">
          <Edit3 size={15} /> 編集
        </ButtonLink>
      </div>

      <header className="mt-5 grid gap-6 overflow-hidden rounded-xl border bg-surface p-5 sm:grid-cols-[160px_1fr] sm:p-7 lg:grid-cols-[220px_1fr_auto] lg:items-end">
        <CandidateAvatar
          name={candidate.full_name}
          imageUrl={candidate.image_url}
          className="aspect-square w-full max-w-[220px] text-4xl sm:w-[160px] lg:w-[220px]"
          priority
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={candidate.status} />
            <span className="rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted">
              {candidate.rating === "unrated" ? "未評価" : `RANK ${candidate.rating}`}
            </span>
          </div>
          <h1 className="mt-5 text-3xl font-medium tracking-[-0.05em] sm:text-4xl lg:text-5xl">
            {candidate.full_name}
          </h1>
          <p className="mt-3 text-sm text-muted sm:text-base">{candidate.primary_role}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <MapPin size={13} /> {[candidate.city, candidate.country].filter(Boolean).join(", ")}
            </span>
            {candidate.years_experience != null ? (
              <span className="flex items-center gap-1.5"><BriefcaseBusiness size={13} /> 経験 {candidate.years_experience}年</span>
            ) : null}
            {candidate.availability ? <span>稼働：{candidate.availability}</span> : null}
          </div>
        </div>
        <div className="border-t pt-5 sm:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <p className="text-[10px] font-medium tracking-[0.15em] text-muted uppercase">AI fit score</p>
          <p className="mt-2 font-mono text-4xl font-medium tracking-[-0.06em]">
            {candidate.ai_score == null ? "—" : candidate.ai_score}
            {candidate.ai_score != null ? <span className="ml-1 text-sm text-muted">/100</span> : null}
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_330px] xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <AiEvaluationPanel candidate={{
            id: candidate.id,
            image_path: candidate.image_path,
            ai_score: candidate.ai_score,
            ai_scores: candidate.ai_scores,
            ai_summary: candidate.ai_summary,
            ai_reasoning: candidate.ai_reasoning,
            ai_strengths: candidate.ai_strengths,
            ai_risks: candidate.ai_risks,
            ai_recommended_projects: candidate.ai_recommended_projects,
            ai_interview_questions: candidate.ai_interview_questions,
            ai_model: candidate.ai_model,
            ai_evaluated_at: candidate.ai_evaluated_at,
          }} />

          <section className="rounded-xl border bg-surface p-5 sm:p-6">
            <h2 className="text-sm font-medium">スキル</h2>
            {candidate.skills.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {candidate.skills.map((skill) => (
                  <span key={skill} className="rounded-lg border bg-[#faf9f5] px-3 py-2 text-xs text-[#5e5d57]">{skill}</span>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-muted">スキルは未登録です。</p>}
          </section>

          <section className="rounded-xl border bg-surface p-5 sm:p-6">
            <h2 className="text-sm font-medium">社内メモ</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#55544f]">
              {candidate.notes || "メモはまだありません。"}
            </p>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border bg-surface p-5">
            <h2 className="text-sm font-medium">連絡先・プロフィール</h2>
            <dl className="mt-5 space-y-4">
              {candidate.email ? (
                <div className="flex gap-3"><Mail size={15} className="mt-0.5 shrink-0 text-muted" /><div className="min-w-0"><dt className="text-[10px] text-muted">メール</dt><dd className="mt-1 truncate text-xs"><a href={`mailto:${candidate.email}`} className="hover:underline">{candidate.email}</a></dd></div></div>
              ) : null}
              {candidate.phone ? (
                <div className="flex gap-3"><Phone size={15} className="mt-0.5 shrink-0 text-muted" /><div><dt className="text-[10px] text-muted">電話</dt><dd className="mt-1 text-xs"><a href={`tel:${candidate.phone}`} className="hover:underline">{candidate.phone}</a></dd></div></div>
              ) : null}
              <div className="flex gap-3"><Globe2 size={15} className="mt-0.5 shrink-0 text-muted" /><div><dt className="text-[10px] text-muted">国・地域</dt><dd className="mt-1 text-xs">{candidate.country}</dd></div></div>
              {candidate.languages.length ? (
                <div className="flex gap-3"><Languages size={15} className="mt-0.5 shrink-0 text-muted" /><div><dt className="text-[10px] text-muted">言語</dt><dd className="mt-1 text-xs leading-5">{candidate.languages.join(" / ")}</dd></div></div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border bg-surface p-5">
            <h2 className="text-sm font-medium">外部リンク</h2>
            <div className="mt-4 space-y-2">
              {candidate.portfolio_url ? (
                <a href={candidate.portfolio_url} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-between rounded-lg border px-3 text-xs transition hover:bg-surface-muted">
                  ポートフォリオ <ArrowUpRight size={14} />
                </a>
              ) : null}
              {candidate.source_url ? (
                <a href={candidate.source_url} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-between rounded-lg border px-3 text-xs transition hover:bg-surface-muted">
                  発見元を開く <ExternalLink size={14} />
                </a>
              ) : null}
              {!candidate.portfolio_url && !candidate.source_url ? <p className="text-xs text-muted">リンクは未登録です。</p> : null}
            </div>
          </section>

          <section className="rounded-xl border bg-surface p-5 text-xs text-muted">
            <div className="flex justify-between gap-4"><span>登録日</span><span className="font-mono">{formatDate(candidate.created_at)}</span></div>
            <div className="mt-3 flex justify-between gap-4"><span>最終更新</span><span className="font-mono">{formatDate(candidate.updated_at)}</span></div>
          </section>

          <section className="rounded-xl border border-[#e2d2cf] bg-[#faf6f5] p-5">
            <h2 className="text-xs font-medium text-danger">Danger zone</h2>
            <p className="mt-2 text-xs leading-5 text-muted">候補者と保存画像を完全に削除します。</p>
            <div className="mt-4"><DeleteCandidateButton candidateId={candidate.id} candidateName={candidate.full_name} /></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
