import { ArrowUpRight, ChevronLeft, Edit3, ExternalLink, Mail, Phone } from "lucide-react";
import { AiEvaluationPanel } from "@/components/ai-evaluation-panel";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { CandidatePortfolioManager } from "@/components/candidate-portfolio-manager";
import { DeleteCandidateButton } from "@/components/delete-candidate-button";
import { JapanOutreachGenerator } from "@/components/japan-outreach-generator";
import { ButtonLink } from "@/components/ui/button-link";
import { getCandidate } from "@/lib/candidates/data";
import { getHiringSignals } from "@/lib/candidates/japan-hiring";
import { getCandidatePortfolio } from "@/lib/candidates/portfolio";
import { getCandidateStyleMatches } from "@/lib/style-profiles/data";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { japanReadinessLabels } from "@/types/candidate";

interface CandidateDetailPageProps { params: Promise<{ id: string }>; }

export default async function CandidateDetailPage({ params }: CandidateDetailPageProps) {
  const { id } = await params;
  const [candidate, portfolio, styleMatches] = await Promise.all([getCandidate(id), getCandidatePortfolio(id), getCandidateStyleMatches(id)]);
  const supabase = await createClient();
  const { data: interactions } = await supabase.from("candidate_interactions").select("id,kind,channel,summary,occurred_at,scheduled_at").eq("candidate_id", id).order("occurred_at", { ascending: false }).limit(30);
  const signals = getHiringSignals(candidate);
  const location = [candidate.current_city ?? candidate.city, candidate.current_country ?? candidate.country].filter(Boolean).join(", ");

  return <div className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7 sm:py-10 xl:px-10">
    <div className="flex items-center justify-between gap-3"><ButtonLink href="/candidates" variant="ghost" className="-ml-3 h-9 px-3"><ChevronLeft size={15}/>Candidates</ButtonLink><ButtonLink href={`/candidates/${id}/edit`} variant="secondary"><Edit3 size={14}/>編集</ButtonLink></div>
    <header className="mt-5 flex flex-col gap-5 border-y py-6 sm:flex-row sm:items-center"><CandidateAvatar name={candidate.full_name} imageUrl={candidate.image_url} className="size-24 shrink-0 text-2xl" priority/><div className="min-w-0 flex-1"><p className="text-[10px] tracking-[.15em] text-muted uppercase">{candidate.hiring_pipeline_stage}</p><h1 className="mt-2 text-3xl font-medium tracking-[-.045em] sm:text-4xl">{candidate.full_name}</h1><p className="mt-2 text-sm text-muted">{candidate.primary_role} · {location}</p></div></header>

    <section className="mt-6 rounded-xl border bg-[#f8f7f2] p-5 sm:p-6"><p className="text-[10px] font-medium tracking-[.15em] text-muted uppercase">採用上の結論</p><p className="mt-3 text-base leading-7">{signals.conclusion}</p><div className="mt-4 border-t pt-4"><p className="text-[10px] text-muted">次の推奨アクション</p><p className="mt-1 text-sm font-medium">{candidate.next_action || signals.nextAction}</p></div></section>
    <section className="mt-4 overflow-hidden rounded-xl border"><div className="grid grid-cols-3 gap-px bg-line"><Metric label="CG Fit" value={signals.cgFit}/><Metric label="Japan Readiness" value={signals.japanReadiness}/><Metric label="Contact Priority" value={signals.contactPriority}/></div><div className="border-t bg-surface px-4 py-3 text-[11px] leading-5 text-muted">算出理由：{signals.reasons.join(" · ") || "確認可能な情報が不足しています"}</div></section>

    <div className="mt-7 space-y-7">
      <JapanOutreachGenerator candidate={{ full_name: candidate.full_name, current_country: candidate.current_country, current_city: candidate.current_city, japanese_level: candidate.japanese_level, interested_in_japan: candidate.interested_in_japan, willing_to_relocate_to_japan: candidate.willing_to_relocate_to_japan, remote_from_overseas: candidate.remote_from_overseas, primary_role: candidate.primary_role, portfolio_url: candidate.portfolio_url }}/>
      <section className="rounded-xl border bg-surface p-5 sm:p-6"><h2 className="text-sm font-medium">公開プロフィール</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#55544f]">{candidate.public_profile || "公開プロフィールは未登録です。"}</p><div className="mt-4 flex flex-wrap gap-2">{candidate.skills.map((skill) => <span key={skill} className="rounded-full border px-3 py-1.5 text-xs text-muted">{skill}</span>)}</div></section>
      <CandidatePortfolioManager resourceId={candidate.id} images={portfolio.images} eligibility={portfolio.eligibility}/>
      <section className="rounded-xl border bg-surface p-5 sm:p-6"><h2 className="text-sm font-medium">日本勤務条件</h2><p className="mt-1 text-xs text-muted">{japanReadinessLabels[candidate.hiring_readiness_status]} · 確認度 {candidate.hiring_readiness_confidence}%</p><dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["現在地",location],["日本在住状況",candidate.japan_residency_status],["就労許可",formatBoolean(candidate.japan_work_authorization)],["ビザ・在留資格",candidate.visa_status],["日本語",candidate.japanese_level],["英語",candidate.english_level],["日本勤務への関心",formatBoolean(candidate.interested_in_japan)],["日本移住",formatBoolean(candidate.willing_to_relocate_to_japan)],["東京勤務",formatBoolean(candidate.willing_to_work_in_tokyo)],["海外リモート",formatBoolean(candidate.remote_from_overseas)],["正社員",formatBoolean(candidate.full_time_interest)],["業務委託",formatBoolean(candidate.freelance_interest)],["最短開始日",candidate.earliest_start_date],["希望年収",candidate.expected_salary_jpy == null ? null : `¥${candidate.expected_salary_jpy.toLocaleString("ja-JP")}`]].map(([label,value]) => <div key={label}><dt className="text-[10px] text-muted">{label}</dt><dd className="mt-1 text-xs">{value || "未確認"}</dd></div>)}</dl>{candidate.hiring_readiness_evidence ? <p className="mt-5 border-t pt-4 text-xs leading-6 text-muted">根拠：{candidate.hiring_readiness_evidence}</p> : null}</section>
      <AiEvaluationPanel candidate={{ id: candidate.id, image_path: candidate.image_path, ai_score: candidate.ai_score, ai_scores: candidate.ai_scores, ai_summary: candidate.ai_summary, ai_reasoning: candidate.ai_reasoning, ai_strengths: candidate.ai_strengths, ai_risks: candidate.ai_risks, ai_recommended_projects: candidate.ai_recommended_projects, ai_interview_questions: candidate.ai_interview_questions, ai_model: candidate.ai_model, ai_evaluated_at: candidate.ai_evaluated_at }} eligibility={portfolio.eligibility}/>
      <section className="rounded-xl border bg-surface p-5 sm:p-6"><h2 className="text-sm font-medium">接触・面談履歴</h2>{interactions?.length ? <div className="mt-4 divide-y">{interactions.map((item) => <article key={item.id} className="py-3"><div className="flex justify-between gap-4 text-[10px] text-muted"><span>{item.kind}{item.channel ? ` · ${item.channel}` : ""}</span><time>{formatDate(item.occurred_at)}</time></div><p className="mt-2 text-xs leading-5">{item.summary}</p></article>)}</div> : <p className="mt-4 text-xs text-muted">履歴はまだありません。</p>}</section>
      <section className="rounded-xl border bg-surface p-5 sm:p-6"><h2 className="text-sm font-medium">社内メモ</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#55544f]">{candidate.notes || "メモはまだありません。"}</p></section>
      <details className="rounded-xl border bg-surface p-5"><summary className="cursor-pointer text-sm font-medium">Advanced details</summary><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="text-xs font-medium">Style Profile適合</h3>{styleMatches.length ? styleMatches.map((match) => <p key={match.profile_id} className="mt-2 text-xs text-muted">{match.profile_name}: Visual {match.visual_fit_score} / DNA {match.dna_match ?? "—"}</p>) : <p className="mt-2 text-xs text-muted">評価履歴なし</p>}</div><div><h3 className="text-xs font-medium">外部リンク・連絡先</h3><div className="mt-2 space-y-2 text-xs">{candidate.email ? <a href={`mailto:${candidate.email}`} className="flex items-center gap-2"><Mail size={13}/>{candidate.email}</a> : null}{candidate.phone ? <a href={`tel:${candidate.phone}`} className="flex items-center gap-2"><Phone size={13}/>{candidate.phone}</a> : null}{candidate.portfolio_url ? <a href={candidate.portfolio_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">Portfolio<ArrowUpRight size={13}/></a> : null}{candidate.source_url ? <a href={candidate.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">Source<ExternalLink size={13}/></a> : null}</div></div></div></details>
      <section className="rounded-xl border border-[#e2d2cf] bg-[#faf6f5] p-5"><h2 className="text-xs font-medium text-danger">Danger zone</h2><div className="mt-4"><DeleteCandidateButton candidateId={candidate.id} candidateName={candidate.full_name}/></div></section>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: number | string | null }) { return <div className="bg-surface p-4 sm:p-5"><p className="text-[10px] text-muted">{label}</p><p className="mt-2 font-mono text-2xl">{value ?? "—"}</p></div>; }
function formatBoolean(value: boolean | null) { return value == null ? null : value ? "はい" : "いいえ"; }
