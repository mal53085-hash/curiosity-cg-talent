import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";
import { portfolioUsageStatuses } from "@/types/portfolio";

const idSchema = z.string().uuid();
const updateSchema = z.object({
  usage_status: z.enum(portfolioUsageStatuses),
  rights_note: z.string().max(2000),
  selected_for_ai_review: z.boolean(),
});

async function authorizedContext(request: Request, candidateId: string, imageId: string) {
  if (!isSameOrigin(request)) return { response: Response.json({ error: "不正なリクエストです。" }, { status: 403 }) };
  if (!idSchema.safeParse(candidateId).success || !idSchema.safeParse(imageId).success) return { response: Response.json({ error: "IDが不正です。" }, { status: 400 }) };
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { response: Response.json({ error: "ログインが必要です。" }, { status: 401 }) };
  const { data: image } = await supabase.from("candidate_portfolio_images").select("id,storage_path,usage_status").eq("id", imageId).eq("candidate_id", candidateId).maybeSingle();
  if (!image) return { response: Response.json({ error: "作品画像が見つかりません。" }, { status: 404 }) };
  return { supabase, user: auth.user, image };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const { id, imageId } = await params;
  const context = await authorizedContext(request, id, imageId);
  if ("response" in context) return context.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "画像の利用状態を確認してください。" }, { status: 400 });
  const allowed = ["review_copy_authorized", "internal_reference_authorized"].includes(parsed.data.usage_status);
  if (allowed && parsed.data.rights_note.trim().length < 3) return Response.json({ error: "許可根拠を権利メモに記録してください。" }, { status: 400 });
  if (parsed.data.selected_for_ai_review && (!allowed || !context.image.storage_path)) return Response.json({ error: "AI選択には許可済みの保存画像が必要です。リンクのみ・unknown画像は送信できません。" }, { status: 422 });
  const { error } = await context.supabase.from("candidate_portfolio_images").update({
    usage_status: parsed.data.usage_status, rights_note: parsed.data.rights_note.trim() || null,
    selected_for_ai_review: allowed && Boolean(context.image.storage_path) ? parsed.data.selected_for_ai_review : false,
    updated_at: new Date().toISOString(),
  }).eq("id", imageId);
  if (error) return Response.json({ error: "画像情報を更新できませんでした。" }, { status: 500 });
  await context.supabase.from("audit_events").insert({ event_type: "candidate_portfolio.rights_updated", resource_type: "candidate", resource_id: id, metadata: { image_id: imageId, usage_status: parsed.data.usage_status, selected_for_ai_review: parsed.data.selected_for_ai_review }, actor_id: context.user.id });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const { id, imageId } = await params;
  const context = await authorizedContext(request, id, imageId);
  if ("response" in context) return context.response;
  if (context.image.storage_path) {
    const { error: storageError } = await context.supabase.storage.from("candidate-portfolio-images").remove([context.image.storage_path]);
    if (storageError) return Response.json({ error: "Storage画像を削除できませんでした。" }, { status: 500 });
  }
  const { error } = await context.supabase.from("candidate_portfolio_images").delete().eq("id", imageId);
  if (error) return Response.json({ error: "画像情報を削除できませんでした。" }, { status: 500 });
  await context.supabase.from("audit_events").insert({ event_type: "candidate_portfolio.image_deleted", resource_type: "candidate", resource_id: id, metadata: { image_id: imageId, storage_deleted: Boolean(context.image.storage_path) }, actor_id: context.user.id });
  return Response.json({ ok: true });
}
