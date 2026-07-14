import type { DiscoverySourceType } from "@/types/discovery";

export const acquisitionFields = [
  "name",
  "source_type",
  "source_url",
  "portfolio_url",
  "region",
  "skills",
  "software",
  "languages",
  "employment_types",
  "work_location_preferences",
  "notes_for_review",
] as const;

export type AcquisitionField = (typeof acquisitionFields)[number];
export type ColumnMapping = Record<string, AcquisitionField | "ignore">;

export type AcquisitionRecord = {
  name: string;
  source_type: DiscoverySourceType;
  source_url: string;
  portfolio_url: string;
  region: string;
  skills: string[];
  software: string[];
  languages: string[];
  employment_types: string[];
  work_location_preferences: string[];
  notes_for_review: string;
  public_profile: string;
  research_status: "new" | "reviewing" | "needs_more_info" | "ready_for_ai_review" | "ready_for_approval";
};

export type AcquisitionPreviewRow = {
  rowNumber: number;
  rawInput: string;
  normalizedUrl: string | null;
  sourceType: DiscoverySourceType | null;
  supported: boolean;
  duplicate: boolean;
  duplicateKind: "batch" | "discovery" | "candidate" | null;
  errors: string[];
  data: Partial<AcquisitionRecord>;
};

export type AcquisitionPreview = {
  rows: AcquisitionPreviewRow[];
  summary: {
    total: number;
    supported: number;
    unsupported: number;
    duplicates: number;
    newItems: number;
    plannedFields: string[];
    excludedColumns: string[];
  };
};
