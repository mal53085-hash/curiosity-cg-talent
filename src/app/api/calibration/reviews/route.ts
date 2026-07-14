import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

const axisKeys = ["composition", "lighting", "materials", "luxury_brand_fit", "interior_understanding", "detail", "finish", "technical_adaptability", "hospitality_fit", "retail_fit", "artificial_lighting", "design_understanding"] as const;
const scoresSchema = z.object(Object.fromEntries(axisKeys.map((key) => [key, z.number().int().min(0).max(100)])) as Record<(typeof axisKeys)[number], z.ZodNumber>).strict();
const requestSchema = z.object({ candidate_id: z.string().uuid(), rubric_version_id: z.string().uuid(), sample_reasons: z.array(z.string().max(100)).max(10), human_scores: scoresSchema, comments: z.string().max(5000) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const supabase = await createClient(); const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "人間評価の入力を確認してください。" }, { status: 400 });
  const [{ data: candidate }, { data: rubric }] = await Promise.all([
    supabase.from("candidates").select("id,ai_score,ai_scores").eq("id", parsed.data.candidate_id).maybeSingle(),
    supabase.from("evaluation_rubric_versions").select("id").eq("id", parsed.data.rubric_version_id).maybeSingle(),
  ]);
  if (!candidate || candidate.ai_score === null) return Response.json({ error: "AI評価済み候補が見つかりません。" }, { status: 404 });
  if (!rubric) return Response.json({ error: "評価基準versionが見つかりません。" }, { status: 404 });
  const aiScores = candidate.ai_scores as Record<string, number>;
  const differences = axisKeys.flatMap((key) => typeof aiScores[key] === "number" ? [Math.abs(aiScores[key] - parsed.data.human_scores[key])] : []);
  const scoreDifference = differences.length ? differences.reduce((sum, value) => sum + value, 0) / differences.length : 0;
  const { data, error } = await supabase.from("human_candidate_reviews").insert({ candidate_id: candidate.id, sample_reasons: parsed.data.sample_reasons, ai_evaluation: { overall_score: candidate.ai_score, scores: aiScores }, human_scores: parsed.data.human_scores, score_difference: Number(scoreDifference.toFixed(2)), comments: parsed.data.comments.trim() || null, reviewer_id: auth.user.id, rubric_version_id: rubric.id }).select("id,score_difference,reviewed_at").single();
  if (error) return Response.json({ error: "人間評価を保存できませんでした。" }, { status: 500 });
  await supabase.from("audit_events").insert({ event_type: "human_candidate_review.created", resource_type: "candidate", resource_id: candidate.id, metadata: { review_id: data.id, rubric_version_id: rubric.id, score_difference: data.score_difference }, actor_id: auth.user.id });
  return Response.json(data, { status: 201 });
}
