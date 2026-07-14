import { z } from "zod";
import { generateOutreachDraft } from "@/lib/ai/scout";
import { isSameOrigin } from "@/lib/api-security";
import { getScoutCandidate } from "@/lib/scout/data";
import { createClient } from "@/lib/supabase/server";
import { outreachDraftSchema, scoutRankingSchema } from "@/types/scout";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  run_id: z.string().uuid(),
  candidate_id: z.string().uuid(),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "候補者または検索結果が不正です。" }, { status: 400 });

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });

  const { data: result, error: resultError } = await supabase
    .from("scout_results")
    .select("run_id,candidate_id,scout_score,fit_reason,strengths,concerns,recommended_project,interview_questions,comparison,outreach_drafts")
    .eq("run_id", body.data.run_id)
    .eq("candidate_id", body.data.candidate_id)
    .maybeSingle();
  if (resultError || !result) return Response.json({ error: "AI Scout結果が見つかりません。" }, { status: 404 });

  const cached = outreachDraftSchema.safeParse(result.outreach_drafts);
  if (cached.success) return Response.json({ draft: cached.data, cached: true });

  const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error: rateError } = await supabase
    .from("scout_results")
    .select("id", { count: "exact", head: true })
    .not("outreach_generated_at", "is", null)
    .gte("outreach_generated_at", windowStart);
  if (rateError) return Response.json({ error: "利用状況を確認できませんでした。" }, { status: 500 });
  if ((count ?? 0) >= 10) return Response.json({ error: "文面生成は10分あたり10件までです。少し待って再試行してください。" }, { status: 429 });

  const { data: run, error: runError } = await supabase
    .from("scout_runs")
    .select("original_query")
    .eq("id", result.run_id)
    .maybeSingle();
  if (runError || !run) return Response.json({ error: "検索履歴が見つかりません。" }, { status: 404 });

  const rankingParsed = scoutRankingSchema.shape.rankings.element.safeParse({
    candidate_id: result.candidate_id,
    scout_score: result.scout_score,
    fit_reason: result.fit_reason,
    strengths: result.strengths,
    concerns: result.concerns,
    recommended_project: result.recommended_project,
    interview_questions: result.interview_questions,
    comparison: result.comparison,
  });
  if (!rankingParsed.success) return Response.json({ error: "保存済み評価を確認できませんでした。" }, { status: 500 });

  try {
    const candidate = await getScoutCandidate(result.candidate_id);
    const draft = await generateOutreachDraft({
      query: run.original_query,
      candidate,
      ranking: rankingParsed.data,
      userId: authData.user.id,
    });
    const { error: updateError } = await supabase.from("scout_results").update({
      outreach_drafts: draft,
      outreach_generated_at: new Date().toISOString(),
    }).eq("run_id", result.run_id).eq("candidate_id", result.candidate_id);
    if (updateError) throw new Error("OUTREACH_SAVE_FAILED");
    return Response.json({ draft, cached: false });
  } catch {
    return Response.json({ error: "スカウト文面を生成できませんでした。時間をおいて再試行してください。" }, { status: 503 });
  }
}
