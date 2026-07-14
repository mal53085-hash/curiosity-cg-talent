import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { analyzeReferenceImages, visualSearchModel } from "@/lib/ai/visual-search";
import { featureRecord } from "@/lib/visual-search/features";
import { MAX_TRANSIENT_VISUAL_BYTES, sanitizeVisualImage } from "@/lib/visual-search/image";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;
const noStore = { "Cache-Control": "no-store, private", Pragma: "no-cache" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: noStore });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return json({ error: "不正なリクエストです。" }, 403);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return json({ error: "検索IDが不正です。" }, 400);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: "ログインが必要です。" }, 401);
  const { data: search } = await supabase.from("visual_searches").select("id,project_type,brand_tone,space_type,time_of_day,priority_criteria,additional_conditions,reference_count").eq("id", id).eq("created_by", auth.user.id).maybeSingle();
  if (!search) return json({ error: "検索が見つかりません。" }, 404);

  const form = await request.formData().catch(() => null);
  const reference = form?.get("reference");
  const position = Number(form?.get("position"));
  if (!(reference instanceof File) || !Number.isInteger(position) || position < 0 || position >= search.reference_count || position > 4) return json({ error: "参考画像が不正です。" }, 400);
  if (!reference.size || reference.size > MAX_TRANSIENT_VISUAL_BYTES) return json({ error: "解析用画像の送信サイズが上限を超えています。" }, 413);

  const { count: existing } = await supabase.from("visual_search_images").select("id", { count: "exact", head: true }).eq("search_id", id).eq("image_index", position);
  if (existing) return json({ error: "この参考画像は処理済みです。" }, 409);
  await supabase.from("visual_searches").update({ reference_processing_status: "processing" }).eq("id", id);

  let source: Buffer | undefined;
  let sanitized: Awaited<ReturnType<typeof sanitizeVisualImage>> | undefined;
  const processedAt = new Date().toISOString();
  try {
    source = Buffer.from(await reference.arrayBuffer());
    sanitized = await sanitizeVisualImage(source);
    const context = { project_type: search.project_type, brand_tone: search.brand_tone, space_type: search.space_type, time_of_day: search.time_of_day, priority_criteria: search.priority_criteria, additional_conditions: search.additional_conditions };
    const analyzed = await analyzeReferenceImages([sanitized.buffer], context, auth.user.id);
    const { data: record, error } = await supabase.from("visual_search_images").insert({
      search_id: id, image_index: position, privacy_mode: true, storage_path: null, mime_type: null, size_bytes: null, width: null, height: null, sha256: null,
      ...featureRecord(analyzed.features), analysis_model: visualSearchModel, analyzed_at: processedAt,
      processing_timestamp: processedAt, processing_model_version: visualSearchModel, source_discarded_at: processedAt,
      analysis_input_tokens: analyzed.inputTokens, analysis_output_tokens: analyzed.outputTokens,
    }).select("id").single();
    if (error || !record) throw new Error("FEATURE_SAVE_FAILED");
    const { count } = await supabase.from("visual_search_images").select("id", { count: "exact", head: true }).eq("search_id", id);
    await supabase.from("visual_searches").update({ reference_processing_status: count === search.reference_count ? "ready" : "processing" }).eq("id", id);
    const { error: auditError } = await supabase.from("audit_events").insert({
      event_type: "visual_reference.discarded", resource_type: "visual_search", resource_id: id, actor_id: auth.user.id,
      metadata: { feature_record_id: record.id, image_index: position, processing_timestamp: processedAt, processing_model_version: visualSearchModel, source_retained: false, thumbnail_retained: false, exif_retained: false, storage_object_created: false, disposal: "in_memory_zeroized" },
    });
    if (auditError) { await supabase.from("visual_search_images").delete().eq("id", record.id); throw new Error("AUDIT_SAVE_FAILED"); }
    return json({ processed: true, image_index: position, feature_record_id: record.id, source_discarded: true, input_tokens: analyzed.inputTokens, output_tokens: analyzed.outputTokens });
  } catch (error) {
    await supabase.from("visual_searches").update({ reference_processing_status: "failed" }).eq("id", id);
    await supabase.from("audit_events").insert({ event_type: "visual_reference.processing_failed", resource_type: "visual_search", resource_id: id, actor_id: auth.user.id, metadata: { image_index: position, source_retained: false, storage_object_created: false, disposal: "in_memory_zeroized" } });
    const code = error instanceof Error ? error.message : "IMAGE_FAILED";
    const message = code === "IMAGE_SIZE_INVALID" ? "画像は8MB以下にしてください。" : code === "IMAGE_FORMAT_INVALID" ? "JPEG、PNG、WebPのみ使用できます。SVGは使用できません。" : code === "IMAGE_DECODE_INVALID" ? "画像を安全にデコードできませんでした。" : code === "FEATURE_SAVE_FAILED" || code === "AUDIT_SAVE_FAILED" ? "特徴量または監査記録を保存できませんでした。" : "画像解析を一時的に利用できません。元画像は保存されていません。";
    return json({ error: message, source_discarded: true }, code === "FEATURE_SAVE_FAILED" || code === "AUDIT_SAVE_FAILED" ? 500 : 503);
  } finally {
    sanitized?.buffer.fill(0);
    source?.fill(0);
  }
}
