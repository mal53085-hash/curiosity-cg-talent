import type { Candidate } from "@/types/candidate";
import type { ScoutFilters } from "@/types/scout";

function normalize(value: string) {
  return value.toLocaleLowerCase("en-US").replace(/[^a-z0-9\p{L}]+/gu, " ").trim();
}

function includesAny(values: string[], wanted: string[]) {
  const normalized = values.map(normalize);
  return wanted.some((item) => normalized.some((value) => value.includes(normalize(item)) || normalize(item).includes(value)));
}

function axis(candidate: Candidate, key: string) {
  return typeof candidate.ai_scores[key as keyof typeof candidate.ai_scores] === "number"
    ? candidate.ai_scores[key as keyof typeof candidate.ai_scores]!
    : 50;
}

export function candidatePrefilterScore(candidate: Candidate, filters: ScoutFilters) {
  let score = candidate.ai_score ?? 50;
  const text = [
    candidate.primary_role,
    candidate.public_profile ?? "",
    candidate.ai_summary ?? "",
    candidate.ai_reasoning ?? "",
    ...candidate.ai_strengths,
    ...candidate.ai_recommended_projects,
  ].join(" ");

  if (filters.required_skills.length) {
    const matches = filters.required_skills.filter((skill) => includesAny(candidate.skills, [skill])).length;
    score += (matches / filters.required_skills.length) * 18;
    if (matches < filters.required_skills.length) score -= 15;
  }
  if (filters.preferred_skills.length) {
    score += filters.preferred_skills.filter((skill) => includesAny(candidate.skills, [skill])).length * 3;
  }
  if (filters.regions.length && includesAny([candidate.country, candidate.city ?? "", ...candidate.work_location_preferences], filters.regions)) score += 8;
  if (filters.languages.length && includesAny(candidate.languages, filters.languages)) score += 6;
  if (filters.employment_types.length && includesAny(candidate.employment_types, filters.employment_types)) score += 6;
  if (filters.luxury_fit !== null) score += (axis(candidate, "luxury_brand_fit") - filters.luxury_fit) * 0.15;
  if (filters.lighting_score !== null) score += (axis(candidate, "lighting") - filters.lighting_score) * 0.15;
  if (filters.composition_score !== null) score += (axis(candidate, "composition") - filters.composition_score) * 0.15;
  if (filters.hospitality_fit !== null && /hotel|hospitality|ホテル|旅館|resort/i.test(text)) score += 8;
  score += filters.keywords.filter((keyword) => normalize(text).includes(normalize(keyword))).length * 2;
  if (filters.salary_target_jpy !== null && candidate.expected_salary_jpy !== null) {
    const difference = Math.abs(candidate.expected_salary_jpy - filters.salary_target_jpy) / Math.max(filters.salary_target_jpy, 1);
    score += Math.max(-8, 8 - difference * 20);
  }
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function candidateMeetsHardFilters(candidate: Candidate, filters: ScoutFilters) {
  if (filters.minimum_score !== null && (candidate.ai_score ?? 0) < filters.minimum_score) return false;
  if (filters.statuses.length && !filters.statuses.includes(candidate.status)) return false;
  if (filters.required_skills.length && !filters.required_skills.every((skill) => includesAny(candidate.skills, [skill]))) return false;
  if (filters.regions.length && !includesAny([candidate.country, candidate.city ?? "", ...candidate.work_location_preferences], filters.regions)) return false;
  if (filters.languages.length && !filters.languages.every((language) => includesAny(candidate.languages, [language]))) return false;
  if (filters.employment_types.length && !includesAny(candidate.employment_types, filters.employment_types)) return false;
  return true;
}
