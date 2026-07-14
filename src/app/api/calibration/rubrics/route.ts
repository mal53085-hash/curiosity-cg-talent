import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

const axisKeys = ["composition", "lighting", "materials", "luxury_brand_fit", "interior_understanding", "detail", "finish", "technical_adaptability", "hospitality_fit", "retail_fit", "artificial_lighting", "design_understanding"] as const;
const axisSchema = z.object({
  key: z.enum(axisKeys), label: z.string().trim().min(1).max(80), description: z.string().trim().min(1).max(1000),
  good_example: z.string().trim().min(1).max(1000), concern_example: z.string().trim().min(1).max(1000),
  weight: z.number().int().min(1).max(50), required: z.boolean(),
}).strict();
const requestSchema = z.object({ rubric_id: z.string().uuid(), axes: z.array(axisSchema).length(12), change_note: z.string().trim().min(1).max(2000) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const supabase = await createClient(); const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "12軸の入力内容を確認してください。" }, { status: 400 });
  if (new Set(parsed.data.axes.map((axis) => axis.key)).size !== 12) return Response.json({ error: "評価軸が重複しています。" }, { status: 400 });
  if (parsed.data.axes.reduce((sum, axis) => sum + axis.weight, 0) !== 100) return Response.json({ error: "重みの合計を100にしてください。" }, { status: 400 });
  const { data: latest, error: latestError } = await supabase.from("evaluation_rubric_versions").select("version").eq("rubric_id", parsed.data.rubric_id).order("version", { ascending: false }).limit(1).maybeSingle();
  if (latestError) return Response.json({ error: "現在のversionを確認できませんでした。" }, { status: 500 });
  const version = (latest?.version ?? 0) + 1;
  const { data, error } = await supabase.from("evaluation_rubric_versions").insert({ rubric_id: parsed.data.rubric_id, version, axes: parsed.data.axes, change_note: parsed.data.change_note, published_by: auth.user.id }).select("id,version").single();
  if (error) return Response.json({ error: "新しい評価基準versionを保存できませんでした。" }, { status: 500 });
  await supabase.from("audit_events").insert({ event_type: "evaluation_rubric.published", resource_type: "evaluation_rubric", resource_id: parsed.data.rubric_id, metadata: { rubric_version_id: data.id, version }, actor_id: auth.user.id });
  return Response.json(data, { status: 201 });
}
