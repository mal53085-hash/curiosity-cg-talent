export const discoverySourceTypes = [
  "manual",
  "behance",
  "artstation",
  "linkedin",
  "website",
] as const;

export const discoveryItemStatuses = [
  "new",
  "approved",
  "rejected",
  "duplicate",
] as const;

export type DiscoverySourceType = (typeof discoverySourceTypes)[number];
export type DiscoveryItemStatus = (typeof discoveryItemStatuses)[number];

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
  external_id: string | null;
  title: string;
  author_name: string;
  description: string | null;
  country: string | null;
  skills: string[];
  thumbnail_url: string | null;
  portfolio_image_urls: string[];
  status: DiscoveryItemStatus;
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
};

export const discoveryStatusLabels: Record<DiscoveryItemStatus, string> = {
  new: "新着",
  approved: "承認済み",
  rejected: "見送り",
  duplicate: "重複",
};
