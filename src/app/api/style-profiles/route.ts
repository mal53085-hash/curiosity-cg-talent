import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { aggregateVisualFeatures, buildVisualFeatureVector } from "@/lib/visual-search/features";
import { buildEvaluationWeights } from "@/lib/visual-search/reference-analysis";
import { createClient } from "@/lib/supabase/server";
import { visualFeaturesSchema } from "@/types/visual-search";

const requestSchema = z.object({
  search_id: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(""),
});
const headers = { "Cache-Control": "no-store, private", Pragma: "no-cache" };
const json = (body: object, status = 200) => Response.json(body, { status, headers });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "不正なリクエストです。" }, 403);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Style Profileの入力内容を確認してください。" }, 400);
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: "ログインが必要です。" }, 401);
  const [{ data: search }, { data: rows }] = await Promise.all([
    supabase.from("visual_searches").select("id,priority_criteria,style_profile_id").eq("id", parsed.data.search_id).eq("created_by", auth.user.id).maybeSingle(),
    supabase.from("visual_search_images").select("visual_features,processing_model_version,processing_timestamp,storage_path").eq("search_id", parsed.data.search_id).order("image_index"),
  ]);
  if (!search || !rows?.length) return json({ error: "保存できる派生特徴量が見つかりません。" }, 404);
  if (search.style_profile_id) return json({ error: "この検索は既にStyle Profileへ保存されています。" }, 409);
  if (rows.some((row) => row.storage_path !== null)) return json({ error: "Privacy Modeに適合しない検索は保存できません。" }, 409);
  const parsedFeatures = rows.map((row) => visualFeaturesSchema.safeParse(row.visual_features));
  if (parsedFeatures.some((result) => !result.success)) return json({ error: "保存済み特徴量を検証できませんでした。" }, 422);
  const derived = aggregateVisualFeatures(parsedFeatures.map((result) => result.data!));
  const vector = buildVisualFeatureVector(derived);
  const modelVersion = rows.map((row) => row.processing_model_version).filter(Boolean).at(-1) ?? "unknown";
  const { data: profile, error: profileError } = await supabase.from("style_profiles").insert({ name: parsed.data.name, description: parsed.data.description, created_by: auth.user.id }).select("id,name").single();
  if (profileError || !profile) return json({ error: profileError?.code === "23505" ? "同名のStyle Profileが既にあります。" : "Style Profileを作成できませんでした。" }, profileError?.code === "23505" ? 409 : 500);
  const { error: versionError } = await supabase.from("style_profile_versions").insert({ profile_id: profile.id, version_number: 1, source_visual_search_id: search.id, derived_features: derived, feature_vector: vector, evaluation_weights: buildEvaluationWeights(search.priority_criteria), model_version: modelVersion, created_by: auth.user.id });
  if (versionError) { await supabase.from("style_profiles").delete().eq("id", profile.id); return json({ error: "Style Profileのバージョンを保存できませんでした。" }, 500); }
  const { error: linkError } = await supabase.from("visual_searches").update({ style_profile_id: profile.id, updated_at: new Date().toISOString() }).eq("id", search.id).eq("created_by", auth.user.id);
  if (linkError) { await supabase.from("style_profiles").delete().eq("id", profile.id); return json({ error: "検索とStyle Profileを関連付けできませんでした。" }, 500); }
  const { error: auditError } = await supabase.from("audit_events").insert({ event_type: "style_profile.created", resource_type: "style_profile", resource_id: profile.id, actor_id: auth.user.id, metadata: { source_visual_search_id: search.id, version: 1, privacy_mode: true, original_images_used: 0 } });
  if (auditError) { await supabase.from("style_profiles").delete().eq("id", profile.id); return json({ error: "Style Profileの監査記録を保存できませんでした。" }, 500); }
  return json({ id: profile.id, name: profile.name }, 201);
}

