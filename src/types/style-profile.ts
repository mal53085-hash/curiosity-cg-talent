import type { VisualFeatures, VisualFeatureVector } from "@/types/visual-search";

export type StyleProfileSummary = {
  id: string;
  name: string;
  description: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  current_version: {
    id: string;
    version_number: number;
    derived_features: VisualFeatures;
    feature_vector: VisualFeatureVector;
    evaluation_weights: Record<string, number>;
    model_version: string;
    created_at: string;
  } | null;
};

