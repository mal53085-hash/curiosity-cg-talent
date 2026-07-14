import { z } from "zod";
import { containsPromptInjection, isSameOrigin } from "@/lib/api-security";
import { parseScoutQuery, rerankCandidates, scoutModel } from "@/lib/ai/scout";
import { getScoutCandidatePool } from "@/lib/scout/data";
import { candidateMeetsHardFilters, candidatePrefilterScore } from "@/lib/scout/scoring";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({ name: z.string().trim().min(1).max(160), query: z.string().trim().min(5).max(1200), expected_ids: z.array(z.string().uuid()).max(20) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || containsPromptInjection(parsed.data?.query ?? "")) return Response.json({ error: "テスト条件を確認してください。" }, { status: 400 });
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const { data: testCase, error } = await supabase.from("scout_test_cases").insert({ name: parsed.data.name, query: parsed.data.query, created_by: auth.user.id }).select("id").single();
  if (error || !testCase) return Response.json({ error: "テストケースを保存できませんでした。" }, { status: 500 });
  if (parsed.data.expected_ids.length) {
    const { error: expectedError } = await supabase.from("scout_test_expected_results").insert(parsed.data.expected_ids.map((candidate_id, index) => ({ test_case_id: testCase.id, candidate_id, expected_rank: index + 1 })));
    if (expectedError) { await supabase.from("scout_test_cases").delete().eq("id", testCase.id); return Response.json({ error: "想定候補を保存できませんでした。" }, { status: 500 }); }
  }
  return Response.json({ id: testCase.id });
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "テストケースが不正です。" }, { status: 400 });
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const { data: testCase } = await supabase.from("scout_test_cases").select("id,query").eq("id", parsed.data.id).eq("created_by", auth.user.id).maybeSingle();
  if (!testCase) return Response.json({ error: "テストケースが見つかりません。" }, { status: 404 });
  const [{ data: expected }, { count }] = await Promise.all([
    supabase.from("scout_test_expected_results").select("candidate_id,expected_rank").eq("test_case_id", testCase.id).order("expected_rank"),
    supabase.from("candidates").select("id", { count: "exact", head: true }),
  ]);
  try {
    const filters = await parseScoutQuery(testCase.query, auth.user.id);
    const pool = (await getScoutCandidatePool(filters)).filter((c) => candidateMeetsHardFilters(c, filters)).map((candidate) => ({ candidate, localScore: candidatePrefilterScore(candidate, filters) })).sort((a, b) => b.localScore - a.localScore).slice(0, 20);
    const rankings = pool.length ? await rerankCandidates({ query: testCase.query, filters, candidates: pool, userId: auth.user.id }) : [];
    const actual = rankings.map((r) => r.candidate_id); const expectedSet = new Set((expected ?? []).map((r) => r.candidate_id));
    const precision = (k: number) => actual.slice(0, k).filter((id) => expectedSet.has(id)).length / k;
    const sampleStatus = (count ?? 0) < 20 ? "insufficient" : "evaluable";
    const { data: run, error } = await supabase.from("scout_test_runs").insert({ test_case_id: testCase.id, scout_version: `phase3.5/${scoutModel}`, actual_candidate_ids: actual, precision_at_3: expectedSet.size ? precision(3) : null, precision_at_5: expectedSet.size ? precision(5) : null, sample_size: count ?? 0, sample_status: sampleStatus, status: "succeeded", created_by: auth.user.id }).select("*").single();
    if (error) throw new Error();
    return Response.json({ run });
  } catch {
    await supabase.from("scout_test_runs").insert({ test_case_id: testCase.id, scout_version: `phase3.5/${scoutModel}`, sample_size: count ?? 0, sample_status: (count ?? 0) < 20 ? "insufficient" : "evaluable", status: "failed", error_message: "AI Scout評価テストに失敗しました。", created_by: auth.user.id });
    return Response.json({ error: "AI Scoutを一時的に利用できません。" }, { status: 503 });
  }
}
