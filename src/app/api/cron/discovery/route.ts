import { createAdminClient } from "@/lib/supabase/admin";
import { runDiscoverySource } from "@/lib/discovery/runner";
import type { DiscoverySource } from "@/types/discovery";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("discovery_sources").select("*").eq("enabled", true).order("last_run_at", { ascending: true, nullsFirst: true }).limit(5);
    if (error) throw new Error(error.message);
    const results = [];
    for (const source of (data ?? []) as DiscoverySource[]) results.push({ sourceId: source.id, ...(await runDiscoverySource(admin, source)) });
    return Response.json({ ok: true, processed: results.length, results });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Discovery Cronに失敗しました。" }, { status: 500 });
  }
}
