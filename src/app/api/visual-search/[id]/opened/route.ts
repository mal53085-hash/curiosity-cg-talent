import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "no-store, private", Pragma: "no-cache" };
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403, headers });
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "検索IDが不正です。" }, { status: 400, headers });
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401, headers });
  const { data: search } = await supabase.from("visual_searches").select("id").eq("id", id).eq("created_by", auth.user.id).maybeSingle();
  if (!search) return Response.json({ error: "検索が見つかりません。" }, { status: 404, headers });
  await supabase.from("audit_events").insert({ event_type: "visual_search.opened", resource_type: "visual_search", resource_id: id, actor_id: auth.user.id, metadata: { privacy_mode: true } });
  return Response.json({ recorded: true }, { headers });
}

