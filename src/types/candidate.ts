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
  "hospitality_fit",
  "retail_fit",
  "artificial_lighting",
  "design_understanding",
] as const;

export type AiCriterionKey = (typeof aiCriterionKeys)[number];
export type AiScores = Partial<Record<AiCriterionKey, number>>;

export const readinessVerificationStatuses = [
  "verified",
  "self_declared",
  "publicly_indicated",
  "unknown",
  "needs_confirmation",
] as const;
export const japanReadinessGrades = ["A", "B", "C", "D", "blocked"] as const;
export const hiringPipelineStages = ["new", "shortlist", "contacted", "interview", "offer", "closed"] as const;
export const hiringClosedReasons = ["hired", "rejected_by_company", "declined_by_candidate", "no_response", "not_available", "duplicate", "future_candidate"] as const;

export type ReadinessVerificationStatus = (typeof readinessVerificationStatuses)[number];
export type JapanReadinessGrade = (typeof japanReadinessGrades)[number];
export type HiringPipelineStage = (typeof hiringPipelineStages)[number];
export type HiringClosedReason = (typeof hiringClosedReasons)[number];

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
  software: string[];
  languages: string[];
  tags: string[];
  project_fit_tags: string[];
  availability: string | null;
  status: CandidateStatus;
  rating: CandidateRating;
  portfolio_url: string | null;
  source_url: string | null;
  public_profile: string | null;
  employment_types: string[];
  work_location_preferences: string[];
  expected_salary_jpy: number | null;
  current_country: string | null;
  current_city: string | null;
  japan_residency_status: string | null;
  japan_work_authorization: boolean | null;
  visa_status: string | null;
  japanese_level: string | null;
  english_level: string | null;
  interested_in_japan: boolean | null;
  willing_to_relocate_to_japan: boolean | null;
  willing_to_work_in_tokyo: boolean | null;
  remote_from_overseas: boolean | null;
  full_time_interest: boolean | null;
  freelance_interest: boolean | null;
  earliest_start_date: string | null;
  hiring_readiness_status: JapanReadinessGrade;
  hiring_readiness_confidence: number;
  hiring_readiness_evidence: string | null;
  hiring_readiness_verified_at: string | null;
  readiness_verification: Partial<Record<string, ReadinessVerificationStatus>>;
  hiring_pipeline_stage: HiringPipelineStage;
  hiring_closed_reason: HiringClosedReason | null;
  contact_priority: number;
  contact_priority_reasons: string[];
  next_action: string | null;
  last_contacted_at: string | null;
  next_interview_at: string | null;
  outreach_review_status: "not_requested" | "draft" | "review_pending" | "approved";
  source_type?: "manual" | "behance" | "artstation" | "linkedin" | "website" | "cgarchitect" | "company";
  external_id?: string | null;
  discovered_at?: string | null;
  discovery_item_id?: string | null;
  image_path: string | null;
  work_image_count: number;
  data_quality_score: number;
  data_quality_missing: string[];
  data_quality_updated_at: string | null;
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
  ai_rubric_version_id?: string | null;
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
  hospitality_fit: "ホテル適性",
  retail_fit: "リテール適性",
  artificial_lighting: "人工照明表現",
  design_understanding: "デザイン理解",
};

export const japanReadinessLabels: Record<JapanReadinessGrade, string> = {
  A: "A · 採用条件を概ね確認済み",
  B: "B · 一部確認後に有力",
  C: "C · 海外リモート／業務委託",
  D: "D · 勤務条件が未確認",
  blocked: "Blocked · 現条件では採用困難",
};

export const hiringPipelineLabels: Record<HiringPipelineStage, string> = {
  new: "New",
  shortlist: "Shortlist",
  contacted: "Contacted",
  interview: "Interview",
  offer: "Offer",
  closed: "Closed",
};

export const hiringClosedReasonLabels: Record<HiringClosedReason, string> = {
  hired: "Hired",
  rejected_by_company: "Rejected by company",
  declined_by_candidate: "Declined by candidate",
  no_response: "No response",
  not_available: "Not available",
  duplicate: "Duplicate",
  future_candidate: "Future candidate",
};
