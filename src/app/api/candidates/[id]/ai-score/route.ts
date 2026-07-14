import { z } from "zod";
import { evaluateCandidate } from "@/lib/ai/candidate-evaluation";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const idSchema = z.string().uuid();
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || !URL.canParse(origin) || new URL(origin).host !== host) {
    return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return Response.json({ error: "候補者IDが不正です。" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("id,primary_role,years_experience,skills,languages,portfolio_url,image_path")
    .eq("id", id)
    .maybeSingle();
  if (candidateError) {
    return Response.json({ error: "候補者情報を取得できませんでした。" }, { status: 500 });
  }
  if (!candidate) {
    return Response.json({ error: "候補者が見つかりません。" }, { status: 404 });
  }
  if (!candidate.image_path) {
    return Response.json(
      { error: "AI採点には候補者の作品画像が必要です。" },
      { status: 422 },
    );
  }

  try {
    const { data: imageBlob, error: imageError } = await supabase.storage
      .from("candidate-images")
      .download(candidate.image_path);
    if (imageError || !imageBlob) {
      throw new Error("候補者画像を取得できませんでした。");
    }
    if (!acceptedImageTypes.has(imageBlob.type)) {
      throw new Error("AI採点に対応していない画像形式です。");
    }
    if (imageBlob.size > 8 * 1024 * 1024) {
      throw new Error("画像サイズが8MBを超えています。");
    }

    const { evaluation, model } = await evaluateCandidate({
      candidate: {
        primaryRole: candidate.primary_role,
        yearsExperience: candidate.years_experience,
        skills: candidate.skills,
        languages: candidate.languages,
        portfolioUrl: candidate.portfolio_url,
      },
      image: new Uint8Array(await imageBlob.arrayBuffer()),
      imageMimeType: imageBlob.type as "image/jpeg" | "image/png" | "image/webp",
      userId: authData.user.id,
    });

    const evaluatedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("candidates")
      .update({
        ai_score: evaluation.overall_score,
        ai_scores: evaluation.scores,
        ai_summary: evaluation.summary,
        ai_reasoning: evaluation.reasoning,
        ai_strengths: evaluation.strengths,
        ai_risks: evaluation.concerns,
        ai_recommended_projects: evaluation.recommended_projects,
        ai_interview_questions: evaluation.interview_questions,
        ai_model: model,
        ai_evaluated_at: evaluatedAt,
        updated_by: authData.user.id,
      })
      .eq("id", id);
    if (updateError) throw new Error("AI評価結果を保存できませんでした。");

    return Response.json({ evaluation, model, evaluatedAt });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    const message = rawMessage.endsWith("。")
      ? rawMessage
      : "AI採点サービスに接続できませんでした。時間をおいて再試行してください。";
    return Response.json({ error: message }, { status: 500 });
  }
}
