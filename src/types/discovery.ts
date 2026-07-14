export const discoverySourceTypes = [
  "manual",
  "behance",
  "artstation",
  "linkedin",
  "website",
  "cgarchitect",
  "company",
] as const;

export const discoveryItemStatuses = [
  "new",
  "approved",
  "rejected",
  "duplicate",
] as const;

export type DiscoverySourceType = (typeof discoverySourceTypes)[number];
export type DiscoveryItemStatus = (typeof discoveryItemStatuses)[number];

export const discoveryResearchStatuses = [
  "new",
  "reviewing",
  "needs_more_info",
  "ready_for_ai_review",
  "ready_for_approval",
  "approved",
  "rejected",
  "duplicate",
] as const;
export type DiscoveryResearchStatus = (typeof discoveryResearchStatuses)[number];

export type DiscoverySource = {
  id: string;
  name: string;
  source_type: DiscoverySourceType;
  search_query: string;
  country_hint: string | null;
  enabled: boolean;
  daily_limit: number;
  config: Record<string, unknown>;
  last_run_at: string | null;
  created_at: string;
};

export type DiscoveryItem = {
  id: string;
  source_id: string | null;
  source_type: DiscoverySourceType;
  source_url: string;
  portfolio_url: string | null;
  external_id: string | null;
  title: string;
  author_name: string;
  description: string | null;
  country: string | null;
  skills: string[];
  software: string[];
  languages: string[];
  employment_types: string[];
  work_location_preferences: string[];
  tags: string[];
  project_fit_tags: string[];
  thumbnail_url: string | null;
  portfolio_image_urls: string[];
  status: DiscoveryItemStatus;
  research_status: DiscoveryResearchStatus;
  assigned_to: string | null;
  last_verified_at: string | null;
  notes_for_review: string | null;
  research_quality_score: number;
  next_required_fields: string[];
  preliminary_ai_score: number | null;
  preliminary_ai_summary: string | null;
  preliminary_ai_evaluation: Record<string, unknown> | null;
  recruiter_metadata: Record<string, unknown>;
  duplicate_of: string | null;
  candidate_id: string | null;
  discovered_at: string;
  reviewed_at: string | null;
  created_at: string;
  discovery_sources?: Pick<DiscoverySource, "name"> | null;
};

export type DiscoveryRun = {
  id: string;
  trigger_type: "cron" | "manual";
  status: "running" | "succeeded" | "partial" | "failed" | "skipped";
  items_found: number;
  items_created: number;
  duplicates_found: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  discovery_sources?: Pick<DiscoverySource, "name"> | null;
};

export const sourceTypeLabels: Record<DiscoverySourceType, string> = {
  manual: "手動",
  behance: "Behance",
  artstation: "ArtStation",
  linkedin: "LinkedIn",
  website: "Webサイト",
  cgarchitect: "CGArchitect",
  company: "会社プロフィール",
};

export const discoveryStatusLabels: Record<DiscoveryItemStatus, string> = {
  new: "新着",
  approved: "承認済み",
  rejected: "見送り",
  duplicate: "重複",
};

export const researchStatusLabels: Record<DiscoveryResearchStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  needs_more_info: "Needs More Info",
  ready_for_ai_review: "Ready for AI Review",
  ready_for_approval: "Ready for Approval",
  approved: "Approved",
  rejected: "Rejected",
  duplicate: "Duplicate",
};
