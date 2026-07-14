import "server-only";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AiScores } from "@/types/candidate";

export type CalibrationSample = {
  id: string; full_name: string; ai_score: number; ai_scores: AiScores; data_quality_score: number;
  reasons: string[]; last_difference: number | null; last_reviewed_at: string | null;
};

export async function getCalibrationSamples() {
  await requireUser(); const supabase = await createClient();
  const [{ data: candidates, error }, { data: reviews }, { data: visualResults }, { data: rubric }] = await Promise.all([
    supabase.from("candidates").select("id,full_name,ai_score,ai_scores,data_quality_score").not("ai_score", "is", null).order("ai_score", { ascending: false }).limit(200),
    supabase.from("human_candidate_reviews").select("candidate_id,score_difference,reviewed_at").order("reviewed_at", { ascending: false }),
    supabase.from("visual_search_results").select("candidate_id,rank"),
    supabase.from("evaluation_rubric_versions").select("id,version,axes").order("published_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) throw new Error(`評価サンプルを取得できませんでした: ${error.message}`);
  const latestReview = new Map<string, { score_difference: number; reviewed_at: string }>();
  for (const review of reviews ?? []) if (!latestReview.has(review.candidate_id)) latestReview.set(review.candidate_id, review);
  const ranks = new Map<string, number[]>();
  for (const result of visualResults ?? []) ranks.set(result.candidate_id, [...(ranks.get(result.candidate_id) ?? []), result.rank]);
  const samples = (candidates ?? []).flatMap((candidate): CalibrationSample[] => {
    const reasons: string[] = [];
    if ((candidate.ai_score ?? 0) >= 80) reasons.push("高得点候補");
    if ((candidate.ai_score ?? 100) <= 50) reasons.push("低得点候補");
    if (candidate.data_quality_score < 70) reasons.push("データ品質が低い");
    const last = latestReview.get(candidate.id);
    if (last && Number(last.score_difference) >= 15) reasons.push("AI／人間差が大きい");
    const candidateRanks = ranks.get(candidate.id) ?? [];
    if (candidateRanks.length >= 2 && Math.max(...candidateRanks) - Math.min(...candidateRanks) >= 3) reasons.push("Visual Search順位が不安定");
    return reasons.length ? [{ id: candidate.id, full_name: candidate.full_name, ai_score: candidate.ai_score!, ai_scores: candidate.ai_scores as AiScores, data_quality_score: candidate.data_quality_score, reasons, last_difference: last ? Number(last.score_difference) : null, last_reviewed_at: last?.reviewed_at ?? null }] : [];
  });
  return { samples, rubric: rubric ? { ...rubric, axes: rubric.axes as Array<{ key: string; label: string }> } : null };
}
