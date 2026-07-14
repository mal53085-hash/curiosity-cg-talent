import "server-only";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Candidate } from "@/types/candidate";

export const qualityFieldLabels: Record<string, string> = {
  name: "名前", public_profile: "公開プロフィール", source_url: "ソースURL",
  portfolio_images: "作品画像", portfolio_images_3: "作品画像を3枚以上", skills: "スキル",
  software: "使用ソフト", languages: "言語", region: "地域", employment_types: "契約形態",
  work_location_preferences: "勤務地希望", ai_evaluation: "AI本評価", ai_8_axes: "8軸評価",
  recommended_projects: "推奨案件", strengths_concerns: "強み・懸念",
};

export async function getDataQualityOverview() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("candidates").select([
    "id", "full_name", "public_profile", "portfolio_url", "source_url", "image_path", "work_image_count",
    "skills", "software", "languages", "country", "employment_types", "work_location_preferences",
    "ai_score", "ai_scores", "data_quality_score", "data_quality_missing",
  ].join(",")).order("data_quality_score", { ascending: true });
  if (error) throw new Error(`データ品質を取得できませんでした: ${error.message}`);
  const candidates = (data ?? []) as unknown as Candidate[];
  const count = (predicate: (candidate: Candidate) => boolean) => candidates.filter(predicate).length;
  const metrics = {
    total: candidates.length,
    ai_evaluated: count((c) => c.ai_score !== null),
    with_images: count((c) => c.work_image_count > 0 || Boolean(c.image_path)),
    public_profile: count((c) => Boolean(c.public_profile || c.portfolio_url)),
    skills: count((c) => c.skills.length > 0),
    software: count((c) => c.software.length > 0),
    languages: count((c) => c.languages.length > 0),
    work_location: count((c) => c.work_location_preferences.length > 0),
    scout_ready: count((c) => c.data_quality_score >= 70 && c.ai_score !== null),
    insufficient: count((c) => c.data_quality_score < 70),
  };
  return { metrics, candidates };
}
