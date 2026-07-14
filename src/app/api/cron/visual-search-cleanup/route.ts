import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs"; export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim(); if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const admin = createAdminClient();
  try {
    const { data: searches, error } = await admin.from("visual_searches").select("id,visual_search_images(id)").lte("expires_at", new Date().toISOString()).limit(100); if (error) throw new Error("EXPIRED_QUERY_FAILED");
    let featuresDeleted = 0;
    for (const search of searches ?? []) {
      const featureCount = search.visual_search_images?.length ?? 0; featuresDeleted += featureCount;
      await admin.from("audit_events").insert({ event_type: "visual_search.expired", resource_type: "visual_search", resource_id: search.id, metadata: { feature_records_deleted: featureCount, stored_images_deleted: 0, privacy_mode: true, retention_days: 30 }, actor_id: null });
      const { error: deleteError } = await admin.from("visual_searches").delete().eq("id", search.id); if (deleteError) throw new Error("SEARCH_DELETE_FAILED");
    }
    return Response.json({ ok: true, searches_deleted: searches?.length ?? 0, feature_records_deleted: featuresDeleted, stored_images_deleted: 0 }, { headers: { "Cache-Control": "no-store, private", Pragma: "no-cache" } });
  } catch { return Response.json({ ok: false, error: "Visual Search cleanup failed" }, { status: 500 }); }
}
