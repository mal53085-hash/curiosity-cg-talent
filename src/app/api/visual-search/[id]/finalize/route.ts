import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { sanitizeVisualImage } from "@/lib/visual-search/image";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs"; export const maxDuration = 60;
const schema = z.object({ paths: z.array(z.string().min(1).max(500)).min(1).max(5) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "検索IDが不正です。" }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "画像は1〜5枚です。" }, { status: 400 });
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const { data: search } = await supabase.from("visual_searches").select("id").eq("id", id).eq("created_by", auth.user.id).maybeSingle(); if (!search) return Response.json({ error: "検索が見つかりません。" }, { status: 404 });
  const prefix = `${auth.user.id}/${id}/`; if (parsed.data.paths.some((path) => !path.startsWith(prefix) || path.includes(".."))) return Response.json({ error: "画像パスが不正です。" }, { status: 403 });
  const saved: string[] = [];
  try {
    for (const [index, path] of parsed.data.paths.entries()) {
      const { data, error } = await supabase.storage.from("visual-search-quarantine").download(path); if (error || !data) throw new Error("UPLOAD_MISSING");
      const sanitized = await sanitizeVisualImage(await data.arrayBuffer()); const finalPath = `${auth.user.id}/${id}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from("visual-search-references").upload(finalPath, sanitized.buffer, { contentType: sanitized.mime, upsert: false }); if (uploadError) throw new Error("SAVE_FAILED");
      saved.push(finalPath);
      const { error: rowError } = await supabase.from("visual_search_images").insert({ search_id: id, storage_path: finalPath, mime_type: sanitized.mime, size_bytes: sanitized.buffer.byteLength, width: sanitized.width, height: sanitized.height, sha256: sanitized.sha256 }); if (rowError) throw new Error("DB_SAVE_FAILED");
      await supabase.storage.from("visual-search-quarantine").remove([path]);
      if (index >= 4) break;
    }
    await supabase.from("audit_events").insert({ event_type: "visual_images.sanitized", resource_type: "visual_search", resource_id: id, metadata: { count: saved.length, exif_removed: true }, actor_id: auth.user.id });
    return Response.json({ count: saved.length });
  } catch (error) {
    if (saved.length) await supabase.storage.from("visual-search-references").remove(saved);
    await supabase.from("visual_search_images").delete().eq("search_id", id);
    await supabase.storage.from("visual-search-quarantine").remove(parsed.data.paths);
    const code = error instanceof Error ? error.message : "IMAGE_FAILED";
    const message = code === "IMAGE_SIZE_INVALID" ? "画像は8MB以下にしてください。" : code === "IMAGE_FORMAT_INVALID" ? "JPEG、PNG、WebPのみ使用できます。SVGは使用できません。" : code === "IMAGE_DECODE_INVALID" ? "画像を安全にデコードできませんでした。" : "画像を保存できませんでした。";
    return Response.json({ error: message }, { status: 400 });
  }
}
