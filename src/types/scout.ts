import { z } from "zod";
import { candidateStatuses } from "@/types/candidate";

const score = z.number().int().min(0).max(100);
const shortList = z.array(z.string().trim().min(1).max(100)).max(10);

export const scoutFiltersSchema = z.object({
  required_skills: shortList,
  preferred_skills: shortList,
  minimum_score: score.nullable(),
  regions: z.array(z.string().trim().min(1).max(100)).max(5),
  languages: z.array(z.string().trim().min(1).max(80)).max(5),
  employment_types: z.array(z.enum(["full_time", "contract", "freelance", "part_time"])).max(4),
  statuses: z.array(z.enum(candidateStatuses)).max(candidateStatuses.length),
  luxury_fit: score.nullable(),
  hospitality_fit: score.nullable(),
  lighting_score: score.nullable(),
  composition_score: score.nullable(),
  salary_target_jpy: z.number().int().min(0).max(100000000).nullable(),
  keywords: z.array(z.string().trim().min(1).max(100)).max(10),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(6),
  warnings: z.array(z.string().trim().min(1).max(300)).max(6),
});

export type ScoutFilters = z.infer<typeof scoutFiltersSchema>;

export const scoutRankingSchema = z.object({
  rankings: z.array(z.object({
    candidate_id: z.string().uuid(),
    scout_score: score,
    fit_reason: z.string().trim().min(1).max(2000),
    strengths: z.array(z.string().trim().min(1).max(300)).min(1).max(5),
    concerns: z.array(z.string().trim().min(1).max(300)).max(5),
    recommended_project: z.string().trim().min(1).max(500),
    interview_questions: z.array(z.string().trim().min(1).max(400)).min(2).max(6),
    comparison: z.object({
      brand_fit: score,
      hospitality_fit: score,
      japan_work_fit: score,
      software_match: score,
      risk_level: z.enum(["low", "medium", "high"]),
    }),
  })).max(10),
});

export type ScoutRanking = z.infer<typeof scoutRankingSchema>["rankings"][number];

export const outreachDraftSchema = z.object({
  ja: z.object({
    linkedin_short: z.string().trim().min(1).max(800),
    email_long: z.string().trim().min(1).max(2500),
  }),
  en: z.object({
    linkedin_short: z.string().trim().min(1).max(800),
    email_long: z.string().trim().min(1).max(2500),
  }),
  factual_basis: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
});

export type OutreachDraft = z.infer<typeof outreachDraftSchema>;

export type ScoutComparison = ScoutRanking["comparison"];

export type ScoutResultView = ScoutRanking & {
  rank: number;
  candidate: {
    id: string;
    full_name: string;
    primary_role: string;
    country: string;
    city: string | null;
    ai_score: number | null;
    ai_scores: Record<string, number>;
    skills: string[];
    languages: string[];
    employment_types: string[];
    work_location_preferences: string[];
  };
};

export type SavedScoutSearch = {
  id: string;
  name: string;
  original_query: string;
  structured_filters: ScoutFilters;
  last_run_at: string | null;
  created_at: string;
};
