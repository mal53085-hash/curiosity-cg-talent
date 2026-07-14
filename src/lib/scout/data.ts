import "server-only";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Candidate } from "@/types/candidate";
import type { SavedScoutSearch, ScoutFilters } from "@/types/scout";

export const scoutCandidateColumns = [
  "id",
  "full_name",
  "country",
  "city",
  "primary_role",
  "years_experience",
  "skills",
  "software",
  "tags",
  "project_fit_tags",
  "languages",
  "availability",
  "status",
  "rating",
  "portfolio_url",
  "source_url",
  "public_profile",
  "employment_types",
  "work_location_preferences",
  "expected_salary_jpy",
  "ai_score",
  "ai_summary",
  "ai_strengths",
  "ai_risks",
  "ai_scores",
  "ai_reasoning",
  "ai_recommended_projects",
  "ai_interview_questions",
  "ai_model",
  "ai_evaluated_at",
].join(",");

function asCandidate(row: Record<string, unknown>) {
  return {
    email: null,
    phone: null,
    notes: null,
    image_path: null,
    work_image_count: 0,
    data_quality_score: 0,
    data_quality_missing: [],
    data_quality_updated_at: null,
    created_by: "",
    updated_by: null,
    created_at: "",
    updated_at: "",
    ...row,
  } as unknown as Candidate;
}

export async function getScoutCandidatePool(filters: ScoutFilters) {
  await requireUser();
  const supabase = await createClient();
  let query = supabase.from("candidates").select(scoutCandidateColumns);
  if (filters.minimum_score !== null) query = query.gte("ai_score", filters.minimum_score);
  if (filters.statuses.length) query = query.in("status", filters.statuses);
  if (filters.required_skills.length) query = query.overlaps("skills", filters.required_skills);
  if (filters.employment_types.length) query = query.overlaps("employment_types", filters.employment_types);
  const { data, error } = await query.order("ai_score", { ascending: false, nullsFirst: false }).limit(50);
  if (error) throw new Error("SCOUT_CANDIDATE_QUERY_FAILED");
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(asCandidate);
}

export async function getScoutCandidate(id: string) {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidates")
    .select(scoutCandidateColumns)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("SCOUT_CANDIDATE_NOT_FOUND");
  return asCandidate(data as unknown as Record<string, unknown>);
}

export async function getScoutOverview() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: searches, error: searchesError }, { data: runs, error: runsError }] = await Promise.all([
    supabase
      .from("scout_searches")
      .select("id,name,original_query,structured_filters,last_run_at,created_at")
      .eq("created_by", user.id)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("scout_runs")
      .select("id,search_id,original_query,status,candidate_pool_count,ranked_count,started_at,completed_at,error_message")
      .eq("created_by", user.id)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);
  if (searchesError || runsError) throw new Error("AI Scoutの履歴を取得できませんでした。");
  return {
    searches: (searches ?? []) as unknown as SavedScoutSearch[],
    runs: runs ?? [],
  };
}
