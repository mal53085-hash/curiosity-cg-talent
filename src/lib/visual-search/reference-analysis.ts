import { aggregateVisualFeatures } from "@/lib/visual-search/features";
import type { VisualFeatures } from "@/types/visual-search";

const mean = (...values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
const coverage = (count: number, expected: number) => Math.min(100, Math.round((count / expected) * 100));
const list = (values: string[], fallback: string) => values.length ? values.join("、") : fallback;

export type ReferenceMetric = { key: string; label: string; value: number; basis: string };

export function buildReferenceAnalysis(features: VisualFeatures[]) {
  const aggregate = aggregateVisualFeatures(features);
  const lightingCoverage = coverage(new Set([...aggregate.lighting, ...aggregate.artificial_lighting]).size, 12);
  const compositionCoverage = coverage(aggregate.composition.length, 8);
  const materialCoverage = coverage(aggregate.materials.length, 10);
  const colorCoverage = mean(coverage(aggregate.color_tone.length, 8), coverage(aggregate.contrast.length, 6));
  const visualSilence = Math.max(0, 100 - aggregate.quiet_drama);
  const curiosityDna = mean(aggregate.luxury_level, aggregate.retail_fit, visualSilence);
  const displayDesign = mean(aggregate.retail_fit, compositionCoverage);

  const metrics: ReferenceMetric[] = [
    { key: "curiosity_dna", label: "Curiosity DNA Match", value: curiosityDna, basis: "Luxury・Retail・Visual Silenceの構造化特徴から算出" },
    { key: "luxury_brand_fit", label: "Luxury Brand Fit", value: aggregate.luxury_level, basis: "抽出済みluxury_level" },
    { key: "lighting_design", label: "Lighting Design", value: lightingCoverage, basis: "自然光・人工照明特徴の記述カバレッジ" },
    { key: "spatial_composition", label: "Spatial Composition", value: compositionCoverage, basis: "構図特徴の記述カバレッジ" },
    { key: "material_refinement", label: "Material Refinement", value: materialCoverage, basis: "素材特徴の記述カバレッジ" },
    { key: "display_design", label: "Display Design", value: displayDesign, basis: "Retail Fitと構図特徴から算出" },
    { key: "color_control", label: "Color Control", value: colorCoverage, basis: "色調・コントラスト特徴の記述カバレッジ" },
    { key: "visual_silence", label: "Visual Silence", value: visualSilence, basis: "抽出済みquiet_dramaの反転値" },
    { key: "architectural_detail", label: "Architectural Detail", value: aggregate.detail_density, basis: "抽出済みdetail_density" },
    { key: "hospitality_fit", label: "Hospitality Fit", value: aggregate.hospitality_fit, basis: "抽出済みhospitality_fit" },
    { key: "retail_fit", label: "Retail Fit", value: aggregate.retail_fit, basis: "抽出済みretail_fit" },
    { key: "photorealism", label: "Photorealism", value: aggregate.photorealism, basis: "抽出済みphotorealism" },
  ];

  const topMetrics = [...metrics].filter((metric) => !["curiosity_dna"].includes(metric.key)).sort((a, b) => b.value - a.value).slice(0, 3);
  const summary = {
    overallCharacter: `${list(aggregate.brand_tones, "ブランドトーンは未特定")}。${aggregate.summary}`,
    lighting: list([...aggregate.lighting, ...aggregate.artificial_lighting], "照明特徴は未特定"),
    composition: list(aggregate.composition, "構図特徴は未特定"),
    materialLanguage: list(aggregate.materials, "素材特徴は未特定"),
    brandExpression: `${list(aggregate.brand_tones, "未特定")}。高級感指標 ${aggregate.luxury_level}/100。`,
    displayStrategy: `${list(aggregate.space_types, "空間種別は未特定")}。Retail Fit ${aggregate.retail_fit}/100。`,
    colorStrategy: `${list(aggregate.color_tone, "色調は未特定")}。コントラスト: ${list(aggregate.contrast, "未特定")}。`,
    visualSilence: `Visual Silence ${visualSilence}/100。静けさ／ドラマ性の抽出値から算出しています。`,
    strengths: topMetrics.map((metric) => `${metric.label} ${metric.value}/100（${metric.basis}）`),
    potentialRisks: aggregate.uncertainties.length ? aggregate.uncertainties : ["保存済み特徴量は作品傾向の記述であり、実務経験・制作速度・担当範囲は未確認です。"],
  };

  return { aggregate, metrics, summary };
}

export function buildEvaluationWeights(priorityCriteria: string[]) {
  const normalized = priorityCriteria.map((value) => value.toLowerCase());
  const keys = ["lighting", "composition", "materials", "luxury_brand_fit", "display_design", "color_control", "visual_silence"];
  return Object.fromEntries(keys.map((key) => [key, normalized.some((value) => value.includes(key.replaceAll("_", " "))) ? 1.5 : 1]));
}

