import "server-only";
import { createClient } from "@/lib/supabase/server";
import { visualFeaturesSchema, visualFeatureVectorSchema } from "@/types/visual-search";
import type { StyleProfileSummary } from "@/types/style-profile";

export async function getStyleProfiles(status?: "active" | "archived"): Promise<StyleProfileSummary[]> {
  const supabase = await createClient();
  let query = supabase.from("style_profiles").select("id,name,description,status,created_at,updated_at").order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data: profiles } = await query;
  if (!profiles?.length) return [];
  const { data: versions } = await supabase.from("style_profile_versions").select("id,profile_id,version_number,derived_features,feature_vector,evaluation_weights,model_version,created_at").in("profile_id", profiles.map((profile) => profile.id)).order("version_number", { ascending: false });
  const latest = new Map<string, StyleProfileSummary["current_version"]>();
  for (const version of versions ?? []) {
    if (latest.has(version.profile_id)) continue;
    const features = visualFeaturesSchema.safeParse(version.derived_features);
    const vector = visualFeatureVectorSchema.safeParse(version.feature_vector);
    if (!features.success || !vector.success) continue;
    latest.set(version.profile_id, { id: version.id, version_number: version.version_number, derived_features: features.data, feature_vector: vector.data, evaluation_weights: version.evaluation_weights as Record<string, number>, model_version: version.model_version, created_at: version.created_at });
  }
  return profiles.map((profile) => ({ ...profile, status: profile.status as "active" | "archived", current_version: latest.get(profile.id) ?? null }));
}

export async function getCandidateStyleMatches(candidateId: string) {
  const supabase = await createClient();
  const profiles = await getStyleProfiles("active");
  if (!profiles.length) return [];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const { data: searches } = await supabase.from("visual_searches").select("id,style_profile_id").in("style_profile_id", profiles.map((profile) => profile.id));
  if (!searches?.length) return [];
  const searchToProfile = new Map(searches.map((search) => [search.id, search.style_profile_id as string]));
  const { data: runs } = await supabase.from("visual_search_runs").select("id,search_id,completed_at").in("search_id", searches.map((search) => search.id)).eq("status", "succeeded").order("completed_at", { ascending: false });
  if (!runs?.length) return [];
  const runMap = new Map(runs.map((run) => [run.id, run]));
  const { data: results } = await supabase.from("visual_search_results").select("run_id,visual_fit_score,brand_dna_match").eq("candidate_id", candidateId).in("run_id", runs.map((run) => run.id));
  const seen = new Set<string>();
  return (results ?? []).flatMap((result) => {
    const run = runMap.get(result.run_id); const profileId = run ? searchToProfile.get(run.search_id) : null;
    if (!run || !profileId || seen.has(profileId)) return [];
    const profile = profileMap.get(profileId); if (!profile) return [];
    seen.add(profileId);
    return [{ profile_id: profile.id, profile_name: profile.name, visual_fit_score: result.visual_fit_score, dna_match: result.brand_dna_match, evaluated_at: run.completed_at }];
  });
}

