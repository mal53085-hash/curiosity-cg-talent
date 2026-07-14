import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  kind: z.enum(["candidates", "discovery"]), ids: z.array(z.string().uuid()).min(1).max(50),
  field: z.enum(["skills", "software", "languages", "country", "employment_types", "work_location_preferences", "tags", "project_fit_tags"]),
  values: z.array(z.string().trim().min(1).max(100)).min(1).max(30),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "入力内容を確認してください。" }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const table = parsed.data.kind === "candidates" ? "candidates" : "discovery_items";
  const { data: rows, error } = await supabase.from(table).select(`id,${parsed.data.field}`).in("id", parsed.data.ids);
  if (error || !rows || rows.length !== parsed.data.ids.length) return Response.json({ error: "対象を確認できませんでした。" }, { status: 404 });
  for (const row of rows as Array<Record<string, unknown>>) {
    const update = parsed.data.field === "country"
      ? { country: parsed.data.values[0], updated_by: auth.user.id }
      : { [parsed.data.field]: Array.from(new Set([...(Array.isArray(row[parsed.data.field]) ? row[parsed.data.field] as string[] : []), ...parsed.data.values])).slice(0, 50), updated_by: auth.user.id };
    const { error: updateError } = await supabase.from(table).update(update).eq("id", String(row.id));
    if (updateError) return Response.json({ error: "一部の更新に失敗しました。" }, { status: 500 });
  }
  return Response.json({ updated: rows.length });
}
