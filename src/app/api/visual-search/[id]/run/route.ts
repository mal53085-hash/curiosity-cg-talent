import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { rerankVisualCandidates, visualSearchModel } from "@/lib/ai/visual-search";
import { getCandidates } from "@/lib/candidates/data";
import { aggregateVisualFeatures } from "@/lib/visual-search/features";
import { createClient } from "@/lib/supabase/server";
import type { Candidate } from "@/types/candidate";
import { visualFeaturesSchema } from "@/types/visual-search";

export const runtime = "nodejs"; export const maxDuration = 60;
const requestSchema = z.object({ mode: z.enum(["initial", "rerun", "style_profile"]).default("initial") });
const headers = { "Cache-Control": "no-store, private", Pragma: "no-cache" };
const json = (body: object, status = 200) => Response.json(body, { status, headers });
function localScore(candidate: Candidate, luxury: number, hospitality: number, retail: number) { const axes = candidate.ai_scores; return (candidate.ai_score ?? 0) * .25 + (axes.composition ?? 0) * .15 + (axes.lighting ?? 0) * .15 + (axes.materials ?? 0) * .15 + (axes.luxury_brand_fit ?? 0) * .15 + Math.max(hospitality, retail, luxury) * .15; }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return json({ error: "不正なリクエストです。", stage: "候補者を事前選定" }, 403); const { id } = await params;
  const body = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!z.string().uuid().safeParse(id).success || !body.success) return json({ error: "検索IDまたは実行方法が不正です。", stage: "候補者を事前選定" }, 400);
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return json({ error: "ログインが必要です。", stage: "候補者を事前選定" }, 401);
  const tenMinutesAgo = new Date(Date.now() - 600_000).toISOString(); const today = new Date(); today.setUTCHours(0,0,0,0);
  const [{ count: recent }, { count: daily }] = await Promise.all([
    supabase.from("visual_search_runs").select("id", { count: "exact", head: true }).eq("created_by", auth.user.id).gte("started_at", tenMinutesAgo),
    supabase.from("visual_search_runs").select("id", { count: "exact", head: true }).eq("created_by", auth.user.id).gte("started_at", today.toISOString()),
  ]);
  const dailyLimit = Math.min(100, Math.max(1, Number.parseInt(process.env.VISUAL_SEARCH_DAILY_LIMIT ?? "10", 10) || 10));
  if ((recent ?? 0) >= 3) return json({ error: "Visual Searchは10分あたり3回までです。", stage: "候補者を事前選定" }, 429);
  if ((daily ?? 0) >= dailyLimit) return json({ error: "本日のVisual Search上限に達しました。", stage: "候補者を事前選定" }, 429);
  const [{ data: search }, { data: imageRows }] = await Promise.all([supabase.from("visual_searches").select("*").eq("id", id).eq("created_by", auth.user.id).maybeSingle(), supabase.from("visual_search_images").select("id,visual_features,analysis_input_tokens,analysis_output_tokens,source_discarded_at,storage_path").eq("search_id", id).order("image_index")]);
  if (!search || !imageRows?.length) return json({ error: "検索または抽出済み特徴量が見つかりません。", stage: "候補者を事前選定" }, 404);
  if (imageRows.some((row) => row.storage_path !== null || !row.source_discarded_at)) return json({ error: "Privacy Modeの特徴量レコードだけを検索に使用できます。", stage: "プライバシー保護のため元画像を破棄" }, 409);
  const { data: run, error: runError } = await supabase.from("visual_search_runs").insert({ search_id: id, reference_image_count: imageRows.length, estimated_api_calls: 2, created_by: auth.user.id }).select("id").single(); if (runError || !run) return json({ error: "実行履歴を開始できません。", stage: "候補者を事前選定" }, 500);
  let stage = "候補者を事前選定";
  try {
    const context = { project_type: search.project_type, brand_tone: search.brand_tone, space_type: search.space_type, time_of_day: search.time_of_day, priority_criteria: search.priority_criteria, additional_conditions: search.additional_conditions };
    const parsedFeatures = imageRows.map((row) => visualFeaturesSchema.parse(row.visual_features));
    const features = aggregateVisualFeatures(parsedFeatures);
    const candidates = await getCandidates(); const pool = candidates.map((candidate) => ({ candidate, localScore: localScore(candidate, features.luxury_level, features.hospitality_fit, features.retail_fit) })).sort((a,b) => b.localScore-a.localScore).slice(0,20);
    stage = "AIで再ランキング";
    const ranked = pool.length ? await rerankVisualCandidates(features, context, pool, auth.user.id) : { results: [], inputTokens: 0, outputTokens: 0 };
    const map = new Map(pool.map(({ candidate }) => [candidate.id, candidate])); const ids = ranked.results.map((r) => r.candidate_id);
    const { data: latestScout } = ids.length ? await supabase.from("scout_results").select("candidate_id,scout_score,created_at").in("candidate_id", ids).order("created_at", { ascending: false }) : { data: [] };
    const scoutMap = new Map<string, number>(); for (const row of latestScout ?? []) if (!scoutMap.has(row.candidate_id)) scoutMap.set(row.candidate_id, row.scout_score);
    const results = ranked.results.flatMap((item, index) => { const candidate = map.get(item.candidate_id); return candidate ? [{ ...item, rank: index + 1, scout_score: scoutMap.get(item.candidate_id) ?? null, candidate: { id: candidate.id, full_name: candidate.full_name, primary_role: candidate.primary_role, ai_score: candidate.ai_score } }] : []; });
    stage = "結果を作成";
    if (results.length) { const { error } = await supabase.from("visual_search_results").insert(results.map((r) => ({ run_id: run.id, candidate_id: r.candidate_id, rank: r.rank, visual_fit_score: r.visual_fit_score, scout_score: r.scout_score, brand_dna_match: r.brand_dna_match, lighting_match: r.lighting_match, composition_match: r.composition_match, material_match: r.material_match, luxury_brand_fit: r.luxury_brand_fit, display_design: r.display_design, color_control: r.color_control, visual_silence: r.visual_silence, similar_features: r.similar_features, different_features: r.different_features, strengths: r.strengths, risks: r.risks, recommended_scope: r.recommended_scope, interview_questions: r.interview_questions }))); if (error) throw new Error("RESULT_SAVE_FAILED"); }
    const analysisInput = imageRows.reduce((sum, row) => sum + row.analysis_input_tokens, 0); const analysisOutput = imageRows.reduce((sum, row) => sum + row.analysis_output_tokens, 0);
    await supabase.from("visual_search_runs").update({ status: "succeeded", candidate_pool_count: candidates.length, reranked_count: pool.length, result_count: results.length, input_tokens: analysisInput + ranked.inputTokens, output_tokens: analysisOutput + ranked.outputTokens, model: visualSearchModel, completed_at: new Date().toISOString() }).eq("id", run.id);
    await supabase.from("audit_events").insert({ event_type: "visual_search.completed", resource_type: "visual_search", resource_id: id, metadata: { run_id: run.id, result_count: results.length, privacy_mode: true, feature_records_used: imageRows.length, reference_images_reopened: 0 }, actor_id: auth.user.id });
    if (body.data.mode !== "initial") await supabase.from("audit_events").insert({ event_type: "visual_search.rerun", resource_type: "visual_search", resource_id: id, metadata: { run_id: run.id, mode: body.data.mode, feature_records_used: imageRows.length, original_images_used: 0 }, actor_id: auth.user.id });
    return json({ run_id: run.id, features, results, sample_status: candidates.length < 20 ? "insufficient" : candidates.length < 50 ? "minimum" : "recommended", privacy_mode: true, completed_stage: "結果を作成" });
  } catch {
    await supabase.from("visual_search_runs").update({ status: "failed", error_code: "AI_OR_PROCESSING_UNAVAILABLE", completed_at: new Date().toISOString() }).eq("id", run.id);
    return json({ error: `${stage}の段階で処理できませんでした。元画像は保存されていません。抽出済み特徴量から再試行できます。`, stage }, 503);
  }
}
