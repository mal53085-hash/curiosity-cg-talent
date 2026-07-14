import "server-only";

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const evaluationModel = "gpt-5.4-mini";

const score = z.number().int().min(0).max(100);

export const candidateEvaluationSchema = z.object({
  overall_score: score,
  scores: z.object({
    composition: score,
    lighting: score,
    materials: score,
    luxury_brand_fit: score,
    interior_understanding: score,
    detail: score,
    finish: score,
    technical_adaptability: score,
  }),
  summary: z.string().min(1).max(1200),
  reasoning: z.string().min(1).max(4000),
  strengths: z.array(z.string().min(1).max(500)).min(2).max(6),
  concerns: z.array(z.string().min(1).max(500)).max(6),
  recommended_projects: z.array(z.string().min(1).max(500)).min(2).max(5),
  interview_questions: z.array(z.string().min(1).max(500)).min(3).max(8),
});

export type CandidateEvaluation = z.infer<typeof candidateEvaluationSchema>;

type EvaluationCandidate = {
  primaryRole: string;
  yearsExperience: number | null;
  skills: string[];
  languages: string[];
  portfolioUrl: string | null;
  publicDescription?: string | null;
};

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEYが本番環境に設定されていません。");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export async function evaluateCandidate({
  candidate,
  image,
  imageMimeType,
  userId,
}: {
  candidate: EvaluationCandidate;
  image: Uint8Array;
  imageMimeType: "image/jpeg" | "image/png" | "image/webp";
  userId: string;
}) {
  const profile = {
    primary_role: candidate.primaryRole,
    years_experience: candidate.yearsExperience,
    skills: candidate.skills,
    languages: candidate.languages,
    portfolio_url: candidate.portfolioUrl,
    public_portfolio_description: candidate.publicDescription ?? null,
  };
  const imageDataUrl = `data:${imageMimeType};base64,${Buffer.from(image).toString("base64")}`;
  const safetyIdentifier = createHash("sha256").update(userId).digest("hex");

  const response = await getOpenAI().responses.parse({
    model: evaluationModel,
    reasoning: { effort: "medium" },
    safety_identifier: safetyIdentifier,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "あなたは建築・インテリアCG制作会社Curiosityの作品評価アシスタントです。",
              "添付画像を候補者のCG作品サンプルとして、プロフィールに記載された制作スキルと合わせて評価してください。",
              "画像に人物が含まれても、年齢、性別、人種、障害、健康状態その他の保護属性を推測・評価してはいけません。",
              "採用可否は判断せず、観察できる作品品質と職務関連情報だけを根拠にしてください。証拠が弱い項目は厳密に断定せず、懸念点や面談質問に反映してください。",
              "8軸を0〜100で採点し、総合点は8軸との整合性を保ってください。回答は日本語にしてください。",
            ].join("\n"),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `候補者プロフィール:\n${JSON.stringify(profile, null, 2)}`,
          },
          {
            type: "input_image",
            image_url: imageDataUrl,
            detail: "high",
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(candidateEvaluationSchema, "candidate_evaluation"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("AI評価結果を構造化データとして取得できませんでした。");
  }

  return { evaluation: response.output_parsed, model: evaluationModel };
}
