import type { AiScores } from "@/types/candidate";

type StoredResultScores = {
  visual_fit_score: number;
  brand_dna_match?: number | null;
  lighting_match?: number | null;
  composition_match?: number | null;
  material_match?: number | null;
  luxury_brand_fit?: number | null;
  display_design?: number | null;
  color_control?: number | null;
  visual_silence?: number | null;
};

const present = (...values: Array<number | null | undefined>) => values.find((value): value is number => typeof value === "number") ?? 0;
const mean = (...values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));

export function resolveVisualResultScores(result: StoredResultScores, axes: AiScores) {
  const lighting = present(result.lighting_match, axes.lighting, result.visual_fit_score);
  const composition = present(result.composition_match, axes.composition, result.visual_fit_score);
  const material = present(result.material_match, axes.materials, result.visual_fit_score);
  const luxury = present(result.luxury_brand_fit, axes.luxury_brand_fit, result.visual_fit_score);
  const display = present(result.display_design, axes.design_understanding, axes.retail_fit, result.visual_fit_score);
  const color = present(result.color_control, axes.finish, axes.materials, result.visual_fit_score);
  return {
    visual_fit_score: result.visual_fit_score,
    brand_dna_match: present(result.brand_dna_match, mean(result.visual_fit_score, luxury)),
    lighting,
    composition,
    material,
    luxury_brand_fit: luxury,
    display_design: display,
    color_control: color,
    visual_silence: present(result.visual_silence, mean(composition, lighting, luxury)),
  };
}
