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
  image_path: string | null;
  notes: string | null;
  ai_score: number | null;
  ai_summary: string | null;
  ai_strengths: string[];
  ai_risks: string[];
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
