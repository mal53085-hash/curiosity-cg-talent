import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { analyzeReferenceImages, rerankVisualCandidates, visualSearchModel } from "@/lib/ai/visual-search";
import { getCandidates } from "@/lib/candidates/data";
import { createClient } from "@/lib/supabase/server";
import type { Candidate } from "@/types/candidate";

export const runtime = "nodejs"; export const maxDuration = 60;
function localScore(candidate: Candidate, luxury: number, hospitality: number, retail: number) { const axes = candidate.ai_scores; return (candidate.ai_score ?? 0) * .25 + (axes.composition ?? 0) * .15 + (axes.lighting ?? 0) * .15 + (axes.materials ?? 0) * .15 + (axes.luxury_brand_fit ?? 0) * .15 + Math.max(hospitality, retail, luxury) * .15; }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 }); const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "検索IDが不正です。" }, { status: 400 });
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const tenMinutesAgo = new Date(Date.now() - 600_000).toISOString(); const today = new Date(); today.setUTCHours(0,0,0,0);
  const [{ count: recent }, { count: daily }] = await Promise.all([
    supabase.from("visual_search_runs").select("id", { count: "exact", head: true }).eq("created_by", auth.user.id).gte("started_at", tenMinutesAgo),
    supabase.from("visual_search_runs").select("id", { count: "exact", head: true }).eq("created_by", auth.user.id).gte("started_at", today.toISOString()),
  ]);
  const dailyLimit = Math.min(100, Math.max(1, Number.parseInt(process.env.VISUAL_SEARCH_DAILY_LIMIT ?? "10", 10) || 10));
  if ((recent ?? 0) >= 3) return Response.json({ error: "Visual Searchは10分あたり3回までです。" }, { status: 429 });
  if ((daily ?? 0) >= dailyLimit) return Response.json({ error: "本日のVisual Search上限に達しました。" }, { status: 429 });
  const [{ data: search }, { data: imageRows }] = await Promise.all([supabase.from("visual_searches").select("*").eq("id", id).eq("created_by", auth.user.id).maybeSingle(), supabase.from("visual_search_images").select("id,storage_path").eq("search_id", id)]);
  if (!search || !imageRows?.length) return Response.json({ error: "検索または画像が見つかりません。" }, { status: 404 });
  const { data: run, error: runError } = await supabase.from("visual_search_runs").insert({ search_id: id, reference_image_count: imageRows.length, estimated_api_calls: 2, created_by: auth.user.id }).select("id").single(); if (runError || !run) return Response.json({ error: "実行履歴を開始できません。" }, { status: 500 });
  try {
    const buffers: Buffer[] = []; for (const row of imageRows) { const { data, error } = await supabase.storage.from("visual-search-references").download(row.storage_path); if (error || !data) throw new Error("REFERENCE_MISSING"); buffers.push(Buffer.from(await data.arrayBuffer())); }
    const context = { project_type: search.project_type, brand_tone: search.brand_tone, space_type: search.space_type, time_of_day: search.time_of_day, priority_criteria: search.priority_criteria, additional_conditions: search.additional_conditions };
    const analyzed = await analyzeReferenceImages(buffers, context, auth.user.id);
    await supabase.from("visual_search_images").update({ visual_features: analyzed.features, analysis_model: visualSearchModel, analyzed_at: new Date().toISOString() }).eq("search_id", id);
    const candidates = await getCandidates(); const pool = candidates.map((candidate) => ({ candidate, localScore: localScore(candidate, analyzed.features.luxury_level, analyzed.features.hospitality_fit, analyzed.features.retail_fit) })).sort((a,b) => b.localScore-a.localScore).slice(0,20);
    const ranked = pool.length ? await rerankVisualCandidates(analyzed.features, context, pool, auth.user.id) : { results: [], inputTokens: 0, outputTokens: 0 };
    const map = new Map(pool.map(({ candidate }) => [candidate.id, candidate])); const ids = ranked.results.map((r) => r.candidate_id);
    const { data: latestScout } = ids.length ? await supabase.from("scout_results").select("candidate_id,scout_score,created_at").in("candidate_id", ids).order("created_at", { ascending: false }) : { data: [] };
    const scoutMap = new Map<string, number>(); for (const row of latestScout ?? []) if (!scoutMap.has(row.candidate_id)) scoutMap.set(row.candidate_id, row.scout_score);
    const results = ranked.results.flatMap((item, index) => { const candidate = map.get(item.candidate_id); return candidate ? [{ ...item, rank: index + 1, scout_score: scoutMap.get(item.candidate_id) ?? null, candidate: { id: candidate.id, full_name: candidate.full_name, primary_role: candidate.primary_role, ai_score: candidate.ai_score } }] : []; });
    if (results.length) { const { error } = await supabase.from("visual_search_results").insert(results.map((r) => ({ run_id: run.id, candidate_id: r.candidate_id, rank: r.rank, visual_fit_score: r.visual_fit_score, scout_score: r.scout_score, similar_features: r.similar_features, different_features: r.different_features, strengths: r.strengths, risks: r.risks, recommended_scope: r.recommended_scope, interview_questions: r.interview_questions }))); if (error) throw new Error("RESULT_SAVE_FAILED"); }
    await supabase.from("visual_search_runs").update({ status: "succeeded", candidate_pool_count: candidates.length, reranked_count: pool.length, result_count: results.length, input_tokens: analyzed.inputTokens + ranked.inputTokens, output_tokens: analyzed.outputTokens + ranked.outputTokens, model: visualSearchModel, completed_at: new Date().toISOString() }).eq("id", run.id);
    await supabase.from("audit_events").insert({ event_type: "visual_search.completed", resource_type: "visual_search", resource_id: id, metadata: { run_id: run.id, result_count: results.length }, actor_id: auth.user.id });
    return Response.json({ run_id: run.id, features: analyzed.features, results, sample_status: candidates.length < 20 ? "insufficient" : candidates.length < 50 ? "minimum" : "recommended" });
  } catch {
    await supabase.from("visual_search_runs").update({ status: "failed", error_code: "AI_OR_PROCESSING_UNAVAILABLE", completed_at: new Date().toISOString() }).eq("id", run.id);
    return Response.json({ error: "Visual Searchを一時的に利用できません。画像は保存されたままです。後で再試行できます。" }, { status: 503 });
  }
}
