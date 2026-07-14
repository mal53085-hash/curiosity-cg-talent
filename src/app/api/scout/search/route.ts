import { z } from "zod";
import { parseScoutQuery, rerankCandidates, scoutModel } from "@/lib/ai/scout";
import { containsPromptInjection, isSameOrigin } from "@/lib/api-security";
import { getScoutCandidatePool } from "@/lib/scout/data";
import { candidateMeetsHardFilters, candidatePrefilterScore } from "@/lib/scout/scoring";
import { createClient } from "@/lib/supabase/server";
import type { ScoutResultView } from "@/types/scout";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  query: z.string().trim().min(5).max(1200),
  save_name: z.string().trim().min(1).max(120).nullable().default(null),
  search_id: z.string().uuid().nullable().default(null),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const parsedBody = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return Response.json({ error: "検索条件は5〜1,200文字で入力してください。" }, { status: 400 });
  if (containsPromptInjection(parsedBody.data.query)) {
    return Response.json({ error: "AI Scoutには候補者の職務要件だけを入力してください。" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });

  const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error: rateError } = await supabase
    .from("scout_runs")
    .select("id", { count: "exact", head: true })
    .eq("created_by", authData.user.id)
    .gte("started_at", windowStart);
  if (rateError) return Response.json({ error: "利用状況を確認できませんでした。" }, { status: 500 });
  if ((count ?? 0) >= 5) return Response.json({ error: "AI Scoutは10分あたり5回までです。少し待って再試行してください。" }, { status: 429 });

  const { data: run, error: runError } = await supabase
    .from("scout_runs")
    .insert({ original_query: parsedBody.data.query, created_by: authData.user.id })
    .select("id")
    .single();
  if (runError || !run) return Response.json({ error: "検索履歴を開始できませんでした。" }, { status: 500 });

  try {
    const filters = await parseScoutQuery(parsedBody.data.query, authData.user.id);
    let searchId: string | null = parsedBody.data.search_id;
    if (searchId) {
      const { data: existingSearch, error: existingSearchError } = await supabase
        .from("scout_searches")
        .update({ original_query: parsedBody.data.query, structured_filters: filters, last_run_at: new Date().toISOString() })
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
      return Response.json({ run_id: run.id, filters, results: [] });
    }

    const rankings = await rerankCandidates({ query: parsedBody.data.query, filters, candidates: pool, userId: authData.user.id });
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
      structured_filters: filters,
      status: "succeeded",
      candidate_pool_count: pool.length,
      ranked_count: results.length,
      model: scoutModel,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    if (completeError) throw new Error("SCOUT_RUN_COMPLETE_FAILED");
    return Response.json({ run_id: run.id, filters, results });
  } catch {
    await supabase.from("scout_runs").update({
      status: "failed",
      error_message: "AI Scout処理に失敗しました。",
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    return Response.json({ error: "AI Scoutを一時的に利用できません。時間をおいて再試行してください。" }, { status: 503 });
  }
}
