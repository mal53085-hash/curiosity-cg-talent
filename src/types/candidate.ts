export const candidateStatuses = [
  "sourcing",
  "screening",
  "interview",
  "trial",
  "offer",
  "hired",
  "on_hold",
  "rejected",
] as const;

export const candidateRatings = ["unrated", "A+", "A", "B+", "B", "C"] as const;

export type CandidateStatus = (typeof candidateStatuses)[number];
export type CandidateRating = (typeof candidateRatings)[number];

export const aiCriterionKeys = [
  "composition",
  "lighting",
  "materials",
  "luxury_brand_fit",
  "interior_understanding",
  "detail",
  "finish",
  "technical_adaptability",
] as const;

export type AiCriterionKey = (typeof aiCriterionKeys)[number];
export type AiScores = Partial<Record<AiCriterionKey, number>>;

export type Candidate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  country: string;
  city: string | null;
  primary_role: string;
  years_experience: number | null;
  skills: string[];
  languages: string[];
  availability: string | null;
  status: CandidateStatus;
  rating: CandidateRating;
  portfolio_url: string | null;
  source_url: string | null;
  source_type?: "manual" | "behance" | "artstation" | "linkedin" | "website";
  external_id?: string | null;
  discovered_at?: string | null;
  discovery_item_id?: string | null;
  image_path: string | null;
  notes: string | null;
  ai_score: number | null;
  ai_summary: string | null;
  ai_strengths: string[];
  ai_risks: string[];
  ai_scores: AiScores;
  ai_reasoning: string | null;
  ai_recommended_projects: string[];
  ai_interview_questions: string[];
  ai_model: string | null;
  ai_evaluated_at: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  image_url?: string | null;
};

export const statusLabels: Record<CandidateStatus, string> = {
  sourcing: "発掘中",
  screening: "書類選考",
  interview: "面談",
  trial: "トライアル",
  offer: "オファー",
  hired: "採用",
  on_hold: "保留",
  rejected: "見送り",
};

export const ratingLabels: Record<CandidateRating, string> = {
  unrated: "未評価",
  "A+": "A+",
  A: "A",
  "B+": "B+",
  B: "B",
  C: "C",
};

export const aiCriterionLabels: Record<AiCriterionKey, string> = {
  composition: "構図",
  lighting: "ライティング",
  materials: "マテリアル",
  luxury_brand_fit: "高級ブランド適性",
  interior_understanding: "インテリア理解",
  detail: "ディテール",
  finish: "仕上げ",
  technical_adaptability: "技術適応力",
};
