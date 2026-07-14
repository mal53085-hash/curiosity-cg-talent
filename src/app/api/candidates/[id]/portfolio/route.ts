import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { normalizeCandidateUrl } from "@/lib/acquisition/import";
import { assertPublicUrl } from "@/lib/discovery/safe-web";
import { sanitizeVisualImage } from "@/lib/visual-search/image";
import { createClient } from "@/lib/supabase/server";
import { portfolioUsageStatuses } from "@/types/portfolio";

export const runtime = "nodejs";
export const maxDuration = 60;
const idSchema = z.string().uuid();
const linkSchema = z.object({
  external_url: z.string().url().max(2048),
  source_page_url: z.string().url().max(2048),
  rights_note: z.string().max(2000).optional(),
});

async function contextFor(request: Request, id: string) {
  if (!isSameOrigin(request)) return { response: Response.json({ error: "不正なリクエストです。" }, { status: 403 }) };
  if (!idSchema.safeParse(id).success) return { response: Response.json({ error: "候補者IDが不正です。" }, { status: 400 }) };
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { response: Response.json({ error: "ログインが必要です。" }, { status: 401 }) };
  const { data: candidate } = await supabase.from("candidates").select("id").eq("id", id).maybeSingle();
  if (!candidate) return { response: Response.json({ error: "候補者が見つかりません。" }, { status: 404 }) };
  const { data: existing, error } = await supabase.from("candidate_portfolio_images").select("image_order").eq("candidate_id", id);
  if (error) return { response: Response.json({ error: "作品画像を確認できませんでした。" }, { status: 500 }) };
  if ((existing ?? []).length >= 12) return { response: Response.json({ error: "作品画像は候補者ごとに12枚までです。" }, { status: 422 }) };
  const used = new Set((existing ?? []).map((item) => item.image_order));
  const order = Array.from({ length: 12 }, (_, index) => index + 1).find((value) => !used.has(value)) ?? 12;
  return { supabase, user: auth.user, order };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await contextFor(request, id);
  if ("response" in context) return context.response;
  const { supabase, user, order } = context;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const parsed = linkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "画像URLと出典ページURLを確認してください。" }, { status: 400 });
    try {
      const externalUrl = normalizeCandidateUrl(parsed.data.external_url);
      const sourcePageUrl = normalizeCandidateUrl(parsed.data.source_page_url);
      await Promise.all([assertPublicUrl(externalUrl), assertPublicUrl(sourcePageUrl)]);
      const { data, error } = await supabase.from("candidate_portfolio_images").insert({
        candidate_id: id, external_url: externalUrl, source_url: externalUrl, source_page_url: sourcePageUrl,
        usage_status: "link_only", rights_note: parsed.data.rights_note?.trim() || "リンク参照のみ。保存・AI送信は未許可。",
        selected_for_ai_review: false, image_order: order, created_by: user.id,
      }).select("id").single();
      if (error) throw error;
      await supabase.from("audit_events").insert({ event_type: "candidate_portfolio.link_added", resource_type: "candidate", resource_id: id, metadata: { image_id: data.id, usage_status: "link_only" }, actor_id: user.id });
      return Response.json({ id: data.id }, { status: 201 });
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "画像リンクを登録できませんでした。" }, { status: 400 }); }
  }

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "画像データが不正です。" }, { status: 400 });
  const file = form.get("image");
  const usage = String(form.get("usage_status") ?? "unknown");
  const rightsNote = String(form.get("rights_note") ?? "").trim();
  const sourcePageRaw = String(form.get("source_page_url") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "画像を選択してください。" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: "画像は8MB以下にしてください。" }, { status: 413 });
  if (!portfolioUsageStatuses.includes(usage as never) || usage === "link_only") return Response.json({ error: "アップロード画像の利用状態を確認してください。" }, { status: 400 });
  if (["review_copy_authorized", "internal_reference_authorized"].includes(usage) && rightsNote.length < 3) return Response.json({ error: "許可根拠を権利メモに記録してください。" }, { status: 400 });
  let sourcePageUrl: string | null = null;
  try { sourcePageUrl = sourcePageRaw ? normalizeCandidateUrl(sourcePageRaw) : null; } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "出典URLが不正です。" }, { status: 400 }); }
  let storagePath: string | null = null;
  try {
    const sanitized = await sanitizeVisualImage(await file.arrayBuffer());
    storagePath = `${user.id}/${id}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabase.storage.from("candidate-portfolio-images").upload(storagePath, sanitized.buffer, { contentType: sanitized.mime, upsert: false });
    if (uploadError) throw new Error("作品画像を保存できませんでした。");
    const { data, error } = await supabase.from("candidate_portfolio_images").insert({
      candidate_id: id, storage_path: storagePath, source_url: sourcePageUrl, source_page_url: sourcePageUrl,
      usage_status: usage, rights_note: rightsNote || null, selected_for_ai_review: usage !== "unknown",
      image_order: order, content_type: sanitized.mime, byte_size: sanitized.buffer.byteLength, content_sha256: sanitized.sha256,
      created_by: user.id,
    }).select("id").single();
    if (error) throw new Error("作品画像の情報を保存できませんでした。");
    await supabase.from("audit_events").insert({ event_type: "candidate_portfolio.image_uploaded", resource_type: "candidate", resource_id: id, metadata: { image_id: data.id, usage_status: usage, exif_removed: true }, actor_id: user.id });
    return Response.json({ id: data.id }, { status: 201 });
  } catch (error) {
    if (storagePath) await supabase.storage.from("candidate-portfolio-images").remove([storagePath]);
    const code = error instanceof Error ? error.message : "";
    const message = code === "IMAGE_SIZE_INVALID" ? "画像は8MB以下にしてください。" : code === "IMAGE_FORMAT_INVALID" ? "JPEG、PNG、WebPのみ使用できます。SVGは使用できません。" : code === "IMAGE_DECODE_INVALID" ? "画像を安全にデコードできませんでした。" : code || "画像を保存できませんでした。";
    return Response.json({ error: message }, { status: 400 });
  }
}
