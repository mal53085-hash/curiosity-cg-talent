import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

const noStore = { "Cache-Control": "no-store, private", Pragma: "no-cache" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: noStore });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return json({ error: "不正なリクエストです。" }, 403);
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) return json({ error: "検索IDが不正です。" }, 400);
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return json({ error: "ログインが必要です。" }, 401);
  const [{ data: search }, { data: features }] = await Promise.all([
    supabase.from("visual_searches").select("name,project_type,brand_tone,space_type,time_of_day,priority_criteria,additional_conditions,rights_confirmed,reference_count").eq("id", id).eq("created_by", auth.user.id).maybeSingle(),
    supabase.from("visual_search_images").select("image_index,visual_features,analysis_model,analyzed_at,lighting_features,composition_features,material_features,brand_tone,space_type,camera_characteristics,ai_feature_vector,processing_timestamp,processing_model_version,source_discarded_at,analysis_input_tokens,analysis_output_tokens").eq("search_id", id).order("image_index"),
  ]);
  if (!search || !features?.length) return json({ error: "複製できる特徴量が見つかりません。" }, 404);
  const { data: copy, error } = await supabase.from("visual_searches").insert({ ...search, name: `${search.name.slice(0, 150)} copy`, privacy_mode: true, reference_processing_status: "ready", expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(), created_by: auth.user.id }).select("id").single();
  if (error || !copy) return json({ error: "検索を複製できませんでした。" }, 500);
  const { error: featureError } = await supabase.from("visual_search_images").insert(features.map((feature) => ({ ...feature, search_id: copy.id, privacy_mode: true, storage_path: null, mime_type: null, size_bytes: null, width: null, height: null, sha256: null })));
  if (featureError) { await supabase.from("visual_searches").delete().eq("id", copy.id); return json({ error: "特徴量を複製できませんでした。" }, 500); }
  const { error: auditError } = await supabase.from("audit_events").insert({ event_type: "visual_search.duplicated", resource_type: "visual_search", resource_id: copy.id, actor_id: auth.user.id, metadata: { source_search_id: id, feature_records_copied: features.length, stored_images_copied: 0, privacy_mode: true } });
  if (auditError) { await supabase.from("visual_searches").delete().eq("id", copy.id); return json({ error: "複製の監査記録を保存できませんでした。" }, 500); }
  return json({ id: copy.id });
}
