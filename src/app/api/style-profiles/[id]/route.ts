import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ name: z.string().trim().min(1).max(160).optional(), description: z.string().trim().max(2000).optional(), status: z.enum(["active", "archived"]).optional() }).refine((value) => Object.keys(value).length > 0);
const headers = { "Cache-Control": "no-store, private", Pragma: "no-cache" };
const json = (body: object, status = 200) => Response.json(body, { status, headers });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return json({ error: "不正なリクエストです。" }, 403);
  const { id } = await params; const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return json({ error: "更新内容が不正です。" }, 400);
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return json({ error: "ログインが必要です。" }, 401);
  const { data, error } = await supabase.from("style_profiles").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", id).eq("created_by", auth.user.id).select("id,status").maybeSingle();
  if (error || !data) return json({ error: error?.code === "23505" ? "同名のStyle Profileが既にあります。" : "Style Profileを更新できませんでした。" }, error?.code === "23505" ? 409 : 404);
  const eventType = parsed.data.status === "archived" ? "style_profile.archived" : "style_profile.updated";
  await supabase.from("audit_events").insert({ event_type: eventType, resource_type: "style_profile", resource_id: id, actor_id: auth.user.id, metadata: { changed_fields: Object.keys(parsed.data) } });
  return json({ id, status: data.status });
}

