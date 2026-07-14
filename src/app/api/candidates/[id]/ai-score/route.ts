import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
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
  if (!isSameOrigin(request)) {
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

  const [{ data: candidate, error: candidateError }, { data: eligibility, error: eligibilityError }, { data: rubric, error: rubricError }] = await Promise.all([
    supabase
    .from("candidates")
    .select("id,primary_role,years_experience,skills,languages,portfolio_url,public_profile")
    .eq("id", id)
    .maybeSingle(),
    supabase.from("candidate_ai_review_eligibility").select("eligible,reasons").eq("candidate_id", id).maybeSingle(),
    supabase.from("evaluation_rubric_versions").select("id,version,axes").order("published_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (candidateError || eligibilityError || rubricError) {
    return Response.json({ error: "候補者情報を取得できませんでした。" }, { status: 500 });
  }
  if (!candidate) {
    return Response.json({ error: "候補者が見つかりません。" }, { status: 404 });
  }
  if (!eligibility?.eligible) {
    return Response.json(
      { error: "AI評価条件が揃っていません。", reasons: eligibility?.reasons ?? ["評価可否を確認できません"] },
      { status: 422 },
    );
  }
  if (!rubric || !Array.isArray(rubric.axes)) return Response.json({ error: "有効な評価基準がありません。" }, { status: 503 });

  const { data: image, error: imageRecordError } = await supabase.from("candidate_portfolio_images")
    .select("id,storage_path,content_type,usage_status")
    .eq("candidate_id", id)
    .eq("selected_for_ai_review", true)
    .in("usage_status", ["review_copy_authorized", "internal_reference_authorized"])
    .not("storage_path", "is", null)
    .order("image_order")
    .limit(1)
    .maybeSingle();
  if (imageRecordError || !image?.storage_path) return Response.json({ error: "AI利用許可済みの保存画像がありません。" }, { status: 422 });

  try {
    const { data: imageBlob, error: imageError } = await supabase.storage
      .from("candidate-portfolio-images")
      .download(image.storage_path);
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
        publicDescription: candidate.public_profile,
      },
      image: new Uint8Array(await imageBlob.arrayBuffer()),
      imageMimeType: imageBlob.type as "image/jpeg" | "image/png" | "image/webp",
      userId: authData.user.id,
      rubricAxes: rubric.axes as Parameters<typeof evaluateCandidate>[0]["rubricAxes"],
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
        ai_rubric_version_id: rubric.id,
        updated_by: authData.user.id,
      })
      .eq("id", id);
    if (updateError) throw new Error("AI評価結果を保存できませんでした。");

    await supabase.from("audit_events").insert({
      event_type: "candidate.ai_evaluated",
      resource_type: "candidate",
      resource_id: id,
      metadata: { model, rubric_version_id: rubric.id, rubric_version: rubric.version, portfolio_image_id: image.id },
      actor_id: authData.user.id,
    });

    return Response.json({ evaluation, model, evaluatedAt });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    const message = rawMessage.endsWith("。")
      ? rawMessage
      : "AI採点サービスに接続できませんでした。時間をおいて再試行してください。";
    return Response.json({ error: message }, { status: 500 });
  }
}
