export const portfolioUsageStatuses = ["link_only", "review_copy_authorized", "internal_reference_authorized", "unknown"] as const;
export type PortfolioUsageStatus = (typeof portfolioUsageStatuses)[number];

export const portfolioUsageLabels: Record<PortfolioUsageStatus, string> = {
  link_only: "リンクのみ",
  review_copy_authorized: "レビュー用コピー許可済み",
  internal_reference_authorized: "社内参考利用許可済み",
  unknown: "権利状態未確認",
};

export type CandidatePortfolioImage = {
  id: string;
  candidate_id: string | null;
  discovery_item_id: string | null;
  storage_path: string | null;
  external_url: string | null;
  source_url: string | null;
  source_page_url: string | null;
  captured_at: string;
  usage_status: PortfolioUsageStatus;
  rights_note: string | null;
  selected_for_ai_review: boolean;
  image_order: number;
  content_type: string | null;
  byte_size: number | null;
  created_at: string;
  preview_url?: string | null;
};

export type AiReviewEligibility = { eligible: boolean; reasons: string[] };
