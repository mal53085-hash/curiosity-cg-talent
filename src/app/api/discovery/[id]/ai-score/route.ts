import { z } from "zod";
import { evaluateCandidate } from "@/lib/ai/candidate-evaluation";
import { fetchPublicImage } from "@/lib/discovery/safe-web";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || !URL.canParse(origin) || new URL(origin).host !== host) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "候補IDが不正です。" }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const { data: item, error } = await supabase.from("discovery_items").select("id,title,description,skills,source_url,thumbnail_url,status").eq("id", id).maybeSingle();
  if (error || !item) return Response.json({ error: "Discovery候補が見つかりません。" }, { status: 404 });
  if (item.status !== "new") return Response.json({ error: "未処理候補だけを仮評価できます。" }, { status: 409 });
  if (!item.thumbnail_url) return Response.json({ error: "AI仮評価には公開作品画像URLが必要です。" }, { status: 422 });
  try {
    const image = await fetchPublicImage(item.thumbnail_url);
    const { evaluation, model } = await evaluateCandidate({
      candidate: { primaryRole: item.title, yearsExperience: null, skills: item.skills, languages: [], portfolioUrl: item.source_url, publicDescription: item.description },
      image: image.bytes, imageMimeType: image.contentType, userId: auth.user.id,
    });
    const { error: updateError } = await supabase.from("discovery_items").update({ preliminary_ai_score: evaluation.overall_score, preliminary_ai_summary: evaluation.summary, preliminary_ai_evaluation: evaluation }).eq("id", id).eq("status", "new");
    if (updateError) throw new Error("AI仮評価を保存できませんでした。");
    return Response.json({ evaluation, model });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : "AI仮評価に失敗しました。" }, { status: 500 });
  }
}
