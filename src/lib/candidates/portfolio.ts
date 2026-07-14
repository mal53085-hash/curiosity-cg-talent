import "server-only";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AiReviewEligibility, CandidatePortfolioImage } from "@/types/portfolio";

export async function getCandidatePortfolio(candidateId: string) {
  await requireUser();
  const supabase = await createClient();
  const [{ data, error }, { data: eligibilityData, error: eligibilityError }] = await Promise.all([
    supabase.from("candidate_portfolio_images").select("*").eq("candidate_id", candidateId).order("image_order"),
    supabase.from("candidate_ai_review_eligibility").select("eligible,reasons").eq("candidate_id", candidateId).maybeSingle(),
  ]);
  if (error) throw new Error(`作品画像を取得できませんでした: ${error.message}`);
  if (eligibilityError) throw new Error(`AI評価可否を取得できませんでした: ${eligibilityError.message}`);
  const images = (data ?? []) as CandidatePortfolioImage[];
  const paths = images.flatMap((image) => image.storage_path ? [image.storage_path] : []);
  const signed = paths.length ? await supabase.storage.from("candidate-portfolio-images").createSignedUrls(paths, 60 * 60) : { data: [] };
  const urls = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl ?? null]));
  return {
    images: images.map((image) => ({ ...image, preview_url: image.storage_path ? urls.get(image.storage_path) ?? null : image.external_url })),
    eligibility: (eligibilityData ?? { eligible: false, reasons: ["AI評価条件を確認できません"] }) as AiReviewEligibility,
  };
}
