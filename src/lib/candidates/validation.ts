import { z } from "zod";
import { candidateRatings, candidateStatuses, hiringClosedReasons, hiringPipelineStages, japanReadinessGrades, readinessVerificationStatuses } from "@/types/candidate";

const optionalText = z.string().trim().max(2000).optional().default("");
const optionalUrl = z.union([z.literal(""), z.string().trim().url().max(2000)]);
const optionalEmail = z.union([z.literal(""), z.string().trim().email().max(320)]);
const optionalBoolean = z.enum(["", "true", "false"]);
const verification = z.enum(readinessVerificationStatuses).default("unknown");

export const candidateSchema = z.object({
  full_name: z.string().trim().min(1, "氏名を入力してください").max(160),
  email: optionalEmail,
  phone: z.string().trim().max(80).optional().default(""),
  country: z.string().trim().min(1, "国・地域を入力してください").max(100),
  city: z.string().trim().max(100).optional().default(""),
  primary_role: z.string().trim().min(1, "専門領域を入力してください").max(160),
  years_experience: z.union([
    z.literal(""),
    z.coerce.number().int().min(0).max(80),
  ]),
  skills: optionalText,
  software: optionalText,
  languages: optionalText,
  tags: optionalText,
  project_fit_tags: optionalText,
  availability: z.string().trim().max(160).optional().default(""),
  status: z.enum(candidateStatuses),
  rating: z.enum(candidateRatings),
  portfolio_url: optionalUrl,
  source_url: optionalUrl,
  public_profile: z.string().trim().max(5000).optional().default(""),
  employment_types: optionalText,
  work_location_preferences: optionalText,
  expected_salary_jpy: z.union([
    z.literal(""),
    z.coerce.number().int().min(0).max(100000000),
  ]),
  current_country: z.string().trim().max(100).optional().default(""),
  current_city: z.string().trim().max(100).optional().default(""),
  japan_residency_status: z.string().trim().max(160).optional().default(""),
  japan_work_authorization: optionalBoolean,
  visa_status: z.string().trim().max(160).optional().default(""),
  japanese_level: z.string().trim().max(80).optional().default(""),
  english_level: z.string().trim().max(80).optional().default(""),
  interested_in_japan: optionalBoolean,
  willing_to_relocate_to_japan: optionalBoolean,
  willing_to_work_in_tokyo: optionalBoolean,
  remote_from_overseas: optionalBoolean,
  full_time_interest: optionalBoolean,
  freelance_interest: optionalBoolean,
  earliest_start_date: z.union([z.literal(""), z.string().date()]),
  hiring_readiness_status: z.enum(japanReadinessGrades),
  hiring_readiness_confidence: z.coerce.number().int().min(0).max(100),
  hiring_readiness_evidence: z.string().trim().max(4000).optional().default(""),
  readiness_verification_status: verification,
  hiring_pipeline_stage: z.enum(hiringPipelineStages),
  hiring_closed_reason: z.union([z.literal(""), z.enum(hiringClosedReasons)]),
  next_action: z.string().trim().max(500).optional().default(""),
  next_interview_at: z.string().trim().max(40).optional().default(""),
  notes: z.string().trim().max(10000).optional().default(""),
});

export type CandidateInput = z.infer<typeof candidateSchema>;

export function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}

export function nullable(value: string) {
  return value.length > 0 ? value : null;
}
