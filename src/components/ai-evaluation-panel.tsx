"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, MessageCircleQuestion, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  aiCriterionKeys,
  aiCriterionLabels,
  type Candidate,
} from "@/types/candidate";
import type { AiReviewEligibility } from "@/types/portfolio";

type AiEvaluationCandidate = Pick<
  Candidate,
  | "id"
  | "image_path"
  | "ai_score"
  | "ai_scores"
  | "ai_summary"
  | "ai_reasoning"
  | "ai_strengths"
  | "ai_risks"
  | "ai_recommended_projects"
  | "ai_interview_questions"
  | "ai_model"
  | "ai_evaluated_at"
>;

export function AiEvaluationPanel({ candidate, eligibility }: { candidate: AiEvaluationCandidate; eligibility: AiReviewEligibility }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasEvaluation = candidate.ai_score != null;

  async function evaluate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/candidates/${candidate.id}/ai-score`, {
        method: "POST",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "AI採点に失敗しました。");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI採点に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border bg-surface">
      <div className="flex flex-col gap-4 border-b bg-[#f8f7f2] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-lg bg-[#e7e5dd] text-[#57564f]">
            <Sparkles size={15} />
          </span>
          <div>
            <h2 className="text-sm font-medium">AI評価</h2>
            <p className="mt-0.5 text-xs text-muted">作品画像とプロフィールの総合分析</p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="sm:ml-auto"
          disabled={pending || !eligibility.eligible}
          onClick={evaluate}
        >
          {pending ? <RotateCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {pending ? "採点中…" : hasEvaluation ? "再採点" : "AIで採点"}
        </Button>
      </div>

      {!eligibility.eligible ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-muted">AI採点の条件が揃っていません。</p>
          {eligibility.reasons.length ? <p className="mt-2 text-xs text-muted">{eligibility.reasons.join(" / ")}</p> : null}
        </div>
      ) : hasEvaluation ? (
        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {aiCriterionKeys.map((key) => (
              <div key={key} className="rounded-lg border bg-[#faf9f5] p-4">
                <p className="text-[11px] text-muted">{aiCriterionLabels[key]}</p>
                <p className="mt-2 font-mono text-2xl tracking-[-0.04em]">
                  {candidate.ai_scores[key] ?? "—"}
                  {candidate.ai_scores[key] != null ? <span className="ml-1 text-[10px] text-muted">/100</span> : null}
                </p>
              </div>
            ))}
          </div>

          {candidate.ai_summary ? <p className="text-sm leading-7 text-[#4e4d48]">{candidate.ai_summary}</p> : null}
          {candidate.ai_reasoning ? (
            <div className="rounded-lg border p-4">
              <h3 className="text-xs font-medium">採点理由</h3>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-muted">{candidate.ai_reasoning}</p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <EvaluationList title="強み" items={candidate.ai_strengths} tone="strength" />
            <EvaluationList title="懸念点" items={candidate.ai_risks} tone="risk" icon={<CircleAlert size={13} />} />
            <EvaluationList title="推奨案件" items={candidate.ai_recommended_projects} tone="strength" />
            <EvaluationList title="面談質問" items={candidate.ai_interview_questions} tone="neutral" icon={<MessageCircleQuestion size={13} />} />
          </div>

          <div className="flex flex-wrap justify-between gap-2 border-t pt-4 text-[10px] text-muted">
            <span>AI評価は参考情報です。採用判断は必ず人が行ってください。</span>
            {candidate.ai_evaluated_at ? (
              <span className="font-mono">
                {candidate.ai_model} · {new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(candidate.ai_evaluated_at))}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="px-6 py-12 text-center">
          <Sparkles size={20} className="mx-auto text-[#aaa89f]" />
          <p className="mt-4 text-sm text-muted">AI評価はまだ実行されていません。</p>
        </div>
      )}

      {error ? (
        <p role="alert" className="mx-5 mb-5 rounded-lg border border-[#dec4c0] bg-[#f5e9e7] px-4 py-3 text-xs text-danger sm:mx-6 sm:mb-6">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function EvaluationList({
  title,
  items,
  tone,
  icon,
}: {
  title: string;
  items: string[];
  tone: "strength" | "risk" | "neutral";
  icon?: React.ReactNode;
}) {
  const dot = tone === "strength" ? "bg-[#596d5d]" : tone === "risk" ? "bg-[#8b6957]" : "bg-[#77756c]";
  return (
    <div className="rounded-lg border bg-[#faf9f5] p-4">
      <h3 className="flex items-center gap-1.5 text-xs font-medium">{icon}{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {Array.from(new Set(items)).map((item) => (
            <li key={item} className="flex gap-2 text-xs leading-5 text-muted">
              <span className={`mt-2 size-1 shrink-0 rounded-full ${dot}`} /> {item}
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-xs text-muted">なし</p>}
    </div>
  );
}
