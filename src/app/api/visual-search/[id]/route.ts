import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 }); const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "検索IDが不正です。" }, { status: 400 });
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const { data: search } = await supabase.from("visual_searches").select("id").eq("id", id).eq("created_by", auth.user.id).maybeSingle(); if (!search) return Response.json({ error: "検索が見つかりません。" }, { status: 404 });
  const { data: images } = await supabase.from("visual_search_images").select("storage_path").eq("search_id", id); const paths = (images ?? []).map((row) => row.storage_path);
  if (paths.length) { const { error } = await supabase.storage.from("visual-search-references").remove(paths); if (error) return Response.json({ error: "保存画像を削除できませんでした。" }, { status: 500 }); }
  const prefix = `${auth.user.id}/${id}`; const { data: quarantine } = await supabase.storage.from("visual-search-quarantine").list(prefix); if (quarantine?.length) await supabase.storage.from("visual-search-quarantine").remove(quarantine.map((item) => `${prefix}/${item.name}`));
  await supabase.from("audit_events").insert({ event_type: "visual_search.deleted", resource_type: "visual_search", resource_id: id, metadata: { image_count: paths.length }, actor_id: auth.user.id });
  const { error } = await supabase.from("visual_searches").delete().eq("id", id); if (error) return Response.json({ error: "検索を削除できませんでした。" }, { status: 500 });
  return Response.json({ deleted: true });
}
