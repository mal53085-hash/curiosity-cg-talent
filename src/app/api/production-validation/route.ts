import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ checklist_id: z.string().uuid(), status: z.enum(["not_run", "passed", "failed", "recheck"]), evidence_note: z.string().max(5000) });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const supabase = await createClient(); const { data: auth, error: authError } = await supabase.auth.getUser(); if (authError || !auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "検証結果を確認してください。" }, { status: 400 });
  const { data: checklist } = await supabase.from("validation_checklists").select("id,code").eq("id", parsed.data.checklist_id).eq("is_active", true).maybeSingle(); if (!checklist) return Response.json({ error: "チェック項目が見つかりません。" }, { status: 404 });
  const { data, error } = await supabase.from("validation_checklist_runs").insert({ checklist_id: checklist.id, status: parsed.data.status, evidence_note: parsed.data.evidence_note.trim() || null, verified_by: auth.user.id }).select("id,verified_at").single(); if (error) return Response.json({ error: "検証結果を保存できませんでした。" }, { status: 500 });
  await supabase.from("audit_events").insert({ event_type: "production_validation.recorded", resource_type: "validation_checklist", resource_id: checklist.id, metadata: { run_id: data.id, code: checklist.code, status: parsed.data.status }, actor_id: auth.user.id });
  return Response.json(data, { status: 201 });
}
