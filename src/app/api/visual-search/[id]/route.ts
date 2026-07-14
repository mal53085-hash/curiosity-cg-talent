import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store, private", Pragma: "no-cache" };
const json = (body: object, status = 200) => Response.json(body, { status, headers });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return json({ error: "不正なリクエストです。" }, 403);
  const { id } = await params; const body = z.object({ name: z.string().trim().min(1).max(160) }).safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !body.success) return json({ error: "検索名は1〜160文字で入力してください。" }, 400);
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return json({ error: "ログインが必要です。" }, 401);
  const { data, error } = await supabase.from("visual_searches").update({ name: body.data.name, updated_at: new Date().toISOString() }).eq("id", id).eq("created_by", auth.user.id).select("id,name").maybeSingle();
  if (error || !data) return json({ error: "検索名を変更できませんでした。" }, 404);
  return json(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 }); const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "検索IDが不正です。" }, { status: 400 });
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const { data: search } = await supabase.from("visual_searches").select("id").eq("id", id).eq("created_by", auth.user.id).maybeSingle(); if (!search) return Response.json({ error: "検索が見つかりません。" }, { status: 404 });
  const { count } = await supabase.from("visual_search_images").select("id", { count: "exact", head: true }).eq("search_id", id);
  await supabase.from("audit_events").insert({ event_type: "visual_search.deleted", resource_type: "visual_search", resource_id: id, metadata: { feature_records_deleted: count ?? 0, stored_images_deleted: 0, privacy_mode: true }, actor_id: auth.user.id });
  const { error } = await supabase.from("visual_searches").delete().eq("id", id); if (error) return Response.json({ error: "検索を削除できませんでした。" }, { status: 500 });
  return json({ deleted: true, feature_records_deleted: count ?? 0, stored_images_deleted: 0 });
}
