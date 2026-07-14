import { z } from "zod";
import { evaluateCandidate } from "@/lib/ai/candidate-evaluation";
import { isSameOrigin } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "候補IDが不正です。" }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const [{ data: item, error }, { data: image }, { data: rubric }] = await Promise.all([
    supabase.from("discovery_items").select("id,title,description,skills,languages,source_url,status,research_status,research_quality_score").eq("id", id).maybeSingle(),
    supabase.from("candidate_portfolio_images").select("id,storage_path,content_type,usage_status").eq("discovery_item_id", id).eq("selected_for_ai_review", true).in("usage_status", ["review_copy_authorized", "internal_reference_authorized"]).not("storage_path", "is", null).order("image_order").limit(1).maybeSingle(),
    supabase.from("evaluation_rubric_versions").select("id,version,axes").order("published_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error || !item) return Response.json({ error: "Discovery候補が見つかりません。" }, { status: 404 });
  if (item.status !== "new") return Response.json({ error: "未処理候補だけを仮評価できます。" }, { status: 409 });
  if (item.research_quality_score < 60) return Response.json({ error: "AI仮評価にはデータ品質スコア60以上が必要です。" }, { status: 422 });
  if (!image?.storage_path) return Response.json({ error: "AI利用許可済みの保存画像が必要です。link_only・unknown画像は送信できません。" }, { status: 422 });
  if (!rubric || !Array.isArray(rubric.axes)) return Response.json({ error: "有効な評価基準がありません。" }, { status: 503 });
  try {
    const { data: imageBlob, error: imageError } = await supabase.storage.from("candidate-portfolio-images").download(image.storage_path);
    if (imageError || !imageBlob || !["image/jpeg", "image/png", "image/webp"].includes(imageBlob.type) || imageBlob.size > 8 * 1024 * 1024) throw new Error("許可済み作品画像を安全に取得できませんでした。");
    const { evaluation, model } = await evaluateCandidate({
      candidate: { primaryRole: item.title, yearsExperience: null, skills: item.skills, languages: item.languages, portfolioUrl: item.source_url, publicDescription: item.description },
      image: new Uint8Array(await imageBlob.arrayBuffer()), imageMimeType: imageBlob.type as "image/jpeg" | "image/png" | "image/webp", userId: auth.user.id,
      rubricAxes: rubric.axes as Parameters<typeof evaluateCandidate>[0]["rubricAxes"],
    });
    const { error: updateError } = await supabase.from("discovery_items").update({ preliminary_ai_score: evaluation.overall_score, preliminary_ai_summary: evaluation.summary, preliminary_ai_evaluation: evaluation, preliminary_ai_rubric_version_id: rubric.id }).eq("id", id).eq("status", "new");
    if (updateError) throw new Error("AI仮評価を保存できませんでした。");
    await supabase.from("audit_events").insert({ event_type: "discovery.ai_preliminary_evaluated", resource_type: "discovery_item", resource_id: id, metadata: { model, rubric_version_id: rubric.id, image_id: image.id }, actor_id: auth.user.id });
    return Response.json({ evaluation, model });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : "AI仮評価に失敗しました。" }, { status: 500 });
  }
}
