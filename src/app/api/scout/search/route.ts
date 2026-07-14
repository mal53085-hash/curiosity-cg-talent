import { z } from "zod";
import { parseScoutQuery, rerankCandidates, scoutModel } from "@/lib/ai/scout";
import { containsPromptInjection, isSameOrigin } from "@/lib/api-security";
import { getScoutCandidatePool } from "@/lib/scout/data";
import { candidateMeetsHardFilters, candidatePrefilterScore } from "@/lib/scout/scoring";
import { createClient } from "@/lib/supabase/server";
import type { ScoutResultView } from "@/types/scout";
import { visualFeaturesSchema } from "@/types/visual-search";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  query: z.string().trim().min(5).max(1200),
  save_name: z.string().trim().min(1).max(120).nullable().default(null),
  search_id: z.string().uuid().nullable().default(null),
  style_profile_id: z.string().uuid().nullable().default(null),
});

const responseHeaders = { "Cache-Control": "no-store, private", Pragma: "no-cache" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: responseHeaders });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "不正なリクエストです。" }, 403);
  const parsedBody = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return json({ error: "検索条件は5〜1,200文字で入力してください。" }, 400);
  if (containsPromptInjection(parsedBody.data.query)) {
    return json({ error: "AI Scoutには候補者の職務要件だけを入力してください。" }, 400);
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return json({ error: "ログインが必要です。" }, 401);

  let styleProfile: { name: string; derived_features: z.infer<typeof visualFeaturesSchema>; evaluation_weights: Record<string, number>; model_version: string } | null = null;
  if (parsedBody.data.style_profile_id) {
    const { data: profile } = await supabase.from("style_profiles").select("id,name,status").eq("id", parsedBody.data.style_profile_id).eq("created_by", authData.user.id).maybeSingle();
    if (!profile || profile.status !== "active") return json({ error: "利用可能なStyle Profileが見つかりません。" }, 404);
    const { data: version } = await supabase.from("style_profile_versions").select("derived_features,evaluation_weights,model_version").eq("profile_id", profile.id).eq("created_by", authData.user.id).order("version_number", { ascending: false }).limit(1).maybeSingle();
    const features = visualFeaturesSchema.safeParse(version?.derived_features);
    if (!version || !features.success) return json({ error: "Style Profileの特徴量を読み込めませんでした。" }, 422);
    styleProfile = { name: profile.name, derived_features: features.data, evaluation_weights: version.evaluation_weights as Record<string, number>, model_version: version.model_version };
  }

  const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error: rateError } = await supabase
    .from("scout_runs")
    .select("id", { count: "exact", head: true })
    .eq("created_by", authData.user.id)
    .gte("started_at", windowStart);
  if (rateError) return json({ error: "利用状況を確認できませんでした。" }, 500);
  if ((count ?? 0) >= 5) return json({ error: "AI Scoutは10分あたり5回までです。少し待って再試行してください。" }, 429);

  const { data: run, error: runError } = await supabase
    .from("scout_runs")
    .insert({ original_query: parsedBody.data.query, style_profile_id: parsedBody.data.style_profile_id, created_by: authData.user.id })
    .select("id")
    .single();
  if (runError || !run) return json({ error: "検索履歴を開始できませんでした。" }, 500);

  try {
    const filters = await parseScoutQuery(parsedBody.data.query, authData.user.id);
    let searchId: string | null = parsedBody.data.search_id;
    if (searchId) {
      const { data: existingSearch, error: existingSearchError } = await supabase
        .from("scout_searches")
        .update({ original_query: parsedBody.data.query, structured_filters: filters, style_profile_id: parsedBody.data.style_profile_id, last_run_at: new Date().toISOString() })
        .eq("id", searchId)
        .eq("created_by", authData.user.id)
        .select("id")
        .maybeSingle();
      if (existingSearchError || !existingSearch) throw new Error("SCOUT_SEARCH_NOT_FOUND");
    } else if (parsedBody.data.save_name) {
      const { data: search, error: searchError } = await supabase
        .from("scout_searches")
        .insert({
          name: parsedBody.data.save_name,
          original_query: parsedBody.data.query,
          structured_filters: filters,
          style_profile_id: parsedBody.data.style_profile_id,
          created_by: authData.user.id,
          last_run_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (searchError || !search) throw new Error("SCOUT_SAVE_FAILED");
      searchId = search.id;
    }

    const pool = (await getScoutCandidatePool(filters))
      .filter((candidate) => candidateMeetsHardFilters(candidate, filters))
      .map((candidate) => ({ candidate, localScore: candidatePrefilterScore(candidate, filters) }))
      .sort((a, b) => b.localScore - a.localScore)
      .slice(0, 20);

    if (pool.length === 0) {
      await supabase.from("scout_runs").update({
        search_id: searchId,
        structured_filters: filters,
        status: "succeeded",
        candidate_pool_count: 0,
        ranked_count: 0,
        model: scoutModel,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);
      return json({ run_id: run.id, search_id: searchId, filters, results: [], style_profile: styleProfile?.name ?? null });
    }

    const rankings = await rerankCandidates({ query: parsedBody.data.query, filters, candidates: pool, userId: authData.user.id, styleProfile });
    const candidateMap = new Map(pool.map(({ candidate }) => [candidate.id, candidate]));
    const results: ScoutResultView[] = rankings.flatMap((ranking, index) => {
      const candidate = candidateMap.get(ranking.candidate_id);
      if (!candidate) return [];
      return [{
        ...ranking,
        rank: index + 1,
        candidate: {
          id: candidate.id,
          full_name: candidate.full_name,
          primary_role: candidate.primary_role,
          country: candidate.country,
          city: candidate.city,
          ai_score: candidate.ai_score,
          ai_scores: candidate.ai_scores,
          skills: candidate.skills,
          languages: candidate.languages,
          employment_types: candidate.employment_types,
          work_location_preferences: candidate.work_location_preferences,
        },
      }];
    });

    if (results.length) {
      const { error: resultError } = await supabase.from("scout_results").insert(results.map((result) => ({
        run_id: run.id,
        candidate_id: result.candidate_id,
        rank: result.rank,
        scout_score: result.scout_score,
        fit_reason: result.fit_reason,
        strengths: result.strengths,
        concerns: result.concerns,
        recommended_project: result.recommended_project,
        interview_questions: result.interview_questions,
        comparison: result.comparison,
      })));
      if (resultError) throw new Error("SCOUT_RESULTS_SAVE_FAILED");
    }

    const { error: completeError } = await supabase.from("scout_runs").update({
      search_id: searchId,
      style_profile_id: parsedBody.data.style_profile_id,
      structured_filters: filters,
      status: "succeeded",
      candidate_pool_count: pool.length,
      ranked_count: results.length,
      model: scoutModel,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    if (completeError) throw new Error("SCOUT_RUN_COMPLETE_FAILED");
    return json({ run_id: run.id, search_id: searchId, filters, results, style_profile: styleProfile?.name ?? null });
  } catch {
    await supabase.from("scout_runs").update({
      status: "failed",
      error_message: "AI Scout処理に失敗しました。",
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    return json({ error: "AI Scoutを一時的に利用できません。時間をおいて再試行してください。" }, 503);
  }
}
