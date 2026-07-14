import { z } from "zod";
import { candidateRatings, candidateStatuses } from "@/types/candidate";

const optionalText = z.string().trim().max(2000).optional().default("");
const optionalUrl = z.union([z.literal(""), z.string().trim().url().max(2000)]);
const optionalEmail = z.union([z.literal(""), z.string().trim().email().max(320)]);

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
  languages: optionalText,
  availability: z.string().trim().max(160).optional().default(""),
  status: z.enum(candidateStatuses),
  rating: z.enum(candidateRatings),
  portfolio_url: optionalUrl,
  source_url: optionalUrl,
  notes: z.string().trim().max(10000).optional().default(""),
  ai_score: z.union([z.literal(""), z.coerce.number().int().min(0).max(100)]),
  ai_summary: z.string().trim().max(5000).optional().default(""),
  ai_strengths: optionalText,
  ai_risks: optionalText,
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
