import { z } from "zod";
import { previewPublicPage } from "@/lib/discovery/safe-web";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || !URL.canParse(origin) || new URL(origin).host !== host) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  try {
    const body = z.object({ url: z.string().url().max(2048) }).parse(await request.json());
    return Response.json(await previewPublicPage(body.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "プレビューを取得できませんでした。";
    return Response.json({ error: message }, { status: 422 });
  }
}
