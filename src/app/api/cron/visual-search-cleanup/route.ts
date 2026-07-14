import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs"; export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim(); if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const admin = createAdminClient();
  try {
    const { data: searches, error } = await admin.from("visual_searches").select("id,created_by,visual_search_images(storage_path)").lte("expires_at", new Date().toISOString()).limit(100); if (error) throw new Error("EXPIRED_QUERY_FAILED");
    let imagesDeleted = 0;
    for (const search of searches ?? []) {
      const paths = (search.visual_search_images ?? []).map((row: { storage_path: string }) => row.storage_path); if (paths.length) { const { error: removeError } = await admin.storage.from("visual-search-references").remove(paths); if (removeError) throw new Error("REFERENCE_DELETE_FAILED"); imagesDeleted += paths.length; }
      const prefix = `${search.created_by}/${search.id}`; const { data: quarantine } = await admin.storage.from("visual-search-quarantine").list(prefix); if (quarantine?.length) await admin.storage.from("visual-search-quarantine").remove(quarantine.map((item) => `${prefix}/${item.name}`));
      await admin.from("audit_events").insert({ event_type: "visual_search.expired", resource_type: "visual_search", resource_id: search.id, metadata: { images_deleted: paths.length, retention_days: 30 }, actor_id: null });
      const { error: deleteError } = await admin.from("visual_searches").delete().eq("id", search.id); if (deleteError) throw new Error("SEARCH_DELETE_FAILED");
    }
    return Response.json({ ok: true, searches_deleted: searches?.length ?? 0, images_deleted: imagesDeleted });
  } catch { return Response.json({ ok: false, error: "Visual Search cleanup failed" }, { status: 500 }); }
}
