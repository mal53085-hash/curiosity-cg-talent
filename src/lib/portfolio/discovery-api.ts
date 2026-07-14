import "server-only";

import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { normalizeCandidateUrl } from "@/lib/acquisition/import";
import { assertPublicUrl } from "@/lib/discovery/safe-web";
import { createClient } from "@/lib/supabase/server";
import { sanitizeVisualImage } from "@/lib/visual-search/image";
import { portfolioUsageStatuses, type PortfolioUsageStatus } from "@/types/portfolio";

const idSchema = z.string().uuid();

async function context(request: Request, discoveryId: string, imageId?: string) {
  if (!isSameOrigin(request)) return { response: Response.json({ error: "不正なリクエストです。" }, { status: 403 }) };
  if (!idSchema.safeParse(discoveryId).success || imageId && !idSchema.safeParse(imageId).success) return { response: Response.json({ error: "IDが不正です。" }, { status: 400 }) };
  const supabase = await createClient(); const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { response: Response.json({ error: "ログインが必要です。" }, { status: 401 }) };
  const { data: discovery } = await supabase.from("discovery_items").select("id").eq("id", discoveryId).maybeSingle();
  if (!discovery) return { response: Response.json({ error: "調査候補が見つかりません。" }, { status: 404 }) };
  if (imageId) {
    const { data: image } = await supabase.from("candidate_portfolio_images").select("id,storage_path").eq("id", imageId).eq("discovery_item_id", discoveryId).maybeSingle();
    if (!image) return { response: Response.json({ error: "作品画像が見つかりません。" }, { status: 404 }) };
    return { supabase, user: auth.user, image };
  }
  const { data: existing } = await supabase.from("candidate_portfolio_images").select("image_order").eq("discovery_item_id", discoveryId);
  if ((existing ?? []).length >= 12) return { response: Response.json({ error: "作品画像は候補者ごとに12枚までです。" }, { status: 422 }) };
  const used = new Set((existing ?? []).map((item) => item.image_order)); const order = Array.from({ length: 12 }, (_, index) => index + 1).find((value) => !used.has(value)) ?? 12;
  return { supabase, user: auth.user, order };
}

export async function createDiscoveryPortfolioImage(request: Request, discoveryId: string) {
  const auth = await context(request, discoveryId); if ("response" in auth) return auth.response;
  const { supabase, user, order } = auth;
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    const parsed = z.object({ external_url: z.string().url().max(2048), source_page_url: z.string().url().max(2048), rights_note: z.string().max(2000).optional() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "画像URLと出典ページURLを確認してください。" }, { status: 400 });
    try {
      const externalUrl = normalizeCandidateUrl(parsed.data.external_url); const sourcePageUrl = normalizeCandidateUrl(parsed.data.source_page_url);
      await Promise.all([assertPublicUrl(externalUrl), assertPublicUrl(sourcePageUrl)]);
      const { data, error } = await supabase.from("candidate_portfolio_images").insert({ discovery_item_id: discoveryId, external_url: externalUrl, source_url: externalUrl, source_page_url: sourcePageUrl, usage_status: "link_only", rights_note: parsed.data.rights_note?.trim() || "リンク参照のみ。保存・AI送信は未許可。", selected_for_ai_review: false, image_order: order, created_by: user.id }).select("id").single();
      if (error) throw error;
      return Response.json({ id: data.id }, { status: 201 });
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "画像リンクを登録できませんでした。" }, { status: 400 }); }
  }
  const form = await request.formData().catch(() => null); const file = form?.get("image"); const usage = String(form?.get("usage_status") ?? "unknown") as PortfolioUsageStatus; const rightsNote = String(form?.get("rights_note") ?? "").trim(); const sourcePageRaw = String(form?.get("source_page_url") ?? "").trim();
  if (!(file instanceof File) || !file.size) return Response.json({ error: "画像を選択してください。" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: "画像は8MB以下にしてください。" }, { status: 413 });
  if (!portfolioUsageStatuses.includes(usage) || usage === "link_only") return Response.json({ error: "利用状態を確認してください。" }, { status: 400 });
  if (usage !== "unknown" && rightsNote.length < 3) return Response.json({ error: "許可根拠を権利メモに記録してください。" }, { status: 400 });
  let sourcePageUrl: string | null = null; try { sourcePageUrl = sourcePageRaw ? normalizeCandidateUrl(sourcePageRaw) : null; } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "出典URLが不正です。" }, { status: 400 }); }
  let storagePath: string | null = null;
  try {
    const sanitized = await sanitizeVisualImage(await file.arrayBuffer()); storagePath = `${user.id}/${discoveryId}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabase.storage.from("candidate-portfolio-images").upload(storagePath, sanitized.buffer, { contentType: sanitized.mime, upsert: false }); if (uploadError) throw new Error("作品画像を保存できませんでした。");
    const { data, error } = await supabase.from("candidate_portfolio_images").insert({ discovery_item_id: discoveryId, storage_path: storagePath, source_url: sourcePageUrl, source_page_url: sourcePageUrl, usage_status: usage, rights_note: rightsNote || null, selected_for_ai_review: usage !== "unknown", image_order: order, content_type: sanitized.mime, byte_size: sanitized.buffer.byteLength, content_sha256: sanitized.sha256, created_by: user.id }).select("id").single(); if (error) throw new Error("作品画像情報を保存できませんでした。");
    await supabase.from("audit_events").insert({ event_type: "discovery_portfolio.image_uploaded", resource_type: "discovery_item", resource_id: discoveryId, metadata: { image_id: data.id, usage_status: usage, exif_removed: true }, actor_id: user.id });
    return Response.json({ id: data.id }, { status: 201 });
  } catch (error) {
    if (storagePath) await supabase.storage.from("candidate-portfolio-images").remove([storagePath]);
    const code = error instanceof Error ? error.message : ""; const message = code === "IMAGE_FORMAT_INVALID" ? "JPEG、PNG、WebPのみ使用できます。SVGは使用できません。" : code === "IMAGE_DECODE_INVALID" ? "画像を安全にデコードできませんでした。" : code || "画像を保存できませんでした。";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function updateDiscoveryPortfolioImage(request: Request, discoveryId: string, imageId: string) {
  const auth = await context(request, discoveryId, imageId); if ("response" in auth) return auth.response;
  const image = auth.image!;
  const parsed = z.object({ usage_status: z.enum(portfolioUsageStatuses), rights_note: z.string().max(2000), selected_for_ai_review: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "利用状態を確認してください。" }, { status: 400 });
  const allowed = ["review_copy_authorized", "internal_reference_authorized"].includes(parsed.data.usage_status);
  if (allowed && parsed.data.rights_note.trim().length < 3) return Response.json({ error: "許可根拠を記録してください。" }, { status: 400 });
  if (parsed.data.selected_for_ai_review && (!allowed || !image.storage_path)) return Response.json({ error: "AI選択には許可済みの保存画像が必要です。" }, { status: 422 });
  const { error } = await auth.supabase.from("candidate_portfolio_images").update({ usage_status: parsed.data.usage_status, rights_note: parsed.data.rights_note.trim() || null, selected_for_ai_review: allowed && Boolean(image.storage_path) ? parsed.data.selected_for_ai_review : false, updated_at: new Date().toISOString() }).eq("id", imageId);
  if (error) return Response.json({ error: "画像情報を更新できませんでした。" }, { status: 500 });
  return Response.json({ ok: true });
}

export async function deleteDiscoveryPortfolioImage(request: Request, discoveryId: string, imageId: string) {
  const auth = await context(request, discoveryId, imageId); if ("response" in auth) return auth.response;
  const image = auth.image!;
  if (image.storage_path) { const { error } = await auth.supabase.storage.from("candidate-portfolio-images").remove([image.storage_path]); if (error) return Response.json({ error: "Storage画像を削除できませんでした。" }, { status: 500 }); }
  const { error } = await auth.supabase.from("candidate_portfolio_images").delete().eq("id", imageId); if (error) return Response.json({ error: "画像情報を削除できませんでした。" }, { status: 500 });
  await auth.supabase.from("audit_events").insert({ event_type: "discovery_portfolio.image_deleted", resource_type: "discovery_item", resource_id: discoveryId, metadata: { image_id: imageId, storage_deleted: Boolean(image.storage_path) }, actor_id: auth.user.id });
  return Response.json({ ok: true });
}
