import { z } from "zod";

const short = z.string().min(1).max(300);
export const visualFeaturesSchema = z.object({
  space_types: z.array(short).max(8), composition: z.array(short).max(8), camera_position: z.array(short).max(6),
  field_of_view: z.array(short).max(6), lighting: z.array(short).max(8), time_of_day: z.enum(["day", "dusk", "night", "mixed", "unknown"]),
  artificial_lighting: z.array(short).max(8), color_tone: z.array(short).max(8), contrast: z.array(short).max(6),
  materials: z.array(short).max(10), luxury_level: z.number().int().min(0).max(100), brand_tones: z.array(short).max(8),
  detail_density: z.number().int().min(0).max(100), photorealism: z.number().int().min(0).max(100),
  hospitality_fit: z.number().int().min(0).max(100), retail_fit: z.number().int().min(0).max(100),
  exterior_interior: z.enum(["exterior", "interior", "mixed", "unknown"]), quiet_drama: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(1000), uncertainties: z.array(short).max(8),
});
export type VisualFeatures = z.infer<typeof visualFeaturesSchema>;

export const visualFeatureVectorSchema = z.array(z.number().min(0).max(1)).length(16);
export type VisualFeatureVector = z.infer<typeof visualFeatureVectorSchema>;

export const visualRankingSchema = z.object({ results: z.array(z.object({
  candidate_id: z.string().uuid(), visual_fit_score: z.number().int().min(0).max(100),
  similar_features: z.array(short).min(1).max(8), different_features: z.array(short).max(8),
  strengths: z.array(short).max(6), risks: z.array(short).max(6), recommended_scope: z.string().min(1).max(1000),
  interview_questions: z.array(short).min(1).max(6),
})).max(10) });

export type VisualSearchResult = z.infer<typeof visualRankingSchema>["results"][number] & {
  rank: number; scout_score: number | null; candidate: { id: string; full_name: string; primary_role: string; ai_score: number | null };
};
