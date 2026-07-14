import { z } from "zod";
import { containsPromptInjection, isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ name: z.string().trim().min(1).max(160), project_type: z.string().trim().max(120), brand_tone: z.string().trim().max(200), space_type: z.string().trim().max(120), time_of_day: z.string().trim().max(80), priority_criteria: z.array(z.string().trim().min(1).max(100)).max(10), additional_conditions: z.string().trim().max(2000), rights_confirmed: z.literal(true), image_count: z.number().int().min(1).max(5) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "入力内容と権利確認を確認してください。" }, { status: 400 });
  if (containsPromptInjection(parsed.data.additional_conditions)) return Response.json({ error: "補足条件には案件要件だけを入力してください。" }, { status: 400 });
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const now = Date.now(); const tenMinutesAgo = new Date(now - 600_000).toISOString(); const today = new Date(); today.setUTCHours(0,0,0,0);
  const [{ count: recent }, { count: daily }] = await Promise.all([
    supabase.from("audit_events").select("id", { count: "exact", head: true }).eq("actor_id", auth.user.id).eq("event_type", "visual_search.created").gte("created_at", tenMinutesAgo),
    supabase.from("audit_events").select("id", { count: "exact", head: true }).eq("actor_id", auth.user.id).eq("event_type", "visual_search.created").gte("created_at", today.toISOString()),
  ]);
  const dailyLimit = Math.min(100, Math.max(1, Number.parseInt(process.env.VISUAL_SEARCH_DAILY_LIMIT ?? "10", 10) || 10));
  if ((recent ?? 0) >= 3) return Response.json({ error: "Visual Searchは10分あたり3回までです。" }, { status: 429 });
  if ((daily ?? 0) >= dailyLimit) return Response.json({ error: "本日のVisual Search上限に達しました。" }, { status: 429 });
  const { image_count, ...values } = parsed.data;
  const { data: search, error } = await supabase.from("visual_searches").insert({ ...values, privacy_mode: true, reference_count: image_count, expires_at: new Date(now + 30 * 86400_000).toISOString(), created_by: auth.user.id }).select("id,expires_at").single();
  if (error || !search) return Response.json({ error: "検索を作成できませんでした。" }, { status: 500 });
  await supabase.from("audit_events").insert({ event_type: "visual_search.created", resource_type: "visual_search", resource_id: search.id, metadata: { image_count, feature_retention_days: 30, privacy_mode: true, storage_object_created: false }, actor_id: auth.user.id });
  return Response.json({ id: search.id, expires_at: search.expires_at, privacy_mode: true, estimated_usage: { reference_images: image_count, candidate_rerank_max: 20, ai_calls: image_count + 1 } }, { headers: { "Cache-Control": "no-store, private", Pragma: "no-cache" } });
}
