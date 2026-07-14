import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { featureRecord } from "@/lib/visual-search/features";
import { createClient } from "@/lib/supabase/server";
import { visualFeaturesSchema, visualFeatureVectorSchema } from "@/types/visual-search";

const bodySchema = z.object({ name: z.string().trim().min(1).max(160).optional() });
const headers = { "Cache-Control": "no-store, private", Pragma: "no-cache" };
const json = (body: object, status = 200) => Response.json(body, { status, headers });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return json({ error: "不正なリクエストです。" }, 403);
  const { id } = await params; const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return json({ error: "Style Profile IDが不正です。" }, 400);
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return json({ error: "ログインが必要です。" }, 401);
  const { data: profile } = await supabase.from("style_profiles").select("id,name,status").eq("id", id).eq("created_by", auth.user.id).maybeSingle();
  if (!profile || profile.status !== "active") return json({ error: "利用可能なStyle Profileが見つかりません。" }, 404);
  const { data: version } = await supabase.from("style_profile_versions").select("derived_features,feature_vector,evaluation_weights,model_version,created_at").eq("profile_id", id).eq("created_by", auth.user.id).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const features = visualFeaturesSchema.safeParse(version?.derived_features); const vector = visualFeatureVectorSchema.safeParse(version?.feature_vector);
  if (!version || !features.success || !vector.success) return json({ error: "Style Profileの特徴量を読み込めませんでした。" }, 422);
  const record = featureRecord(features.data);
  const { data: search, error } = await supabase.from("visual_searches").insert({ name: parsed.data.name ?? `${profile.name} rerank`, project_type: "Style Profile", brand_tone: features.data.brand_tones.join(" / ").slice(0, 200), space_type: features.data.space_types.join(" / ").slice(0, 120), time_of_day: features.data.time_of_day, priority_criteria: Object.keys(version.evaluation_weights as object), additional_conditions: "保存済みStyle Profileの派生特徴量だけで再ランキング", rights_confirmed: true, privacy_mode: true, reference_processing_status: "ready", reference_count: 1, style_profile_id: profile.id, created_by: auth.user.id }).select("id").single();
  if (error || !search) return json({ error: "Style Profile検索を作成できませんでした。" }, 500);
  const { error: featureError } = await supabase.from("visual_search_images").insert({ search_id: search.id, image_index: 0, privacy_mode: true, ...record, ai_feature_vector: vector.data, analysis_model: version.model_version, analyzed_at: version.created_at, processing_timestamp: version.created_at, processing_model_version: version.model_version, source_discarded_at: version.created_at });
  if (featureError) { await supabase.from("visual_searches").delete().eq("id", search.id); return json({ error: "Style Profile特徴量を検索へ適用できませんでした。" }, 500); }
  return json({ id: search.id }, 201);
}

