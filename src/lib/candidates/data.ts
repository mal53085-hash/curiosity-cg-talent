import "server-only";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Candidate, CandidateRating, CandidateStatus } from "@/types/candidate";

const candidateColumns = [
  "id",
  "full_name",
  "email",
  "phone",
  "country",
  "city",
  "primary_role",
  "years_experience",
  "skills",
  "software",
  "languages",
  "tags",
  "project_fit_tags",
  "availability",
  "status",
  "rating",
  "portfolio_url",
  "source_url",
  "public_profile",
  "employment_types",
  "work_location_preferences",
  "expected_salary_jpy",
  "current_country",
  "current_city",
  "japan_residency_status",
  "japan_work_authorization",
  "visa_status",
  "japanese_level",
  "english_level",
  "interested_in_japan",
  "willing_to_relocate_to_japan",
  "willing_to_work_in_tokyo",
  "remote_from_overseas",
  "full_time_interest",
  "freelance_interest",
  "earliest_start_date",
  "hiring_readiness_status",
  "hiring_readiness_confidence",
  "hiring_readiness_evidence",
  "hiring_readiness_verified_at",
  "readiness_verification",
  "hiring_pipeline_stage",
  "hiring_closed_reason",
  "contact_priority",
  "contact_priority_reasons",
  "next_action",
  "last_contacted_at",
  "next_interview_at",
  "outreach_review_status",
  "image_path",
  "work_image_count",
  "data_quality_score",
  "data_quality_missing",
  "data_quality_updated_at",
  "notes",
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
  "ai_rubric_version_id",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
].join(",");

async function attachSignedImageUrls(candidates: Candidate[]) {
  const paths = candidates.flatMap((candidate) =>
    candidate.image_path ? [candidate.image_path] : [],
  );
  if (paths.length === 0) return candidates;

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("candidate-images")
    .createSignedUrls(paths, 60 * 60);

  const urls = new Map(
    (data ?? []).map((item) => [item.path, item.signedUrl ?? null]),
  );
  return candidates.map((candidate) => ({
    ...candidate,
    image_url: candidate.image_path ? urls.get(candidate.image_path) ?? null : null,
  }));
}

export type CandidateFilters = {
  query?: string;
  status?: CandidateStatus;
  rating?: CandidateRating;
  country?: string;
  readiness?: string;
  japaneseLevel?: string;
  minimumCgFit?: number;
  software?: string;
  experience?: "junior" | "mid" | "senior";
  pipeline?: string;
};

export async function getCandidates(filters: CandidateFilters = {}) {
  await requireUser();
  const supabase = await createClient();
  let query = supabase
    .from("candidates")
    .select(candidateColumns)
    .order("updated_at", { ascending: false });

  const search = filters.query
    ?.trim()
    .replace(/[%_(),.]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,primary_role.ilike.%${search}%,country.ilike.%${search}%,city.ilike.%${search}%`,
    );
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.rating) query = query.eq("rating", filters.rating);
  if (filters.country) query = query.eq("country", filters.country.slice(0, 100));
  if (filters.readiness) query = query.eq("hiring_readiness_status", filters.readiness);
  if (filters.japaneseLevel) query = query.ilike("japanese_level", `%${filters.japaneseLevel.slice(0, 40)}%`);
  if (filters.minimumCgFit != null) query = query.gte("ai_score", filters.minimumCgFit);
  if (filters.software) query = query.contains("software", [filters.software.slice(0, 80)]);
  if (filters.pipeline) query = query.eq("hiring_pipeline_stage", filters.pipeline);
  if (filters.experience === "junior") query = query.lte("years_experience", 3);
  if (filters.experience === "mid") query = query.gte("years_experience", 4).lte("years_experience", 7);
  if (filters.experience === "senior") query = query.gte("years_experience", 8);

  const { data, error } = await query;
  if (error) throw new Error(`候補者の取得に失敗しました: ${error.message}`);
  return attachSignedImageUrls((data ?? []) as unknown as Candidate[]);
}

export async function getCandidate(id: string) {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidates")
    .select(candidateColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`候補者の取得に失敗しました: ${error.message}`);
  if (!data) notFound();
  const [candidate] = await attachSignedImageUrls([
    data as unknown as Candidate,
  ]);
  return candidate;
}

export async function getDashboardData() {
  const candidates = await getCandidates();
  const activeStatuses: CandidateStatus[] = [
    "screening",
    "interview",
    "trial",
    "offer",
  ];

  return {
    candidates,
    totals: {
      all: candidates.length,
      active: candidates.filter((candidate) =>
        activeStatuses.includes(candidate.status),
      ).length,
      international: candidates.filter(
        (candidate) => candidate.country.toLowerCase() !== "japan",
      ).length,
      highlyRated: candidates.filter((candidate) =>
        ["A+", "A"].includes(candidate.rating),
      ).length,
    },
  };
}
